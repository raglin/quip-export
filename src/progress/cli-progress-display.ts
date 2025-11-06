import { ProgressTracker, ProgressUpdate } from './progress-tracker';
import { Logger } from '../types';

export interface ProgressDisplayOptions {
  showDetails: boolean;
  refreshInterval: number; // milliseconds
  showETA: boolean;
  showRate: boolean;
}

export class CLIProgressDisplay {
  private tracker: ProgressTracker;
  private logger: Logger;
  private options: ProgressDisplayOptions;
  private displayInterval?: NodeJS.Timeout;
  private lastDisplayTime: number = 0;

  constructor(
    tracker: ProgressTracker,
    logger: Logger,
    options: Partial<ProgressDisplayOptions> = {}
  ) {
    this.tracker = tracker;
    this.logger = logger;
    this.options = {
      showDetails: true,
      refreshInterval: 1000,
      showETA: true,
      showRate: true,
      ...options
    };

    this.setupEventListeners();
  }

  public start(): void {
    this.logger.info('Migration started');
    this.displayProgress();
    
    if (this.options.refreshInterval > 0) {
      this.displayInterval = setInterval(() => {
        this.displayProgress();
      }, this.options.refreshInterval);
    }
  }

  public stop(): void {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
      this.displayInterval = undefined;
    }
    
    this.displayFinalSummary();
  }

  private setupEventListeners(): void {
    this.tracker.on('progress', (update: ProgressUpdate) => {
      this.handleProgressUpdate(update);
    });
  }

  private handleProgressUpdate(update: ProgressUpdate): void {
    switch (update.type) {
      case 'start':
        if (this.options.showDetails && update.documentTitle) {
          const folderInfo = update.folderName ? ` in ${update.folderName}` : '';
          const formatInfo = update.formats ? ` (${update.formats.join(', ')})` : '';
          this.logger.info(`Exporting: ${update.documentTitle}${folderInfo}${formatInfo}`);
        }
        break;
        
      case 'folder_change':
        if (this.options.showDetails && update.folderName) {
          this.logger.info(`Processing folder: ${update.folderName}`);
        }
        break;
        
      case 'progress':
        if (this.options.showDetails && update.operation) {
          this.logger.debug(`Operation: ${update.operation}`);
        }
        break;

      case 'format_start':
        if (this.options.showDetails && update.format) {
          this.logger.info(`  → Starting ${update.format.toUpperCase()} export`);
        }
        break;

      case 'format_complete':
        if (this.options.showDetails && update.format) {
          this.logger.info(`  ✓ ${update.format.toUpperCase()} export completed`);
        }
        break;

      case 'format_error':
        if (update.format) {
          const errorMsg = update.error ? `: ${update.error.message}` : '';
          this.logger.error(`  ✗ ${update.format.toUpperCase()} export failed${errorMsg}`);
        }
        break;
        
      case 'complete':
        if (this.options.showDetails) {
          const sizeInfo = update.fileSize ? ` (${this.formatBytes(update.fileSize)})` : '';
          this.logger.info(`Export completed${sizeInfo}`);
        }
        break;
        
      case 'error':
        if (update.error) {
          this.logger.error(`Export failed: ${update.error.message}`);
        }
        break;
    }

    // Force display update on significant events
    if (update.type === 'complete' || update.type === 'error' || update.type === 'folder_change' || 
        update.type === 'format_start' || update.type === 'format_complete' || update.type === 'format_error') {
      this.displayProgress();
    }
  }

  private displayProgress(): void {
    const now = Date.now();
    if (now - this.lastDisplayTime < this.options.refreshInterval / 2) {
      return; // Avoid too frequent updates
    }
    
    this.lastDisplayTime = now;
    const state = this.tracker.getState();
    
    // Create progress bar
    const progressBar = this.createProgressBar();
    
    // Create status line
    const statusLine = this.createStatusLine();
    
    // Clear previous line and display new progress
    process.stdout.write('\r\x1b[K'); // Clear current line
    process.stdout.write(`${progressBar} ${statusLine}`);
    
    if (state.processedDocuments === state.totalDocuments) {
      process.stdout.write('\n'); // New line when complete
    }
  }

  private createProgressBar(): string {
    const percentage = this.tracker.getProgressPercentage();
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `[${filled}${empty}] ${percentage}%`;
  }

  private createStatusLine(): string {
    const state = this.tracker.getState();
    let status = `${state.processedDocuments}/${state.totalDocuments}`;
    
    if (this.options.showRate && state.processingRate) {
      status += ` (${state.processingRate.toFixed(1)} docs/min)`;
    }

    if (this.options.showRate && state.exportSpeed) {
      const speed = this.tracker.getFormattedExportSpeed();
      if (speed) {
        status += ` ${speed}`;
      }
    }
    
    if (this.options.showETA && state.estimatedTimeRemaining && state.processedDocuments < state.totalDocuments) {
      const eta = this.tracker.getEstimatedTimeRemaining();
      if (eta) {
        status += ` ETA: ${eta}`;
      }
    }

    // Add format progress information
    if (state.formatProgress && this.options.showDetails) {
      const fp = state.formatProgress;
      status += ` | Formats: ${fp.completedFormats}/${fp.totalFormats}`;
      
      if (state.currentFormat) {
        status += ` (${state.currentFormat.toUpperCase()})`;
      }
    }

    if (state.currentFolder && this.options.showDetails) {
      const maxFolderLength = 20;
      const truncatedFolder = state.currentFolder.length > maxFolderLength 
        ? state.currentFolder.substring(0, maxFolderLength - 3) + '...'
        : state.currentFolder;
      status += ` | ${truncatedFolder}`;
    }
    
    if (state.currentDocument && this.options.showDetails) {
      const maxLength = 25; // Reduced to make room for format info
      const truncated = state.currentDocument.length > maxLength 
        ? state.currentDocument.substring(0, maxLength - 3) + '...'
        : state.currentDocument;
      status += ` | ${truncated}`;
    }
    
    return status;
  }

  private displayFinalSummary(): void {
    const state = this.tracker.getState();
    const elapsed = this.tracker.getFormattedElapsedTime();
    const totalBytes = this.tracker.getFormattedTotalBytes();
    const avgSpeed = this.tracker.getFormattedExportSpeed();
    
    console.log('\n' + '='.repeat(60));
    console.log('EXPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total Documents: ${state.totalDocuments}`);
    console.log(`Successful: ${state.successfulExports}`);
    console.log(`Failed: ${state.failedExports}`);
    console.log(`Total Time: ${elapsed}`);
    
    if (totalBytes !== '0.0 B') {
      console.log(`Data Exported: ${totalBytes}`);
    }
    
    if (state.processingRate) {
      console.log(`Average Rate: ${state.processingRate.toFixed(1)} docs/min`);
    }

    if (avgSpeed) {
      console.log(`Average Speed: ${avgSpeed}`);
    }
    
    const successRate = state.totalDocuments > 0 
      ? ((state.successfulExports / state.totalDocuments) * 100).toFixed(1)
      : '0';
    console.log(`Success Rate: ${successRate}%`);
    console.log('='.repeat(60));
  }

  public displayError(error: Error, context?: string): void {
    console.error('\n' + '!'.repeat(60));
    console.error('ERROR');
    console.error('!'.repeat(60));
    if (context) {
      console.error(`Context: ${context}`);
    }
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
    console.error('!'.repeat(60));
  }

  public displayWarning(message: string): void {
    console.warn(`⚠️  WARNING: ${message}`);
  }

  public displayInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  public displaySuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}