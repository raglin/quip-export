import { Logger } from '../types';
import { EnhancedLogger } from '../core/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  sessionId: string;
  eventType: AuditEventType;
  source: string;
  target?: string;
  operation: string;
  status: 'started' | 'completed' | 'failed';
  details?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

export type AuditEventType =
  | 'authentication'
  | 'document_discovery'
  | 'document_export'
  | 'file_write'
  | 'folder_creation'
  | 'export_session'
  | 'api_call'
  | 'file_operation';

export interface AuditLoggerConfig {
  sessionId: string;
  auditDirectory: string;
  enableFileOutput: boolean;
  enableConsoleOutput: boolean;
}

export class AuditLogger {
  private logger: Logger;
  private config: AuditLoggerConfig;
  private auditFilePath: string = '';
  private eventCounter: number = 0;

  constructor(config: AuditLoggerConfig) {
    this.config = config;
    this.logger = new EnhancedLogger({
      level: 'INFO',
      enableFileLogging: false,
      enableConsole: config.enableConsoleOutput,
      sessionId: config.sessionId,
      component: 'AUDIT',
    });

    if (config.enableFileOutput) {
      this.initializeAuditFile();
    }
  }

  public logEvent(
    eventType: AuditEventType,
    operation: string,
    status: 'started' | 'completed' | 'failed',
    details?: {
      source?: string;
      target?: string;
      metadata?: any;
      error?: Error;
      duration?: number;
    }
  ): void {
    const eventId = this.generateEventId();
    const event: AuditEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      sessionId: this.config.sessionId,
      eventType,
      source: details?.source || 'unknown',
      target: details?.target,
      operation,
      status,
      details: details?.metadata,
      error: details?.error?.message,
      duration: details?.duration,
    };

    this.writeAuditEvent(event);
    this.logToConsole(event);
  }

  public logAuthenticationEvent(
    service: 'quip' | 'onedrive',
    status: 'started' | 'completed' | 'failed',
    error?: Error
  ): void {
    this.logEvent('authentication', `${service}_auth`, status, {
      source: service,
      error,
    });
  }

  public logDocumentDiscovery(
    status: 'started' | 'completed' | 'failed',
    details?: {
      documentsFound?: number;
      foldersFound?: number;
      error?: Error;
      duration?: number;
    }
  ): void {
    this.logEvent('document_discovery', 'list_documents', status, {
      source: 'quip',
      metadata: {
        documentsFound: details?.documentsFound,
        foldersFound: details?.foldersFound,
      },
      error: details?.error,
      duration: details?.duration,
    });
  }

  public logDocumentExport(
    documentId: string,
    documentTitle: string,
    status: 'started' | 'completed' | 'failed',
    details?: {
      format?: string;
      fileSize?: number;
      error?: Error;
      duration?: number;
    }
  ): void {
    this.logEvent('document_export', 'export_document', status, {
      source: `quip:${documentId}`,
      target: documentTitle,
      metadata: {
        format: details?.format,
        fileSize: details?.fileSize,
      },
      error: details?.error,
      duration: details?.duration,
    });
  }

  public logFileWrite(
    documentTitle: string,
    localPath: string,
    status: 'started' | 'completed' | 'failed',
    details?: {
      fileSize?: number;
      error?: Error;
      duration?: number;
    }
  ): void {
    this.logEvent('file_write', 'write_file', status, {
      source: documentTitle,
      target: `local:${localPath}`,
      metadata: {
        fileSize: details?.fileSize,
      },
      error: details?.error,
      duration: details?.duration,
    });
  }

  public logFolderCreation(
    folderPath: string,
    status: 'started' | 'completed' | 'failed',
    error?: Error
  ): void {
    this.logEvent('folder_creation', 'create_folder', status, {
      target: `local:${folderPath}`,
      error,
    });
  }

  public logExportSession(
    status: 'started' | 'completed' | 'failed',
    details?: {
      totalDocuments?: number;
      successfulExports?: number;
      failedExports?: number;
      totalDataExported?: number;
      duration?: number;
      error?: Error;
    }
  ): void {
    this.logEvent('export_session', 'export_documents', status, {
      metadata: {
        totalDocuments: details?.totalDocuments,
        successfulExports: details?.successfulExports,
        failedExports: details?.failedExports,
        totalDataExported: details?.totalDataExported,
      },
      error: details?.error,
      duration: details?.duration,
    });
  }

  public logApiCall(
    service: 'quip',
    endpoint: string,
    method: string,
    status: 'started' | 'completed' | 'failed',
    details?: {
      statusCode?: number;
      responseTime?: number;
      error?: Error;
    }
  ): void {
    this.logEvent('api_call', `${method} ${endpoint}`, status, {
      source: service,
      metadata: {
        statusCode: details?.statusCode,
        responseTime: details?.responseTime,
      },
      error: details?.error,
      duration: details?.responseTime,
    });
  }

  public getAuditFilePath(): string | undefined {
    return this.auditFilePath;
  }

  public async getAuditEvents(
    eventType?: AuditEventType,
    status?: 'started' | 'completed' | 'failed'
  ): Promise<AuditEvent[]> {
    if (!this.auditFilePath || !fs.existsSync(this.auditFilePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.auditFilePath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      let events: AuditEvent[] = lines.map((line) => JSON.parse(line));

      if (eventType) {
        events = events.filter((event) => event.eventType === eventType);
      }

      if (status) {
        events = events.filter((event) => event.status === status);
      }

      return events;
    } catch (error) {
      this.logger.error('Failed to read audit events', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private initializeAuditFile(): void {
    try {
      if (!fs.existsSync(this.config.auditDirectory)) {
        fs.mkdirSync(this.config.auditDirectory, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.auditFilePath = path.join(
        this.config.auditDirectory,
        `audit-${this.config.sessionId}-${timestamp}.jsonl`
      );

      // Initialize file with session start event
      this.logExportSession('started');
    } catch (error) {
      this.logger.error('Failed to initialize audit file', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.config.enableFileOutput = false;
    }
  }

  private writeAuditEvent(event: AuditEvent): void {
    if (!this.config.enableFileOutput || !this.auditFilePath) {
      return;
    }

    try {
      const eventLine = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.auditFilePath, eventLine);
    } catch (error) {
      this.logger.error('Failed to write audit event', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private logToConsole(event: AuditEvent): void {
    if (!this.config.enableConsoleOutput) {
      return;
    }

    const message = `${event.eventType.toUpperCase()}: ${event.operation} - ${event.status}`;
    const meta = {
      eventId: event.eventId,
      source: event.source,
      target: event.target,
      duration: event.duration,
      error: event.error,
    };

    switch (event.status) {
      case 'failed':
        this.logger.error(message, meta);
        break;
      case 'started':
        this.logger.debug(message, meta);
        break;
      case 'completed':
        this.logger.info(message, meta);
        break;
    }
  }

  private generateEventId(): string {
    this.eventCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.eventCounter.toString(36).padStart(3, '0');
    return `${this.config.sessionId.substring(0, 8)}-${timestamp}-${counter}`;
  }
}
