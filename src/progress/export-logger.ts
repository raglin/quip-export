import { EnhancedLogger, LoggerConfig } from '../core/logger';
import { AuditLogger, AuditLoggerConfig } from './audit-logger';
import { Logger } from '../types';
import * as path from 'path';

export interface ExportLoggerConfig {
  sessionId: string;
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  outputDirectory: string;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  enableAuditTrail: boolean;
  component?: string;
}

export interface ExportLogContext {
  documentId?: string;
  documentTitle?: string;
  folderName?: string;
  operation?: string;
  fileSize?: number;
  exportFormat?: string;
  processingTime?: number;
  error?: Error;
}

/**
 * Specialized logger for export operations with structured logging and audit trail
 */
export class ExportLogger {
  private logger: Logger;
  private auditLogger?: AuditLogger;
  private config: ExportLoggerConfig;

  constructor(config: ExportLoggerConfig) {
    this.config = config;

    // Initialize main logger
    const loggerConfig: Partial<LoggerConfig> = {
      level: config.logLevel,
      enableFileLogging: config.enableFileLogging,
      logDirectory: path.join(config.outputDirectory, 'logs'),
      enableConsole: config.enableConsoleLogging,
      sessionId: config.sessionId,
      component: config.component || 'EXPORT',
    };

    this.logger = new EnhancedLogger(loggerConfig);

    // Initialize audit logger if enabled
    if (config.enableAuditTrail) {
      const auditConfig: AuditLoggerConfig = {
        sessionId: config.sessionId,
        auditDirectory: path.join(config.outputDirectory, 'audit'),
        enableFileOutput: true,
        enableConsoleOutput: false,
      };

      this.auditLogger = new AuditLogger(auditConfig);
    }
  }

  /**
   * Log export session start
   */
  public logExportStart(totalDocuments: number, outputDirectory: string): void {
    this.logger.info('Export session started', {
      totalDocuments,
      outputDirectory,
      sessionId: this.config.sessionId,
    });

    this.auditLogger?.logExportSession('started', {
      totalDocuments,
    });
  }

  /**
   * Log export session completion
   */
  public logExportComplete(
    totalDocuments: number,
    successfulExports: number,
    failedExports: number,
    totalDataExported: number,
    duration: number
  ): void {
    const successRate = totalDocuments > 0 ? (successfulExports / totalDocuments) * 100 : 0;

    this.logger.info('Export session completed', {
      totalDocuments,
      successfulExports,
      failedExports,
      successRate: successRate.toFixed(1) + '%',
      totalDataExported: this.formatBytes(totalDataExported),
      duration: this.formatDuration(duration),
    });

    this.auditLogger?.logExportSession('completed', {
      totalDocuments,
      successfulExports,
      failedExports,
      totalDataExported,
      duration,
    });
  }

  /**
   * Log export session failure
   */
  public logExportFailure(error: Error, context?: ExportLogContext): void {
    this.logger.error('Export session failed', {
      error: error.message,
      stack: error.stack,
      context,
    });

    this.auditLogger?.logExportSession('failed', {
      error,
    });
  }

  /**
   * Log document export start
   */
  public logDocumentExportStart(
    documentId: string,
    documentTitle: string,
    folderName?: string
  ): void {
    this.logger.info('Starting document export', {
      documentId,
      documentTitle,
      folderName,
    });

    this.auditLogger?.logDocumentExport(documentId, documentTitle, 'started');
  }

  /**
   * Log document export success
   */
  public logDocumentExportSuccess(
    documentId: string,
    documentTitle: string,
    localPath: string,
    details: {
      fileSize?: number;
      exportFormat?: string;
      processingTime?: number;
    }
  ): void {
    this.logger.info('Document export completed', {
      documentId,
      documentTitle,
      localPath,
      fileSize: details.fileSize ? this.formatBytes(details.fileSize) : undefined,
      exportFormat: details.exportFormat,
      processingTime: details.processingTime
        ? this.formatDuration(details.processingTime)
        : undefined,
    });

    this.auditLogger?.logDocumentExport(documentId, documentTitle, 'completed', {
      format: details.exportFormat,
      fileSize: details.fileSize,
      duration: details.processingTime,
    });

    if (details.fileSize) {
      this.auditLogger?.logFileWrite(documentTitle, localPath, 'completed', {
        fileSize: details.fileSize,
        duration: details.processingTime,
      });
    }
  }

  /**
   * Log document export failure
   */
  public logDocumentExportFailure(
    documentId: string,
    documentTitle: string,
    error: Error,
    context?: ExportLogContext
  ): void {
    this.logger.error('Document export failed', {
      documentId,
      documentTitle,
      error: error.message,
      stack: error.stack,
      context,
    });

    this.auditLogger?.logDocumentExport(documentId, documentTitle, 'failed', {
      error,
    });
  }

  /**
   * Log folder processing
   */
  public logFolderProcessing(folderName: string, documentCount: number): void {
    this.logger.info('Processing folder', {
      folderName,
      documentCount,
    });
  }

  /**
   * Log folder creation
   */
  public logFolderCreation(folderPath: string, success: boolean, error?: Error): void {
    if (success) {
      this.logger.info('Folder created', { folderPath });
      this.auditLogger?.logFolderCreation(folderPath, 'completed');
    } else {
      this.logger.error('Folder creation failed', {
        folderPath,
        error: error?.message,
      });
      this.auditLogger?.logFolderCreation(folderPath, 'failed', error);
    }
  }

  /**
   * Log API calls to Quip
   */
  public logApiCall(
    endpoint: string,
    method: string,
    success: boolean,
    details?: {
      statusCode?: number;
      responseTime?: number;
      error?: Error;
    }
  ): void {
    if (success) {
      this.logger.debug('API call successful', {
        method,
        endpoint,
        statusCode: details?.statusCode,
        responseTime: details?.responseTime ? `${details.responseTime}ms` : undefined,
      });

      this.auditLogger?.logApiCall('quip', endpoint, method, 'completed', details);
    } else {
      this.logger.error('API call failed', {
        method,
        endpoint,
        statusCode: details?.statusCode,
        error: details?.error?.message,
      });

      this.auditLogger?.logApiCall('quip', endpoint, method, 'failed', details);
    }
  }

  /**
   * Log authentication events
   */
  public logAuthentication(
    success: boolean,
    method: 'personal_token' | 'oauth',
    error?: Error
  ): void {
    if (success) {
      this.logger.info('Authentication successful', { method });
      this.auditLogger?.logAuthenticationEvent('quip', 'completed');
    } else {
      this.logger.error('Authentication failed', {
        method,
        error: error?.message,
      });
      this.auditLogger?.logAuthenticationEvent('quip', 'failed', error);
    }
  }

  /**
   * Log document discovery
   */
  public logDocumentDiscovery(
    success: boolean,
    details?: {
      documentsFound?: number;
      foldersFound?: number;
      duration?: number;
      error?: Error;
    }
  ): void {
    if (success) {
      this.logger.info('Document discovery completed', {
        documentsFound: details?.documentsFound,
        foldersFound: details?.foldersFound,
        duration: details?.duration ? this.formatDuration(details.duration) : undefined,
      });

      this.auditLogger?.logDocumentDiscovery('completed', details);
    } else {
      this.logger.error('Document discovery failed', {
        error: details?.error?.message,
      });

      this.auditLogger?.logDocumentDiscovery('failed', details);
    }
  }

  /**
   * Log rate limiting events
   */
  public logRateLimit(endpoint: string, retryAfter?: number): void {
    this.logger.warn('Rate limit encountered', {
      endpoint,
      retryAfter: retryAfter ? `${retryAfter}ms` : undefined,
    });
  }

  /**
   * Log configuration events
   */
  public logConfiguration(config: Record<string, unknown>): void {
    // Remove sensitive information before logging
    const safeConfig = { ...config };
    delete safeConfig.personalAccessToken;
    delete safeConfig.clientSecret;

    this.logger.info('Export configuration', safeConfig);
  }

  /**
   * Log warnings
   */
  public logWarning(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, context);
  }

  /**
   * Log debug information
   */
  public logDebug(message: string, context?: any): void {
    this.logger.debug(message, context);
  }

  /**
   * Get the main logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get the audit logger instance
   */
  public getAuditLogger(): AuditLogger | undefined {
    return this.auditLogger;
  }

  /**
   * Get audit file path
   */
  public getAuditFilePath(): string | undefined {
    return this.auditLogger?.getAuditFilePath();
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
}
