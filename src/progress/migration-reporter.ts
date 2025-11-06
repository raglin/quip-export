import { ProgressState } from './progress-tracker';
import { AuditLogger, AuditEvent } from './audit-logger';
import { Logger } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationReport {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  summary: MigrationSummary;
  documentMappings: DocumentMapping[];
  errors: ErrorReport[];
  statistics: MigrationStatistics;
  auditTrail: AuditEvent[];
}

export interface MigrationSummary {
  totalDocuments: number;
  successfulExports: number;
  failedExports: number;
  skippedDocuments: number;
  successRate: number;
  averageProcessingTime: number;
  totalDataExported: number; // in bytes
  exportSpeed: number; // bytes per second
}

export interface DocumentMapping {
  quipDocumentId: string;
  quipDocumentTitle: string;
  quipUrl: string;
  localPath: string;
  folderName?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  fileSize?: number;
  processingTime?: number;
  exportFormat?: string;
}

export interface ErrorReport {
  timestamp: Date;
  documentId?: string;
  documentTitle?: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context?: any;
}

export interface MigrationStatistics {
  documentsPerHour: number;
  averageFileSize: number;
  largestFile: { title: string; size: number };
  smallestFile: { title: string; size: number };
  formatDistribution: { [format: string]: number };
  errorDistribution: { [errorType: string]: number };
  processingTimeDistribution: {
    under1min: number;
    under5min: number;
    under15min: number;
    over15min: number;
  };
}

export interface ReportOptions {
  includeAuditTrail: boolean;
  includeErrorDetails: boolean;
  includeStatistics: boolean;
  outputFormat: 'json' | 'html' | 'csv';
  outputDirectory: string;
}

export class MigrationReporter {
  private logger: Logger;
  private auditLogger: AuditLogger;
  private documentMappings: Map<string, DocumentMapping> = new Map();
  private errors: ErrorReport[] = [];
  private startTime: Date;
  private endTime?: Date;

  constructor(logger: Logger, auditLogger: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.startTime = new Date();
  }

  public recordDocumentStart(
    quipDocumentId: string,
    quipDocumentTitle: string,
    quipUrl: string,
    folderName?: string
  ): void {
    const mapping: DocumentMapping = {
      quipDocumentId,
      quipDocumentTitle,
      quipUrl,
      localPath: '',
      folderName,
      status: 'skipped',
    };

    this.documentMappings.set(quipDocumentId, mapping);
  }

  public recordDocumentSuccess(
    quipDocumentId: string,
    localPath: string,
    details: {
      fileSize?: number;
      processingTime?: number;
      exportFormat?: string;
    }
  ): void {
    const mapping = this.documentMappings.get(quipDocumentId);
    if (mapping) {
      mapping.status = 'success';
      mapping.localPath = localPath;
      mapping.fileSize = details.fileSize;
      mapping.processingTime = details.processingTime;
      mapping.exportFormat = details.exportFormat;
    }
  }

  public recordDocumentFailure(quipDocumentId: string, error: Error, context?: any): void {
    const mapping = this.documentMappings.get(quipDocumentId);
    if (mapping) {
      mapping.status = 'failed';
      mapping.error = error.message;
    }

    this.recordError(error, quipDocumentId, mapping?.quipDocumentTitle, context);
  }

  public recordError(
    error: Error,
    documentId?: string,
    documentTitle?: string,
    context?: any
  ): void {
    const errorReport: ErrorReport = {
      timestamp: new Date(),
      documentId,
      documentTitle,
      errorType: error.constructor.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      context,
    };

    this.errors.push(errorReport);
    this.logger.error('Migration error recorded', errorReport);
  }

  public async generateReport(
    finalState: ProgressState,
    options: Partial<ReportOptions> = {}
  ): Promise<MigrationReport> {
    this.endTime = new Date();

    const reportOptions: ReportOptions = {
      includeAuditTrail: true,
      includeErrorDetails: true,
      includeStatistics: true,
      outputFormat: 'json',
      outputDirectory: './reports',
      ...options,
    };

    const auditEvents = reportOptions.includeAuditTrail
      ? await this.auditLogger.getAuditEvents()
      : [];

    const report: MigrationReport = {
      sessionId: finalState.sessionId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime.getTime() - this.startTime.getTime(),
      summary: this.generateSummary(finalState),
      documentMappings: Array.from(this.documentMappings.values()),
      errors: reportOptions.includeErrorDetails ? this.errors : [],
      statistics: reportOptions.includeStatistics
        ? this.generateStatistics()
        : ({} as MigrationStatistics),
      auditTrail: auditEvents,
    };

    await this.saveReport(report, reportOptions);
    return report;
  }

  private generateSummary(state: ProgressState): MigrationSummary {
    const mappings = Array.from(this.documentMappings.values());
    const successfulExports = mappings.filter((m) => m.status === 'success').length;
    const failedExports = mappings.filter((m) => m.status === 'failed').length;
    const skippedDocuments = mappings.filter((m) => m.status === 'skipped').length;

    const totalDataExported = mappings
      .filter((m) => m.status === 'success' && m.fileSize)
      .reduce((total, m) => total + (m.fileSize || 0), 0);

    const totalProcessingTime = mappings
      .filter((m) => m.processingTime)
      .reduce((total, m) => total + (m.processingTime || 0), 0);

    const averageProcessingTime = mappings.length > 0 ? totalProcessingTime / mappings.length : 0;

    const duration =
      this.endTime && this.startTime
        ? (this.endTime.getTime() - this.startTime.getTime()) / 1000 // seconds
        : 1;

    const exportSpeed = totalDataExported / duration;

    return {
      totalDocuments: state.totalDocuments,
      successfulExports,
      failedExports,
      skippedDocuments,
      successRate: state.totalDocuments > 0 ? (successfulExports / state.totalDocuments) * 100 : 0,
      averageProcessingTime,
      totalDataExported,
      exportSpeed,
    };
  }

  private generateStatistics(): MigrationStatistics {
    const mappings = Array.from(this.documentMappings.values());
    const successfulMappings = mappings.filter((m) => m.status === 'success');

    const duration =
      this.endTime && this.startTime
        ? (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60 * 60) // hours
        : 1;

    const documentsPerHour = mappings.length / duration;

    const fileSizes = successfulMappings
      .map((m) => m.fileSize)
      .filter((size): size is number => size !== undefined);

    const averageFileSize =
      fileSizes.length > 0 ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length : 0;

    const largestFile = successfulMappings.reduce(
      (largest, mapping) => {
        if (!mapping.fileSize) return largest;
        if (!largest || mapping.fileSize > largest.size) {
          return { title: mapping.quipDocumentTitle, size: mapping.fileSize };
        }
        return largest;
      },
      null as { title: string; size: number } | null
    ) || { title: 'N/A', size: 0 };

    const smallestFile = successfulMappings.reduce(
      (smallest, mapping) => {
        if (!mapping.fileSize) return smallest;
        if (!smallest || mapping.fileSize < smallest.size) {
          return { title: mapping.quipDocumentTitle, size: mapping.fileSize };
        }
        return smallest;
      },
      null as { title: string; size: number } | null
    ) || { title: 'N/A', size: 0 };

    const formatDistribution = successfulMappings.reduce(
      (dist, mapping) => {
        const format = mapping.exportFormat || 'unknown';
        dist[format] = (dist[format] || 0) + 1;
        return dist;
      },
      {} as { [format: string]: number }
    );

    const errorDistribution = this.errors.reduce(
      (dist, error) => {
        dist[error.errorType] = (dist[error.errorType] || 0) + 1;
        return dist;
      },
      {} as { [errorType: string]: number }
    );

    const processingTimes = successfulMappings
      .map((m) => m.processingTime)
      .filter((time): time is number => time !== undefined);

    const processingTimeDistribution = processingTimes.reduce(
      (dist, time) => {
        const minutes = time / (1000 * 60);
        if (minutes < 1) dist.under1min++;
        else if (minutes < 5) dist.under5min++;
        else if (minutes < 15) dist.under15min++;
        else dist.over15min++;
        return dist;
      },
      { under1min: 0, under5min: 0, under15min: 0, over15min: 0 }
    );

    return {
      documentsPerHour,
      averageFileSize,
      largestFile,
      smallestFile,
      formatDistribution,
      errorDistribution,
      processingTimeDistribution,
    };
  }

  private async saveReport(report: MigrationReport, options: ReportOptions): Promise<void> {
    try {
      if (!fs.existsSync(options.outputDirectory)) {
        fs.mkdirSync(options.outputDirectory, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFileName = `migration-report-${report.sessionId}-${timestamp}`;

      switch (options.outputFormat) {
        case 'json':
          await this.saveJsonReport(report, options.outputDirectory, baseFileName);
          break;
        case 'html':
          await this.saveHtmlReport(report, options.outputDirectory, baseFileName);
          break;
        case 'csv':
          await this.saveCsvReport(report, options.outputDirectory, baseFileName);
          break;
      }

      this.logger.info(`Migration report saved to ${options.outputDirectory}`);
    } catch (error) {
      this.logger.error('Failed to save migration report', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async saveJsonReport(
    report: MigrationReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.json`);
    const jsonContent = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, jsonContent);
  }

  private async saveHtmlReport(
    report: MigrationReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.html`);
    const htmlContent = this.generateHtmlReport(report);
    fs.writeFileSync(filePath, htmlContent);
  }

  private async saveCsvReport(
    report: MigrationReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.csv`);
    const csvContent = this.generateCsvReport(report);
    fs.writeFileSync(filePath, csvContent);
  }

  private generateHtmlReport(report: MigrationReport): string {
    const successRate = report.summary.successRate.toFixed(1);
    const duration = this.formatDuration(report.duration);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Migration Report - ${report.sessionId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 10px; }
        .stat-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .stat-label { color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .success { color: green; }
        .failed { color: red; }
        .skipped { color: orange; }
        .error-section { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Migration Report</h1>
        <p><strong>Session ID:</strong> ${report.sessionId}</p>
        <p><strong>Start Time:</strong> ${report.startTime.toISOString()}</p>
        <p><strong>End Time:</strong> ${report.endTime.toISOString()}</p>
        <p><strong>Duration:</strong> ${duration}</p>
    </div>

    <div class="summary">
        <div class="stat">
            <div class="stat-value">${report.summary.totalDocuments}</div>
            <div class="stat-label">Total Documents</div>
        </div>
        <div class="stat">
            <div class="stat-value success">${report.summary.successfulExports}</div>
            <div class="stat-label">Exported</div>
        </div>
        <div class="stat">
            <div class="stat-value failed">${report.summary.failedExports}</div>
            <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
            <div class="stat-value">${successRate}%</div>
            <div class="stat-label">Success Rate</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.formatFileSize(report.summary.totalDataExported)}</div>
            <div class="stat-label">Data Exported</div>
        </div>
    </div>

    <h2>Document Mappings</h2>
    <table>
        <thead>
            <tr>
                <th>Quip Document</th>
                <th>Folder</th>
                <th>Local Path</th>
                <th>Status</th>
                <th>File Size</th>
                <th>Format</th>
                <th>Processing Time</th>
            </tr>
        </thead>
        <tbody>
            ${report.documentMappings
              .map(
                (mapping) => `
                <tr>
                    <td><a href="${mapping.quipUrl}" target="_blank">${mapping.quipDocumentTitle}</a></td>
                    <td>${mapping.folderName || 'N/A'}</td>
                    <td>${mapping.localPath}</td>
                    <td class="${mapping.status}">${mapping.status}</td>
                    <td>${mapping.fileSize ? this.formatFileSize(mapping.fileSize) : 'N/A'}</td>
                    <td>${mapping.exportFormat || 'N/A'}</td>
                    <td>${mapping.processingTime ? this.formatDuration(mapping.processingTime) : 'N/A'}</td>
                </tr>
            `
              )
              .join('')}
        </tbody>
    </table>

    ${
      report.errors.length > 0
        ? `
    <div class="error-section">
        <h2>Errors (${report.errors.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Document</th>
                    <th>Error Type</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                ${report.errors
                  .map(
                    (error) => `
                    <tr>
                        <td>${error.timestamp.toISOString()}</td>
                        <td>${error.documentTitle || 'N/A'}</td>
                        <td>${error.errorType}</td>
                        <td>${error.errorMessage}</td>
                    </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>
    </div>
    `
        : ''
    }
</body>
</html>`;
  }

  private generateCsvReport(report: MigrationReport): string {
    const headers = [
      'Quip Document ID',
      'Quip Document Title',
      'Quip URL',
      'Folder Name',
      'Local Path',
      'Status',
      'File Size (bytes)',
      'Export Format',
      'Processing Time (ms)',
      'Error Message',
    ];

    const rows = report.documentMappings.map((mapping) => [
      mapping.quipDocumentId,
      `"${mapping.quipDocumentTitle}"`,
      mapping.quipUrl,
      `"${mapping.folderName || ''}"`,
      `"${mapping.localPath}"`,
      mapping.status,
      mapping.fileSize || '',
      mapping.exportFormat || '',
      mapping.processingTime || '',
      `"${mapping.error || ''}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
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

  private formatFileSize(bytes: number): string {
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
