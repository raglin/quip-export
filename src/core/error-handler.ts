// Comprehensive error handling system for export operations

import { Logger } from '../types';

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  API_RATE_LIMIT = 'api_rate_limit',
  API_NETWORK = 'api_network',
  API_SERVER = 'api_server',
  API_CLIENT = 'api_client',
  FILE_SYSTEM = 'file_system',
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  MEMORY = 'memory',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  SKIP = 'skip',
  FALLBACK = 'fallback',
  ABORT = 'abort',
  MANUAL = 'manual',
}

export interface ErrorContext {
  operation: string;
  documentId?: string;
  documentTitle?: string;
  folderPath?: string;
  filePath?: string;
  batchIndex?: number;
  attemptNumber?: number;
  timestamp: Date;
  metadata?: any;
}

export interface CategorizedError {
  originalError: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  context: ErrorContext;
  isRetryable: boolean;
  maxRetries: number;
  retryDelay: number;
  message: string;
  userMessage: string;
  technicalDetails: string;
}

export interface ErrorRecoveryResult {
  success: boolean;
  action: 'retry' | 'skip' | 'fallback' | 'abort';
  delay?: number;
  fallbackData?: any;
  message?: string;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  retriedErrors: number;
  skippedErrors: number;
  abortedOperations: number;
  recoveredErrors: number;
}

/**
 * Comprehensive error handling system with categorization and recovery strategies
 */
export class ErrorHandler {
  private readonly logger: Logger;
  private readonly statistics: ErrorStatistics;
  private readonly errorHistory: CategorizedError[] = [];
  private readonly maxHistorySize: number;

  constructor(logger: Logger, maxHistorySize = 1000) {
    this.logger = logger;
    this.maxHistorySize = maxHistorySize;
    this.statistics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      retriedErrors: 0,
      skippedErrors: 0,
      abortedOperations: 0,
      recoveredErrors: 0,
    };

    // Initialize counters
    Object.values(ErrorCategory).forEach((category) => {
      this.statistics.errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach((severity) => {
      this.statistics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * Categorize and handle an error
   */
  async handleError(error: Error, context: ErrorContext): Promise<CategorizedError> {
    const categorizedError = this.categorizeError(error, context);

    // Update statistics
    this.updateStatistics(categorizedError);

    // Add to history
    this.addToHistory(categorizedError);

    // Log the error
    this.logError(categorizedError);

    return categorizedError;
  }

  /**
   * Determine recovery strategy for an error
   */
  async determineRecovery(categorizedError: CategorizedError): Promise<ErrorRecoveryResult> {
    const { category, severity, recoveryStrategy, context, isRetryable, maxRetries, retryDelay } =
      categorizedError;

    switch (recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        if (isRetryable && (context.attemptNumber || 0) < maxRetries) {
          this.statistics.retriedErrors++;
          return {
            success: true,
            action: 'retry',
            delay: this.calculateRetryDelay(retryDelay, context.attemptNumber || 0),
            message: `Retrying operation after ${retryDelay}ms delay`,
          };
        }
      // Fall through to skip if max retries exceeded

      case RecoveryStrategy.SKIP:
        this.statistics.skippedErrors++;
        return {
          success: true,
          action: 'skip',
          message: `Skipping operation due to ${category} error`,
        };

      case RecoveryStrategy.FALLBACK:
        {
          const fallbackResult = await this.attemptFallback(categorizedError);
          if (fallbackResult.success) {
            this.statistics.recoveredErrors++;
            return {
              success: true,
              action: 'fallback',
              fallbackData: fallbackResult.data,
              message: fallbackResult.message,
            };
          }
          // Fall through to skip if fallback fails
        }
        this.statistics.skippedErrors++;
        return {
          success: true,
          action: 'skip',
          message: 'Fallback failed, skipping operation',
        };

      case RecoveryStrategy.ABORT:
        this.statistics.abortedOperations++;
        return {
          success: false,
          action: 'abort',
          message: `Aborting due to ${severity} ${category} error`,
        };

      case RecoveryStrategy.MANUAL:
        return {
          success: false,
          action: 'abort',
          message: 'Manual intervention required',
        };

      default:
        this.statistics.skippedErrors++;
        return {
          success: true,
          action: 'skip',
          message: 'Unknown recovery strategy, skipping',
        };
    }
  }

  /**
   * Check if an operation should be aborted based on error patterns
   */
  shouldAbortOperation(): boolean {
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes

    // Abort if too many critical errors
    const criticalErrors = recentErrors.filter((e) => e.severity === ErrorSeverity.CRITICAL);
    if (criticalErrors.length >= 3) {
      this.logger.error('Aborting operation due to multiple critical errors');
      return true;
    }

    // Abort if too many authentication errors
    const authErrors = recentErrors.filter((e) => e.category === ErrorCategory.AUTHENTICATION);
    if (authErrors.length >= 5) {
      this.logger.error('Aborting operation due to persistent authentication issues');
      return true;
    }

    // Abort if error rate is too high
    if (recentErrors.length >= 20) {
      this.logger.error('Aborting operation due to high error rate');
      return true;
    }

    return false;
  }

  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    return { ...this.statistics };
  }

  /**
   * Get recent errors within time window
   */
  getRecentErrors(timeWindowMs: number): CategorizedError[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.errorHistory.filter((error) => error.context.timestamp >= cutoff);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): CategorizedError[] {
    return this.errorHistory.filter((error) => error.category === category);
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory.length = 0;
    this.resetStatistics();
  }

  /**
   * Generate error report
   */
  generateErrorReport(): {
    summary: ErrorStatistics;
    recentErrors: CategorizedError[];
    recommendations: string[];
  } {
    const recentErrors = this.getRecentErrors(3600000); // Last hour
    const recommendations = this.generateRecommendations();

    return {
      summary: this.getStatistics(),
      recentErrors,
      recommendations,
    };
  }

  /**
   * Categorize an error based on its properties
   */
  private categorizeError(error: Error, context: ErrorContext): CategorizedError {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let recoveryStrategy = RecoveryStrategy.RETRY;
    let isRetryable = true;
    let maxRetries = 3;
    let retryDelay = 1000;

    // Authentication errors
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('access denied') ||
      error.name === 'AuthenticationError'
    ) {
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = RecoveryStrategy.ABORT;
      isRetryable = false;
    }

    // Rate limiting errors
    else if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429') ||
      errorMessage.includes('quota exceeded')
    ) {
      category = ErrorCategory.API_RATE_LIMIT;
      severity = ErrorSeverity.MEDIUM;
      recoveryStrategy = RecoveryStrategy.RETRY;
      maxRetries = 5;
      retryDelay = 5000; // Longer delay for rate limits
    }

    // Network errors
    else if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('econnreset') ||
      errorName.includes('network')
    ) {
      category = ErrorCategory.API_NETWORK;
      severity = ErrorSeverity.MEDIUM;
      recoveryStrategy = RecoveryStrategy.RETRY;
      maxRetries = 3;
      retryDelay = 2000;
    }

    // Server errors (5xx)
    else if (
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('internal server error') ||
      errorMessage.includes('bad gateway') ||
      errorMessage.includes('service unavailable')
    ) {
      category = ErrorCategory.API_SERVER;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = RecoveryStrategy.RETRY;
      maxRetries = 3;
      retryDelay = 3000;
    }

    // Client errors (4xx)
    else if (
      errorMessage.includes('400') ||
      errorMessage.includes('404') ||
      errorMessage.includes('bad request') ||
      errorMessage.includes('not found')
    ) {
      category = ErrorCategory.API_CLIENT;
      severity = ErrorSeverity.MEDIUM;
      recoveryStrategy = RecoveryStrategy.SKIP;
      isRetryable = false;
    }

    // File system errors
    else if (
      errorMessage.includes('enoent') ||
      errorMessage.includes('eacces') ||
      errorMessage.includes('emfile') ||
      errorMessage.includes('enospc') ||
      errorMessage.includes('file') ||
      errorMessage.includes('directory') ||
      errorMessage.includes('permission')
    ) {
      category = ErrorCategory.FILE_SYSTEM;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = RecoveryStrategy.RETRY;
      maxRetries = 2;
      retryDelay = 1000;
    }

    // Memory errors
    else if (
      errorMessage.includes('out of memory') ||
      errorMessage.includes('heap') ||
      errorMessage.includes('memory')
    ) {
      category = ErrorCategory.MEMORY;
      severity = ErrorSeverity.CRITICAL;
      recoveryStrategy = RecoveryStrategy.ABORT;
      isRetryable = false;
    }

    // Timeout errors
    else if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
      category = ErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      recoveryStrategy = RecoveryStrategy.RETRY;
      maxRetries = 2;
      retryDelay = 5000;
    }

    // Validation errors
    else if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('malformed')
    ) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
      recoveryStrategy = RecoveryStrategy.SKIP;
      isRetryable = false;
    }

    // Configuration errors
    else if (
      errorMessage.includes('config') ||
      errorMessage.includes('setting') ||
      errorMessage.includes('parameter')
    ) {
      category = ErrorCategory.CONFIGURATION;
      severity = ErrorSeverity.HIGH;
      recoveryStrategy = RecoveryStrategy.ABORT;
      isRetryable = false;
    }

    const userMessage = this.generateUserMessage(category, severity, context);
    const technicalDetails = this.generateTechnicalDetails(error, category, context);

    return {
      originalError: error,
      category,
      severity,
      recoveryStrategy,
      context,
      isRetryable,
      maxRetries,
      retryDelay,
      message: error.message,
      userMessage,
      technicalDetails,
    };
  }

  /**
   * Update error statistics
   */
  private updateStatistics(error: CategorizedError): void {
    this.statistics.totalErrors++;
    this.statistics.errorsByCategory[error.category]++;
    this.statistics.errorsBySeverity[error.severity]++;
  }

  /**
   * Add error to history with size limit
   */
  private addToHistory(error: CategorizedError): void {
    this.errorHistory.push(error);

    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: CategorizedError): void {
    const logMessage = `${error.category.toUpperCase()} error in ${error.context.operation}`;
    const logMeta = {
      category: error.category,
      severity: error.severity,
      recoveryStrategy: error.recoveryStrategy,
      context: error.context,
      message: error.message,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(logMessage, logMeta);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logMessage, logMeta);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logMessage, logMeta);
        break;
      case ErrorSeverity.LOW:
        this.logger.debug(logMessage, logMeta);
        break;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(baseDelay: number, attemptNumber: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Attempt fallback recovery
   */
  private async attemptFallback(
    error: CategorizedError
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const { category, context } = error;

    switch (category) {
      case ErrorCategory.API_CLIENT:
        // Try alternative export format
        if (context.operation === 'document_export') {
          return {
            success: true,
            data: { alternativeFormat: 'html' },
            message: 'Falling back to HTML export format',
          };
        }
        break;

      case ErrorCategory.FILE_SYSTEM:
        // Try alternative file path
        if (context.filePath) {
          const alternativePath = context.filePath.replace(/[<>:"|?*]/g, '_');
          return {
            success: true,
            data: { alternativePath },
            message: 'Using sanitized file path',
          };
        }
        break;

      default:
        return { success: false };
    }

    return { success: false };
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(
    category: ErrorCategory,
    _severity: ErrorSeverity,
    context: ErrorContext
  ): string {
    const operation = context.operation.replace('_', ' ');
    const document = context.documentTitle ? ` for "${context.documentTitle}"` : '';

    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return `Authentication failed. Please check your credentials and try again.`;
      case ErrorCategory.API_RATE_LIMIT:
        return `Rate limit exceeded. The export will automatically retry with a delay.`;
      case ErrorCategory.API_NETWORK:
        return `Network connection issue during ${operation}${document}. Retrying...`;
      case ErrorCategory.API_SERVER:
        return `Server error during ${operation}${document}. This is usually temporary.`;
      case ErrorCategory.API_CLIENT:
        return `Invalid request during ${operation}${document}. This document may be corrupted or inaccessible.`;
      case ErrorCategory.FILE_SYSTEM:
        return `File system error during ${operation}${document}. Check disk space and permissions.`;
      case ErrorCategory.MEMORY:
        return `Out of memory during ${operation}. Try reducing batch size or closing other applications.`;
      case ErrorCategory.TIMEOUT:
        return `Operation timed out during ${operation}${document}. Retrying with longer timeout.`;
      case ErrorCategory.VALIDATION:
        return `Invalid data encountered during ${operation}${document}. Skipping this item.`;
      case ErrorCategory.CONFIGURATION:
        return `Configuration error. Please check your export settings.`;
      default:
        return `Unexpected error during ${operation}${document}.`;
    }
  }

  /**
   * Generate technical error details
   */
  private generateTechnicalDetails(
    error: Error,
    category: ErrorCategory,
    context: ErrorContext
  ): string {
    return JSON.stringify(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
        },
        category,
        context: {
          operation: context.operation,
          documentId: context.documentId,
          timestamp: context.timestamp.toISOString(),
          attemptNumber: context.attemptNumber,
        },
      },
      null,
      2
    );
  }

  /**
   * Generate recommendations based on error patterns
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.statistics;

    if (stats.errorsByCategory[ErrorCategory.AUTHENTICATION] > 0) {
      recommendations.push('Check your authentication credentials and ensure they are still valid');
    }

    if (stats.errorsByCategory[ErrorCategory.API_RATE_LIMIT] > 5) {
      recommendations.push('Consider increasing rate limit delays to reduce API throttling');
    }

    if (stats.errorsByCategory[ErrorCategory.API_NETWORK] > 10) {
      recommendations.push('Check your network connection stability');
    }

    if (stats.errorsByCategory[ErrorCategory.FILE_SYSTEM] > 5) {
      recommendations.push('Check available disk space and file system permissions');
    }

    if (stats.errorsByCategory[ErrorCategory.MEMORY] > 0) {
      recommendations.push('Reduce batch size or increase available memory');
    }

    if (stats.totalErrors > 50) {
      recommendations.push('Consider running the export in smaller batches');
    }

    return recommendations;
  }

  /**
   * Reset statistics
   */
  private resetStatistics(): void {
    this.statistics.totalErrors = 0;
    this.statistics.retriedErrors = 0;
    this.statistics.skippedErrors = 0;
    this.statistics.abortedOperations = 0;
    this.statistics.recoveredErrors = 0;

    Object.values(ErrorCategory).forEach((category) => {
      this.statistics.errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach((severity) => {
      this.statistics.errorsBySeverity[severity] = 0;
    });
  }
}
