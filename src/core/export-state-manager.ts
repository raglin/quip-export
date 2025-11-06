// Export state management for tracking export sessions and progress

import { Logger } from '../types';
import { 
  ExportState, 
  ExportConfig, 
  ExportSession, 
  ExportError, 
  ExportProgress,
  ExportSummary,
  ExportStatus,
  FolderSummary
} from './export-types';

/**
 * Manages export session state, progress tracking, and configuration
 */
export class ExportStateManager {
  private readonly logger: Logger;
  private currentSession: ExportSession | null = null;
  private readonly progressCallbacks: Array<(progress: ExportProgress) => void> = [];
  private readonly stateChangeCallbacks: Array<(state: ExportState) => void> = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create a new export session
   */
  createSession(config: ExportConfig): ExportSession {
    const sessionId = this.generateSessionId();
    
    const initialState: ExportState = {
      sessionId,
      totalDocuments: 0,
      processedDocuments: 0,
      successfulExports: 0,
      failedExports: 0,
      errors: [],
      startTime: new Date(),
      lastUpdateTime: new Date(),
      outputDirectory: config.outputDirectory,
      status: 'initializing'
    };

    const session: ExportSession = {
      id: sessionId,
      config,
      state: initialState,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentSession = session;
    this.logger.info(`Created export session: ${sessionId}`);
    
    return session;
  }

  /**
   * Get the current export session
   */
  getCurrentSession(): ExportSession | null {
    return this.currentSession;
  }

  /**
   * Update export configuration
   */
  updateConfig(config: Partial<ExportConfig>): void {
    if (!this.currentSession) {
      throw new Error('No active export session');
    }

    this.currentSession.config = {
      ...this.currentSession.config,
      ...config
    };
    
    this.currentSession.updatedAt = new Date();
    this.logger.debug('Updated export configuration');
  }

  /**
   * Update export state
   */
  updateState(stateUpdate: Partial<ExportState>): void {
    if (!this.currentSession) {
      throw new Error('No active export session');
    }

    this.currentSession.state = {
      ...this.currentSession.state,
      ...stateUpdate,
      lastUpdateTime: new Date()
    };
    
    this.currentSession.updatedAt = new Date();

    // Notify state change callbacks
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(this.currentSession!.state);
      } catch (error) {
        this.logger.warn(`State change callback error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Update progress if relevant fields changed
    if (
      stateUpdate.processedDocuments !== undefined ||
      stateUpdate.totalDocuments !== undefined ||
      stateUpdate.currentDocument !== undefined ||
      stateUpdate.currentFolder !== undefined
    ) {
      this.notifyProgress();
    }

    this.logger.debug(`Updated export state: ${JSON.stringify(stateUpdate)}`);
  }

  /**
   * Set export status
   */
  setStatus(status: ExportStatus): void {
    this.updateState({ status });
    this.logger.info(`Export status changed to: ${status}`);
  }

  /**
   * Initialize export with document count
   */
  initializeExport(totalDocuments: number): void {
    this.updateState({
      totalDocuments,
      status: 'discovering'
    });
  }

  /**
   * Start the export process
   */
  startExport(): void {
    this.updateState({
      status: 'exporting',
      startTime: new Date()
    });
  }

  /**
   * Mark a document as being processed
   */
  startDocumentExport(_documentId: string, documentTitle: string, folderPath: string, formats?: string[]): void {
    this.updateState({
      currentDocument: documentTitle,
      currentFolder: folderPath,
      currentFormats: formats
    });
  }

  /**
   * Mark a format export as starting
   */
  startFormatExport(_documentId: string, format: string): void {
    this.updateState({
      currentFormat: format,
      currentOperation: `Exporting as ${format.toUpperCase()}`
    });
  }

  /**
   * Mark a format export as completed
   */
  completeFormatExport(_documentId: string, format: string, success: boolean, error?: Error): void {
    // This method can be used to track format-specific completion
    // For now, we'll just update the current operation
    if (success) {
      this.updateState({
        currentOperation: `Completed ${format.toUpperCase()} export`
      });
    } else {
      this.updateState({
        currentOperation: `Failed ${format.toUpperCase()} export: ${error?.message || 'Unknown error'}`
      });
    }
  }

  /**
   * Mark a document export as completed successfully
   */
  completeDocumentExport(_documentId: string, _filePath: string, _fileSize: number): void {
    const state = this.currentSession!.state;
    
    this.updateState({
      processedDocuments: state.processedDocuments + 1,
      successfulExports: state.successfulExports + 1
    });
  }

  /**
   * Mark a document export as failed
   */
  failDocumentExport(
    documentId: string, 
    documentTitle: string, 
    folderPath: string, 
    error: string,
    retryCount: number = 0
  ): void {
    const state = this.currentSession!.state;
    
    const exportError: ExportError = {
      documentId,
      documentTitle,
      folderPath,
      error,
      timestamp: new Date(),
      retryCount
    };

    this.updateState({
      processedDocuments: state.processedDocuments + 1,
      failedExports: state.failedExports + 1,
      errors: [...state.errors, exportError]
    });
  }

  /**
   * Complete the export process
   */
  completeExport(): void {
    this.updateState({
      status: 'completed',
      currentDocument: undefined,
      currentFolder: undefined
    });
    
    this.logger.info('Export completed successfully');
  }

  /**
   * Fail the export process
   */
  failExport(error: string): void {
    this.updateState({
      status: 'failed'
    });
    
    this.logger.error(`Export failed: ${error}`);
  }

  /**
   * Cancel the export process
   */
  cancelExport(): void {
    this.updateState({
      status: 'cancelled'
    });
    
    this.logger.info('Export cancelled by user');
  }

  /**
   * Get current export progress
   */
  getProgress(): ExportProgress {
    if (!this.currentSession) {
      throw new Error('No active export session');
    }

    const state = this.currentSession.state;
    const percentage = state.totalDocuments > 0 
      ? Math.round((state.processedDocuments / state.totalDocuments) * 100)
      : 0;

    const progress: ExportProgress = {
      sessionId: state.sessionId,
      current: state.processedDocuments,
      total: state.totalDocuments,
      percentage,
      currentItem: state.currentDocument,
      currentFolder: state.currentFolder
    };

    // Calculate estimated time remaining and export speed
    if (state.processedDocuments > 0) {
      const elapsedTime = Date.now() - state.startTime.getTime();
      const documentsPerMs = state.processedDocuments / elapsedTime;
      const remainingDocuments = state.totalDocuments - state.processedDocuments;
      
      progress.estimatedTimeRemaining = remainingDocuments / documentsPerMs;
      progress.exportSpeed = documentsPerMs * 60000; // documents per minute
    }

    return progress;
  }

  /**
   * Generate export summary
   */
  generateSummary(folderSummaries: FolderSummary[] = []): ExportSummary {
    if (!this.currentSession) {
      throw new Error('No active export session');
    }

    const state = this.currentSession.state;
    const config = this.currentSession.config;
    
    const duration = Date.now() - state.startTime.getTime();
    const totalSize = folderSummaries.reduce((sum, folder) => sum + folder.totalSize, 0);
    const skippedDocuments = Math.max(0, state.totalDocuments - state.processedDocuments);

    return {
      sessionId: state.sessionId,
      totalDocuments: state.totalDocuments,
      successfulExports: state.successfulExports,
      failedExports: state.failedExports,
      skippedDocuments,
      outputDirectory: state.outputDirectory,
      totalSize,
      duration,
      exportFormat: config.exportFormat,
      errors: state.errors,
      folderStructure: folderSummaries
    };
  }

  /**
   * Register a progress callback
   */
  onProgress(callback: (progress: ExportProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Register a state change callback
   */
  onStateChange(callback: (state: ExportState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Remove a progress callback
   */
  removeProgressCallback(callback: (progress: ExportProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove a state change callback
   */
  removeStateChangeCallback(callback: (state: ExportState) => void): void {
    const index = this.stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Validate export configuration
   */
  validateConfig(config: ExportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate output directory
    if (!config.outputDirectory || config.outputDirectory.trim().length === 0) {
      errors.push('Output directory is required');
    }

    // Validate export format
    if (!['native', 'html', 'markdown'].includes(config.exportFormat)) {
      errors.push('Export format must be one of: native, html, markdown');
    }

    // Validate max documents
    if (config.maxDocuments !== undefined && config.maxDocuments <= 0) {
      errors.push('Max documents must be greater than 0');
    }

    // Validate rate limit delay
    if (config.rateLimitDelay < 0) {
      errors.push('Rate limit delay cannot be negative');
    }

    // Validate retry attempts
    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      errors.push('Retry attempts must be between 0 and 10');
    }

    // Validate conflict resolution
    if (!['number', 'timestamp', 'overwrite'].includes(config.conflictResolution)) {
      errors.push('Conflict resolution must be number, timestamp, or overwrite');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get export statistics
   */
  getStatistics(): {
    totalSessions: number;
    currentSession: ExportSession | null;
    averageExportSpeed?: number;
    successRate?: number;
  } {
    const stats = {
      totalSessions: this.currentSession ? 1 : 0,
      currentSession: this.currentSession
    };

    if (this.currentSession) {
      const state = this.currentSession.state;
      
      if (state.processedDocuments > 0) {
        const elapsedTime = Date.now() - state.startTime.getTime();
        const averageExportSpeed = (state.processedDocuments / elapsedTime) * 60000; // per minute
        const successRate = (state.successfulExports / state.processedDocuments) * 100;
        
        return {
          ...stats,
          averageExportSpeed,
          successRate
        };
      }
    }

    return stats;
  }

  /**
   * Clear the current session
   */
  clearSession(): void {
    this.currentSession = null;
    this.progressCallbacks.length = 0;
    this.stateChangeCallbacks.length = 0;
    this.logger.debug('Cleared export session');
  }

  /**
   * Notify progress callbacks
   */
  private notifyProgress(): void {
    if (this.progressCallbacks.length === 0) {
      return;
    }

    const progress = this.getProgress();
    
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        this.logger.warn(`Progress callback error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `export_${timestamp}_${random}`;
  }
}