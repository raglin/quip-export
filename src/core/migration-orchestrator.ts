// Main migration orchestrator that coordinates the entire migration process

import { v4 as uuidv4 } from 'uuid';
import {
  MigrationConfig,
  MigrationState,
  MigrationReport,
  QuipDocument,
  ProgressCallback,
} from '../types';
import {
  IMigrationOrchestrator,
  IBatchProcessor,
  IStateManager,
  IErrorHandler,
} from './interfaces';
import { StateManager } from './state-manager';
// import { BatchProcessor } from './batch-processor';
// import { ErrorHandler } from './error-handler';
import { ConfigManager } from './config-manager';
import { MemoryManager } from './memory-manager';
import { CircuitBreaker } from './retry-utility';
import { MigrationSession, BatchProcessingOptions } from './types';

export class MigrationOrchestrator implements IMigrationOrchestrator {
  private readonly stateManager: IStateManager;
  private readonly batchProcessor: IBatchProcessor;
  private readonly errorHandler: IErrorHandler;
  private readonly circuitBreaker: CircuitBreaker;
  private activeSessions = new Map<string, MigrationSession>();
  private progressCallback?: ProgressCallback;

  constructor(
    stateManager?: IStateManager,
    batchProcessor?: IBatchProcessor,
    errorHandler?: IErrorHandler
  ) {
    this.stateManager = stateManager || new StateManager();
    // TODO: Fix batch processor and error handler initialization
    this.batchProcessor = batchProcessor || ({} as IBatchProcessor);
    this.errorHandler = errorHandler || ({} as IErrorHandler);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 30000,
    });

    // Set up progress callback for batch processor
    this.batchProcessor.setProgressCallback((progress) => {
      if (this.progressCallback) {
        this.progressCallback(progress);
      }
    });
  }

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Start a new migration
   */
  async startMigration(config: MigrationConfig, documents: QuipDocument[]): Promise<string> {
    // Validate configuration
    const configValidation = await new ConfigManager().validateConfig(config);
    if (!configValidation.isValid) {
      throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
    }

    // Sanitize configuration
    const sanitizedConfig = ConfigManager.sanitizeConfig(config);

    // Generate session ID
    const sessionId = uuidv4();

    // Check memory recommendations
    const memoryRecommendations = MemoryManager.getMemoryRecommendations();
    if (memoryRecommendations.warnings.length > 0) {
      console.warn('Memory warnings:', memoryRecommendations.warnings);
    }

    // Adjust batch size based on memory if needed
    if (memoryRecommendations.memoryStatus === 'low') {
      sanitizedConfig.batchSize = Math.min(
        sanitizedConfig.batchSize,
        memoryRecommendations.recommendedBatchSize
      );
    }

    // Create migration session
    const session = await this.stateManager.createSession(sessionId, sanitizedConfig, documents);
    this.activeSessions.set(sessionId, session);

    // Start migration process
    this.executeMigration(sessionId).catch((error) => {
      console.error(`Migration ${sessionId} failed:`, error);
    });

    return sessionId;
  }

  /**
   * Resume an interrupted migration
   */
  async resumeMigration(sessionId: string): Promise<void> {
    const session = await this.stateManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`Migration session ${sessionId} not found`);
    }

    this.activeSessions.set(sessionId, session);

    // Resume migration from where it left off
    await this.executeMigration(sessionId);
  }

  /**
   * Pause an active migration
   */
  async pauseMigration(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Active migration session ${sessionId} not found`);
    }

    // Pause the batch processor
    // TODO: Fix batch processor pause method
    // if (this.batchProcessor instanceof BatchProcessor) {
    //   this.batchProcessor.pause();
    // }

    // Update session state
    session.state.lastUpdateTime = new Date();
    await this.stateManager.updateSession(sessionId, { state: session.state });
  }

  /**
   * Get current migration state
   */
  async getMigrationState(sessionId: string): Promise<MigrationState> {
    const session = await this.stateManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`Migration session ${sessionId} not found`);
    }

    return session.state;
  }

  /**
   * Generate migration report
   */
  async generateReport(sessionId: string): Promise<MigrationReport> {
    const session = await this.stateManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`Migration session ${sessionId} not found`);
    }

    const state = session.state;
    const duration = state.lastUpdateTime.getTime() - state.startTime.getTime();

    return {
      sessionId,
      totalDocuments: state.totalDocuments,
      successfulMigrations: state.successfulMigrations,
      failedMigrations: state.failedMigrations,
      duration,
      errors: state.errors,
      documentMappings: [], // This would be populated with actual mappings
    };
  }

  /**
   * Execute the migration process
   */
  private async executeMigration(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found in active sessions`);
    }

    try {
      // Get documents that haven't been processed yet
      const remainingDocuments = this.getRemainingDocuments(session);

      if (remainingDocuments.length === 0) {
        await this.completeMigration(sessionId);
        return;
      }

      // Prepare batch processing options
      const batchOptions: BatchProcessingOptions = {
        batchSize: session.config.batchSize,
        concurrency: MemoryManager.getMemoryRecommendations().recommendedConcurrency,
        delayBetweenBatches: session.config.retryDelay,
      };

      // Process documents in batches with circuit breaker protection
      await this.circuitBreaker.execute(async () => {
        const result = await this.batchProcessor.processBatch(remainingDocuments, batchOptions);

        // Update session state
        session.state.processedDocuments += result.processedCount;
        session.state.successfulMigrations += result.processedCount - result.errors.length;
        session.state.failedMigrations += result.errors.length;
        session.state.lastUpdateTime = new Date();

        // Add errors to session
        result.errors.forEach((error) => {
          session.state.errors.push({
            documentId: error.documentId,
            documentTitle: this.getDocumentTitle(error.documentId, session.documents),
            error: error.error,
            timestamp: new Date(),
            retryCount: 0,
          });
        });

        // Save updated state
        await this.stateManager.updateSession(sessionId, { state: session.state });

        return result;
      });

      // Check if migration is complete
      if (session.state.processedDocuments >= session.state.totalDocuments) {
        await this.completeMigration(sessionId);
      }
    } catch (error) {
      await this.handleMigrationError(sessionId, error as Error);
    }
  }

  /**
   * Get documents that haven't been processed yet
   */
  private getRemainingDocuments(session: MigrationSession): QuipDocument[] {
    // This is a simplified implementation
    // In a real scenario, you'd track which specific documents have been processed
    const processedCount = session.state.processedDocuments;
    return session.documents.slice(processedCount);
  }

  /**
   * Get document title by ID
   */
  private getDocumentTitle(documentId: string, documents: QuipDocument[]): string {
    const document = documents.find((doc) => doc.id === documentId);
    return document?.title || 'Unknown Document';
  }

  /**
   * Complete migration process
   */
  private async completeMigration(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    session.state.lastUpdateTime = new Date();
    await this.stateManager.updateSession(sessionId, { state: session.state });

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Notify completion
    if (this.progressCallback) {
      this.progressCallback({
        current: session.state.totalDocuments,
        total: session.state.totalDocuments,
        percentage: 100,
        currentItem: 'Migration completed',
      });
    }

    console.log(`Migration ${sessionId} completed successfully`);
  }

  /**
   * Handle migration errors
   */
  private async handleMigrationError(sessionId: string, error: Error): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    // Use error handler to determine if we should retry
    const shouldRetry = await this.errorHandler.handleError(error, {
      operation: 'migration',
      timestamp: new Date(),
    });

    if (shouldRetry) {
      // Retry the migration after a delay
      setTimeout(() => {
        this.executeMigration(sessionId).catch((retryError) => {
          console.error(`Migration retry failed for ${sessionId}:`, retryError);
        });
      }, session.config.retryDelay);
    } else {
      // Migration failed permanently
      session.state.errors.push({
        documentId: 'migration-orchestrator',
        documentTitle: 'Migration Process',
        error: error.message,
        timestamp: new Date(),
        retryCount: 0,
      });

      session.state.lastUpdateTime = new Date();
      await this.stateManager.updateSession(sessionId, { state: session.state });

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      console.error(`Migration ${sessionId} failed permanently:`, error);
    }
  }

  /**
   * Get all active migration sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Get migration statistics
   */
  async getMigrationStatistics(sessionId: string): Promise<{
    totalDocuments: number;
    processedDocuments: number;
    successfulMigrations: number;
    failedMigrations: number;
    progressPercentage: number;
    estimatedTimeRemaining?: number;
    averageProcessingTime?: number;
  }> {
    const state = await this.getMigrationState(sessionId);
    const progressPercentage = Math.round((state.processedDocuments / state.totalDocuments) * 100);

    // Calculate average processing time
    const elapsedTime = state.lastUpdateTime.getTime() - state.startTime.getTime();
    const averageProcessingTime =
      state.processedDocuments > 0 ? elapsedTime / state.processedDocuments : 0;

    // Estimate remaining time
    const remainingDocuments = state.totalDocuments - state.processedDocuments;
    const estimatedTimeRemaining =
      remainingDocuments > 0 && averageProcessingTime > 0
        ? remainingDocuments * averageProcessingTime
        : undefined;

    return {
      totalDocuments: state.totalDocuments,
      processedDocuments: state.processedDocuments,
      successfulMigrations: state.successfulMigrations,
      failedMigrations: state.failedMigrations,
      progressPercentage,
      estimatedTimeRemaining,
      averageProcessingTime,
    };
  }

  /**
   * Clean up completed or failed sessions
   */
  async cleanupSessions(olderThanDays: number = 7): Promise<number> {
    const sessions = await this.stateManager.listSessions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let cleanedCount = 0;

    for (const sessionId of sessions) {
      const session = await this.stateManager.loadSession(sessionId);
      if (session && session.updatedAt < cutoffDate) {
        await this.stateManager.deleteState(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
