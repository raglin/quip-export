// Export orchestrator for managing batch processing and export operations

import { Logger } from '../types';
import { ExportStateManager } from './export-state-manager';
import { ExportConfig, ExportSession, DocumentExportTask } from './export-types';
import { DocumentDiscovery } from '../services/quip/document-discovery';
import { DocumentExporter } from '../services/quip/document-exporter';
import { FileWriter } from '../services/local/file-writer';
import { FolderStructureMapper } from '../services/local/folder-structure-mapper';
import { DirectoryManager } from '../services/local/directory-manager';
import { ErrorHandler } from './error-handler';
import { CircuitBreakerManager } from './circuit-breaker';
import { FileWriteResult } from '../services/local/types';

export interface BatchProcessingOptions {
  batchSize: number;
  concurrentBatches: number;
  rateLimitDelay: number;
  maxRetries: number;
  retryDelay: number;
  memoryThreshold: number; // MB
}

export interface ExportResult {
  success: boolean;
  totalDocuments: number;
  successfulExports: number;
  failedExports: number;
  skippedDocuments: number;
  errors: Array<{
    documentId: string;
    documentTitle: string;
    error: string;
  }>;
  outputDirectory: string;
  duration: number;
}

/**
 * Orchestrates the entire export process with batch processing and rate limiting
 */
export class ExportOrchestrator {
  private readonly logger: Logger;
  private readonly stateManager: ExportStateManager;
  private readonly documentDiscovery: DocumentDiscovery;
  private readonly documentExporter: DocumentExporter;
  private readonly fileWriter: FileWriter;
  private readonly folderMapper: FolderStructureMapper;
  private readonly directoryManager: DirectoryManager;
  private readonly errorHandler: ErrorHandler;
  private readonly circuitBreakerManager: CircuitBreakerManager;
  
  private isExporting = false;
  private shouldCancel = false;
  private currentBatch: DocumentExportTask[] = [];

  constructor(
    logger: Logger,
    stateManager: ExportStateManager,
    documentDiscovery: DocumentDiscovery,
    documentExporter: DocumentExporter,
    fileWriter: FileWriter,
    folderMapper: FolderStructureMapper,
    directoryManager: DirectoryManager
  ) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.documentDiscovery = documentDiscovery;
    this.documentExporter = documentExporter;
    this.fileWriter = fileWriter;
    this.folderMapper = folderMapper;
    this.directoryManager = directoryManager;
    this.errorHandler = new ErrorHandler(logger);
    this.circuitBreakerManager = new CircuitBreakerManager(logger, {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      successThreshold: 3,
      monitoringWindow: 300000, // 5 minutes
      minimumRequests: 3
    });
  }

  /**
   * Start the export process
   */
  async startExport(config: ExportConfig): Promise<ExportResult> {
    if (this.isExporting) {
      throw new Error('Export is already in progress');
    }

    this.isExporting = true;
    this.shouldCancel = false;

    try {
      // Create export session
      const session = this.stateManager.createSession(config);
      this.logger.info(`Starting export session: ${session.id}`);

      // Validate configuration
      const validation = this.stateManager.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Initialize export
      this.stateManager.setStatus('discovering');
      
      // Discover documents
      const documents = await this.discoverDocuments(config);
      this.stateManager.initializeExport(documents.length);

      if (documents.length === 0) {
        this.logger.warn('No documents found to export');
        this.stateManager.completeExport();
        return this.generateResult(session);
      }

      // Create output directory structure
      await this.setupOutputDirectory(config.outputDirectory);

      // Process documents in batches
      await this.processBatches(documents, config);

      // Complete export
      this.stateManager.completeExport();
      this.logger.info('Export completed successfully');

      return this.generateResult(session);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Export failed: ${errorMessage}`);
      this.stateManager.failExport(errorMessage);
      
      const session = this.stateManager.getCurrentSession();
      if (session) {
        return this.generateResult(session);
      }
      
      throw error;
    } finally {
      this.isExporting = false;
      this.shouldCancel = false;
    }
  }

  /**
   * Cancel the current export
   */
  async cancelExport(): Promise<void> {
    if (!this.isExporting) {
      throw new Error('No export in progress');
    }

    this.shouldCancel = true;
    this.logger.info('Export cancellation requested');
    
    // Wait for current batch to complete
    await this.waitForBatchCompletion();
    
    this.stateManager.cancelExport();
    this.logger.info('Export cancelled');
  }

  /**
   * Pause the current export
   */
  pauseExport(): void {
    if (!this.isExporting) {
      throw new Error('No export in progress');
    }

    this.stateManager.setStatus('paused');
    this.logger.info('Export paused');
  }

  /**
   * Resume a paused export
   */
  resumeExport(): void {
    const session = this.stateManager.getCurrentSession();
    if (!session || session.state.status !== 'paused') {
      throw new Error('No paused export to resume');
    }

    this.stateManager.setStatus('exporting');
    this.logger.info('Export resumed');
  }

  /**
   * Get current export status
   */
  getExportStatus(): {
    isExporting: boolean;
    session: ExportSession | null;
    progress: any;
    errorStats?: any;
    circuitBreakerStats?: any;
  } {
    const session = this.stateManager.getCurrentSession();
    const progress = session ? this.stateManager.getProgress() : null;

    return {
      isExporting: this.isExporting,
      session,
      progress,
      errorStats: this.errorHandler.getStatistics(),
      circuitBreakerStats: this.circuitBreakerManager.getAllStats()
    };
  }

  /**
   * Get comprehensive error report
   */
  getErrorReport(): {
    errorReport: any;
    circuitBreakerStats: any;
    recommendations: string[];
  } {
    const errorReport = this.errorHandler.generateErrorReport();
    const circuitBreakerStats = this.circuitBreakerManager.getAllStats();
    const openCircuits = this.circuitBreakerManager.getOpenCircuits();
    
    const recommendations = [...errorReport.recommendations];
    
    if (openCircuits.length > 0) {
      recommendations.push(`Circuit breakers are open for: ${openCircuits.join(', ')}. Wait for recovery or reset manually.`);
    }

    return {
      errorReport,
      circuitBreakerStats,
      recommendations
    };
  }

  /**
   * Reset error handling state
   */
  resetErrorHandling(): void {
    this.errorHandler.clearHistory();
    this.circuitBreakerManager.resetAll();
    this.logger.info('Reset error handling and circuit breakers');
  }

  /**
   * Discover documents to export
   */
  private async discoverDocuments(config: ExportConfig): Promise<DocumentExportTask[]> {
    this.logger.info('Discovering documents...');

    try {
      const discoveryResult = await this.documentDiscovery.discoverDocuments({
        includeShared: config.includeSharedDocuments,
        types: ['DOCUMENT', 'SPREADSHEET'],
        maxDocuments: config.maxDocuments // Pass the limit to optimize discovery
      });

      const tasks: DocumentExportTask[] = discoveryResult.documents.map((docWithPath, index) => ({
        documentId: docWithPath.document.id,
        documentTitle: docWithPath.document.title,
        documentType: docWithPath.document.type,
        folderPath: docWithPath.folderPath || 'Private',
        exportFormat: this.determineExportFormat(docWithPath.document.type, config.exportFormat),
        priority: index,
        retryCount: 0,
        status: 'pending'
      }));

      this.logger.info(`Discovered ${tasks.length} documents for export`);
      return tasks;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Document discovery failed: ${errorMessage}`);
    }
  }

  /**
   * Set up output directory structure
   */
  private async setupOutputDirectory(outputDirectory: string): Promise<void> {
    this.logger.info(`Setting up output directory: ${outputDirectory}`);

    try {
      await this.directoryManager.initializeBaseDirectory();
      this.logger.debug('Output directory created successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create output directory: ${errorMessage}`);
    }
  }

  /**
   * Process documents in batches with rate limiting
   */
  private async processBatches(tasks: DocumentExportTask[], config: ExportConfig): Promise<void> {
    const batchOptions: BatchProcessingOptions = {
      batchSize: this.calculateBatchSize(tasks.length),
      concurrentBatches: 1, // Start with sequential processing
      rateLimitDelay: config.rateLimitDelay,
      maxRetries: config.retryAttempts,
      retryDelay: Math.max(config.rateLimitDelay * 2, 1000),
      memoryThreshold: 500 // 500MB threshold
    };

    this.logger.info(`Processing ${tasks.length} documents in batches of ${batchOptions.batchSize}`);
    this.stateManager.startExport();

    const batches = this.createBatches(tasks, batchOptions.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      if (this.shouldCancel) {
        this.logger.info('Export cancelled during batch processing');
        break;
      }

      const batch = batches[i];
      this.currentBatch = batch;
      
      this.logger.debug(`Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      
      await this.processBatch(batch, config, batchOptions);
      
      // Rate limiting between batches
      if (i < batches.length - 1 && batchOptions.rateLimitDelay > 0) {
        await this.delay(batchOptions.rateLimitDelay);
      }

      // Check memory usage and pause if needed
      await this.checkMemoryUsage(batchOptions.memoryThreshold);
    }
  }

  /**
   * Process a single batch of documents
   */
  private async processBatch(
    batch: DocumentExportTask[], 
    config: ExportConfig, 
    options: BatchProcessingOptions
  ): Promise<void> {
    const promises = batch.map(task => this.processDocument(task, config, options));
    
    // Process documents in the batch concurrently but with limited concurrency
    await this.processConcurrently(promises, options.concurrentBatches);
  }

  /**
   * Process a single document with comprehensive error handling
   */
  private async processDocument(
    task: DocumentExportTask, 
    config: ExportConfig, 
    options: BatchProcessingOptions
  ): Promise<void> {
    if (this.shouldCancel) {
      task.status = 'skipped';
      return;
    }

    // Check if we should abort due to error patterns
    if (this.errorHandler.shouldAbortOperation()) {
      task.status = 'skipped';
      this.logger.warn(`Skipping document ${task.documentTitle} due to high error rate`);
      return;
    }

    task.status = 'in_progress';
    
    // Determine formats for this document
    const formats = this.getFormatsForDocument(task.documentType, config);
    
    this.stateManager.startDocumentExport(task.documentId, task.documentTitle, task.folderPath, formats);

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        // Use circuit breaker for document export with multi-format support
        const exportResult = await this.circuitBreakerManager.execute(
          'document-export',
          () => this.documentExporter.exportDocument(
            { id: task.documentId, title: task.documentTitle, type: task.documentType } as any,
            { 
              preferredFormat: formats[0] as ('native' | 'html' | 'markdown'), 
              fallbackToHtml: true, 
              includeMetadata: true 
            }
          )
        );

        if (!exportResult.success) {
          throw new Error(exportResult.error || 'Export failed');
        }

        // Determine local file path
        const folderMappingResult = await this.folderMapper.mapQuipFolder({
          id: 'folder-' + task.folderPath,
          name: task.folderPath,
          type: 'private',
          fullPath: task.folderPath
        });
        
        const localPath = folderMappingResult.localPath || config.outputDirectory;

        // Find the first successful format result to get the content
        const successfulFormat = exportResult.success ? exportResult : null;
        if (!successfulFormat || !successfulFormat.content) {
          throw new Error('No successful format with content found');
        }

        // Use circuit breaker for file writing
        const writeResult = await this.circuitBreakerManager.execute(
          'file-write',
          () => this.fileWriter.writeDocument(
            localPath,
            {
              fileName: task.documentTitle,
              content: successfulFormat.content!,
              documentType: task.documentType,
              exportFormat: successfulFormat.format as 'docx' | 'html' | 'xlsx' | 'markdown'
            }
          )
        ) as FileWriteResult;

        if (!writeResult.success) {
          throw new Error(writeResult.error || 'File write failed');
        }

        // Mark as completed
        task.status = 'completed';
        task.filePath = writeResult.filePath;
        task.fileSize = writeResult.size;
        task.exportedAt = new Date();

        this.stateManager.completeDocumentExport(
          task.documentId,
          writeResult.filePath!,
          writeResult.size || 0
        );

        this.logger.debug(`Successfully exported: ${task.documentTitle}`);
        return;

      } catch (error) {
        const errorContext = {
          operation: 'document_export',
          documentId: task.documentId,
          documentTitle: task.documentTitle,
          folderPath: task.folderPath,
          attemptNumber: attempt,
          timestamp: new Date()
        };

        const categorizedError = await this.errorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          errorContext
        );

        const recovery = await this.errorHandler.determineRecovery(categorizedError);

        if (!recovery.success || recovery.action === 'abort') {
          // Critical error - abort entire operation
          task.status = 'failed';
          task.error = categorizedError.userMessage;
          
          this.stateManager.failDocumentExport(
            task.documentId,
            task.documentTitle,
            task.folderPath,
            categorizedError.userMessage,
            attempt
          );

          this.logger.error(`Aborting export for ${task.documentTitle}: ${categorizedError.userMessage}`);
          return;
        }

        if (recovery.action === 'skip') {
          // Skip this document
          task.status = 'failed';
          task.error = categorizedError.userMessage;
          
          this.stateManager.failDocumentExport(
            task.documentId,
            task.documentTitle,
            task.folderPath,
            categorizedError.userMessage,
            attempt
          );

          this.logger.warn(`Skipping document ${task.documentTitle}: ${categorizedError.userMessage}`);
          return;
        }

        if (recovery.action === 'fallback' && recovery.fallbackData) {
          // Try fallback approach
          this.logger.info(`Using fallback for ${task.documentTitle}: ${recovery.message}`);
          
          if (recovery.fallbackData.alternativeFormat) {
            task.exportFormat = recovery.fallbackData.alternativeFormat;
          }
          
          // Continue with retry using fallback
        }

        if (recovery.action === 'retry') {
          if (attempt < options.maxRetries) {
            const delay = recovery.delay || (options.retryDelay * Math.pow(2, attempt));
            this.logger.warn(`Retrying ${task.documentTitle} in ${delay}ms (attempt ${attempt + 1}): ${categorizedError.userMessage}`);
            await this.delay(delay);
            continue;
          }
        }

        // If we get here, all retries are exhausted
        task.status = 'failed';
        task.error = categorizedError.userMessage;
        task.retryCount = attempt;
        
        this.stateManager.failDocumentExport(
          task.documentId,
          task.documentTitle,
          task.folderPath,
          categorizedError.userMessage,
          attempt
        );

        this.logger.error(`Failed to export after ${attempt + 1} attempts: ${task.documentTitle}`);
        return;
      }
    }
  }

  /**
   * Process promises with limited concurrency
   */
  private async processConcurrently<T>(promises: Promise<T>[], concurrency: number): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const p = promise.then(result => {
        results.push(result);
      });

      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === p), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Create batches from document tasks
   */
  private createBatches(tasks: DocumentExportTask[], batchSize: number): DocumentExportTask[][] {
    const batches: DocumentExportTask[][] = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Calculate optimal batch size based on document count
   */
  private calculateBatchSize(documentCount: number): number {
    if (documentCount <= 10) return 2;
    if (documentCount <= 50) return 5;
    if (documentCount <= 200) return 10;
    if (documentCount <= 1000) return 20;
    return 50;
  }

  /**
   * Determine export format based on document type and config
   */
  private determineExportFormat(
    documentType: string, 
    configFormat: 'native' | 'html' | 'markdown'
  ): 'docx' | 'html' | 'xlsx' | 'markdown' {
    // If native format is selected, use native format based on document type
    if (configFormat === 'native') {
      switch (documentType.toUpperCase()) {
        case 'DOCUMENT':
          return 'docx';  // Documents export to DOCX
        case 'SPREADSHEET':
          return 'xlsx';  // Spreadsheets export to XLSX
        default:
          // Fallback for unknown types
          return 'html';
      }
    }
    
    // For specific formats, validate compatibility and use if supported
    switch (documentType.toUpperCase()) {
      case 'DOCUMENT':
        if (['html', 'markdown'].includes(configFormat)) {
          return configFormat as 'html' | 'markdown';
        }
        return 'docx';  // Fallback to native format
      case 'SPREADSHEET':
        if (configFormat === 'html') {
          return 'html';
        }
        return 'xlsx';  // Fallback to native format
      default:
        return 'html';  // Fallback for unknown types
    }
  }

  /**
   * Check memory usage and pause if threshold exceeded
   */
  private async checkMemoryUsage(thresholdMB: number): Promise<void> {
    const usage = process.memoryUsage();
    const usedMB = usage.heapUsed / 1024 / 1024;

    if (usedMB > thresholdMB) {
      this.logger.warn(`Memory usage high (${Math.round(usedMB)}MB), forcing garbage collection`);
      
      if (global.gc) {
        global.gc();
      }
      
      // Brief pause to allow memory cleanup
      await this.delay(1000);
    }
  }

  /**
   * Wait for current batch to complete
   */
  private async waitForBatchCompletion(): Promise<void> {
    while (this.currentBatch.some(task => task.status === 'in_progress')) {
      await this.delay(100);
    }
  }

  /**
   * Generate export result
   */
  private generateResult(session: ExportSession): ExportResult {
    const summary = this.stateManager.generateSummary();
    
    return {
      success: session.state.status === 'completed',
      totalDocuments: summary.totalDocuments,
      successfulExports: summary.successfulExports,
      failedExports: summary.failedExports,
      skippedDocuments: summary.skippedDocuments,
      errors: summary.errors.map(error => ({
        documentId: error.documentId,
        documentTitle: error.documentTitle,
        error: error.error
      })),
      outputDirectory: summary.outputDirectory,
      duration: summary.duration
    };
  }

  /**
   * Get formats for a document based on type and configuration
   */
  private getFormatsForDocument(_documentType: string, config: ExportConfig): string[] {
    // Return the original format from config, not the resolved format
    // The DocumentExporter will handle the resolution internally
    return [config.exportFormat];
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}