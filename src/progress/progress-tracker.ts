import { EventEmitter } from 'events';

export interface ProgressState {
  sessionId: string;
  totalDocuments: number;
  processedDocuments: number;
  successfulExports: number;
  failedExports: number;
  currentDocument?: string;
  currentFolder?: string;
  currentOperation?: string;
  currentFormat?: string;
  currentFormats?: string[];
  formatProgress?: FormatProgress;
  startTime: Date;
  lastUpdateTime: Date;
  estimatedTimeRemaining?: number;
  processingRate?: number; // documents per minute
  exportSpeed?: number; // bytes per second
  totalBytesProcessed?: number;
}

export interface FormatProgress {
  totalFormats: number;
  completedFormats: number;
  currentFormatIndex: number;
  formatResults: { [format: string]: 'pending' | 'processing' | 'success' | 'failed' };
}

export interface ProgressUpdate {
  type:
    | 'start'
    | 'progress'
    | 'complete'
    | 'error'
    | 'folder_change'
    | 'format_start'
    | 'format_complete'
    | 'format_error';
  documentId?: string;
  documentTitle?: string;
  folderName?: string;
  operation?: string;
  format?: string;
  formats?: string[];
  formatProgress?: FormatProgress;
  error?: Error;
  timestamp: Date;
  fileSize?: number;
}

export class ProgressTracker extends EventEmitter {
  private state: ProgressState;
  private startTime: Date;

  constructor(sessionId: string, totalDocuments: number) {
    super();
    this.startTime = new Date();

    this.state = {
      sessionId,
      totalDocuments,
      processedDocuments: 0,
      successfulExports: 0,
      failedExports: 0,
      startTime: this.startTime,
      lastUpdateTime: this.startTime,
      totalBytesProcessed: 0,
    };
  }

  public getState(): ProgressState {
    return { ...this.state };
  }

  public startDocument(
    documentId: string,
    documentTitle: string,
    folderName?: string,
    formats?: string[]
  ): void {
    this.state.currentDocument = documentTitle;
    this.state.currentFolder = folderName;
    this.state.currentOperation = 'Exporting';
    this.state.currentFormats = formats;
    this.state.lastUpdateTime = new Date();

    // Initialize format progress if formats are provided
    if (formats && formats.length > 0) {
      this.state.formatProgress = {
        totalFormats: formats.length,
        completedFormats: 0,
        currentFormatIndex: 0,
        formatResults: formats.reduce(
          (acc, format) => {
            acc[format] = 'pending';
            return acc;
          },
          {} as { [format: string]: 'pending' | 'processing' | 'success' | 'failed' }
        ),
      };
    }

    const update: ProgressUpdate = {
      type: 'start',
      documentId,
      documentTitle,
      folderName,
      operation: 'Exporting',
      formats,
      formatProgress: this.state.formatProgress,
      timestamp: new Date(),
    };

    this.emit('progress', update);
  }

  public updateFolder(folderName: string): void {
    this.state.currentFolder = folderName;
    this.state.lastUpdateTime = new Date();

    const update: ProgressUpdate = {
      type: 'folder_change',
      folderName,
      timestamp: new Date(),
    };

    this.emit('progress', update);
  }

  public updateOperation(operation: string): void {
    this.state.currentOperation = operation;
    this.state.lastUpdateTime = new Date();

    const update: ProgressUpdate = {
      type: 'progress',
      operation,
      timestamp: new Date(),
    };

    this.emit('progress', update);
  }

  public startFormat(format: string): void {
    this.state.currentFormat = format;
    this.state.currentOperation = `Exporting as ${format.toUpperCase()}`;
    this.state.lastUpdateTime = new Date();

    if (this.state.formatProgress) {
      this.state.formatProgress.formatResults[format] = 'processing';

      // Update current format index
      const formats = Object.keys(this.state.formatProgress.formatResults);
      this.state.formatProgress.currentFormatIndex = formats.indexOf(format);
    }

    const update: ProgressUpdate = {
      type: 'format_start',
      format,
      operation: this.state.currentOperation,
      formatProgress: this.state.formatProgress,
      timestamp: new Date(),
    };

    this.emit('progress', update);
  }

  public completeFormat(format: string, success: boolean, error?: Error): void {
    this.state.lastUpdateTime = new Date();

    if (this.state.formatProgress) {
      this.state.formatProgress.formatResults[format] = success ? 'success' : 'failed';

      if (success || !success) {
        // Count both success and failure as completion
        this.state.formatProgress.completedFormats++;
      }
    }

    const update: ProgressUpdate = {
      type: success ? 'format_complete' : 'format_error',
      format,
      formatProgress: this.state.formatProgress,
      error,
      timestamp: new Date(),
    };

    this.emit('progress', update);

    // Clear current format if this was the last one or if all formats are done
    if (
      this.state.formatProgress &&
      this.state.formatProgress.completedFormats >= this.state.formatProgress.totalFormats
    ) {
      this.state.currentFormat = undefined;
    }
  }

  public completeDocument(success: boolean, fileSize?: number, error?: Error): void {
    this.state.processedDocuments++;

    if (success) {
      this.state.successfulExports++;
      if (fileSize) {
        this.state.totalBytesProcessed = (this.state.totalBytesProcessed || 0) + fileSize;
      }
    } else {
      this.state.failedExports++;
    }

    this.updateProcessingRate();
    this.updateExportSpeed();
    this.updateEstimatedTimeRemaining();

    // Clear document-specific state
    this.state.currentDocument = undefined;
    this.state.currentOperation = undefined;
    this.state.currentFormat = undefined;
    this.state.currentFormats = undefined;
    this.state.formatProgress = undefined;
    this.state.lastUpdateTime = new Date();

    const update: ProgressUpdate = {
      type: success ? 'complete' : 'error',
      error,
      fileSize,
      timestamp: new Date(),
    };

    this.emit('progress', update);
  }

  public getProgressPercentage(): number {
    if (this.state.totalDocuments === 0) return 0;
    return Math.round((this.state.processedDocuments / this.state.totalDocuments) * 100);
  }

  public getElapsedTime(): number {
    return Date.now() - this.startTime.getTime();
  }

  public getFormattedElapsedTime(): string {
    const elapsed = this.getElapsedTime();
    return this.formatDuration(elapsed);
  }

  public getEstimatedTimeRemaining(): string | undefined {
    if (!this.state.estimatedTimeRemaining) return undefined;
    return this.formatDuration(this.state.estimatedTimeRemaining);
  }

  public getProcessingRate(): number | undefined {
    return this.state.processingRate;
  }

  public getExportSpeed(): number | undefined {
    return this.state.exportSpeed;
  }

  public getFormattedExportSpeed(): string | undefined {
    if (!this.state.exportSpeed) return undefined;
    return this.formatBytes(this.state.exportSpeed) + '/s';
  }

  public getTotalBytesProcessed(): number {
    return this.state.totalBytesProcessed || 0;
  }

  public getFormattedTotalBytes(): string {
    return this.formatBytes(this.getTotalBytesProcessed());
  }

  private updateProcessingRate(): void {
    const now = new Date();
    const elapsedMinutes = (now.getTime() - this.startTime.getTime()) / (1000 * 60);

    if (elapsedMinutes > 0 && this.state.processedDocuments > 0) {
      this.state.processingRate = this.state.processedDocuments / elapsedMinutes;
    }
  }

  private updateExportSpeed(): void {
    const now = new Date();
    const elapsedSeconds = (now.getTime() - this.startTime.getTime()) / 1000;

    if (elapsedSeconds > 0 && this.state.totalBytesProcessed) {
      this.state.exportSpeed = this.state.totalBytesProcessed / elapsedSeconds;
    }
  }

  private updateEstimatedTimeRemaining(): void {
    if (!this.state.processingRate || this.state.processingRate === 0) return;

    const remainingDocuments = this.state.totalDocuments - this.state.processedDocuments;
    if (remainingDocuments <= 0) {
      this.state.estimatedTimeRemaining = 0;
      return;
    }

    // Calculate ETA based on processing rate (in minutes)
    const estimatedMinutes = remainingDocuments / this.state.processingRate;
    this.state.estimatedTimeRemaining = estimatedMinutes * 60 * 1000; // Convert to milliseconds
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
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

  public getSummary(): string {
    const percentage = this.getProgressPercentage();
    const elapsed = this.getFormattedElapsedTime();
    const eta = this.getEstimatedTimeRemaining();
    const rate = this.state.processingRate?.toFixed(1);
    const speed = this.getFormattedExportSpeed();
    const totalBytes = this.getFormattedTotalBytes();

    let summary = `Progress: ${this.state.processedDocuments}/${this.state.totalDocuments} (${percentage}%)`;
    summary += `\nElapsed: ${elapsed}`;

    if (eta && this.state.processedDocuments < this.state.totalDocuments) {
      summary += `\nETA: ${eta}`;
    }

    if (rate) {
      summary += `\nRate: ${rate} docs/min`;
    }

    if (speed) {
      summary += `\nSpeed: ${speed}`;
    }

    if (totalBytes !== '0.0 B') {
      summary += `\nData: ${totalBytes}`;
    }

    if (this.state.currentFolder) {
      summary += `\nFolder: ${this.state.currentFolder}`;
    }

    if (this.state.currentDocument) {
      summary += `\nCurrent: ${this.state.currentDocument}`;
      if (this.state.currentOperation) {
        summary += ` (${this.state.currentOperation})`;
      }
    }

    // Add format-specific progress information
    if (this.state.formatProgress) {
      const formatProgress = this.state.formatProgress;
      summary += `\nFormats: ${formatProgress.completedFormats}/${formatProgress.totalFormats}`;

      if (this.state.currentFormat) {
        summary += ` | Current: ${this.state.currentFormat.toUpperCase()}`;
      }

      // Show format status summary
      const formatStatuses = Object.entries(formatProgress.formatResults);
      const successCount = formatStatuses.filter(([, status]) => status === 'success').length;
      const failedCount = formatStatuses.filter(([, status]) => status === 'failed').length;
      const processingCount = formatStatuses.filter(([, status]) => status === 'processing').length;

      if (successCount > 0 || failedCount > 0 || processingCount > 0) {
        const statusParts = [];
        if (successCount > 0) statusParts.push(`${successCount} ✓`);
        if (failedCount > 0) statusParts.push(`${failedCount} ✗`);
        if (processingCount > 0) statusParts.push(`${processingCount} ⏳`);

        if (statusParts.length > 0) {
          summary += ` (${statusParts.join(', ')})`;
        }
      }
    }

    return summary;
  }
}
