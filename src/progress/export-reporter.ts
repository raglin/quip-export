import { ProgressState } from './progress-tracker';
import { AuditLogger, AuditEvent } from './audit-logger';
import { ExportLogger } from './export-logger';
import { LogAnalyzer, LogAnalysisResult } from './log-analyzer';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportReport {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  summary: ExportSummary;
  documentMappings: ExportDocumentMapping[];
  folderStructure: FolderStructureReport;
  errors: ExportErrorReport[];
  statistics: ExportStatistics;
  auditTrail?: AuditEvent[];
  logAnalysis?: LogAnalysisResult;
}

export interface ExportSummary {
  totalDocuments: number;
  successfulExports: number;
  failedExports: number;
  skippedDocuments: number;
  successRate: number;
  averageProcessingTime: number;
  totalDataExported: number; // in bytes
  exportSpeed: number; // bytes per second
  outputDirectory: string;
  exportFormats: string[];
  formatResults?: FormatSummary; // New multi-format summary
}

export interface FormatSummary {
  totalFormats: number;
  successfulFormats: number;
  failedFormats: number;
  formatSuccessRates: { [format: string]: number };
  formatCounts: { [format: string]: { success: number; failed: number; total: number } };
  formatDirectories: { [format: string]: string };
}

export interface ExportDocumentMapping {
  quipDocumentId: string;
  quipDocumentTitle: string;
  quipUrl: string;
  folderName?: string;
  localPath: string;
  relativePath: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  fileSize?: number;
  processingTime?: number;
  exportFormat?: string;
  createdAt: Date;
  formatResults?: { [format: string]: FormatExportResult }; // New multi-format results
}

export interface FormatExportResult {
  format: string;
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
  processingTime?: number;
}

export interface FolderStructureReport {
  rootDirectory: string;
  totalFolders: number;
  folderHierarchy: FolderNode[];
  documentDistribution: { [folderName: string]: number };
}

export interface FolderNode {
  name: string;
  path: string;
  documentCount: number;
  totalSize: number;
  children: FolderNode[];
}

export interface ExportErrorReport {
  timestamp: Date;
  documentId?: string;
  documentTitle?: string;
  folderName?: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExportStatistics {
  documentsPerHour: number;
  averageFileSize: number;
  largestFile: { title: string; size: number; path: string };
  smallestFile: { title: string; size: number; path: string };
  formatDistribution: { [format: string]: number };
  errorDistribution: { [errorType: string]: number };
  processingTimeDistribution: {
    under30s: number;
    under2min: number;
    under5min: number;
    over5min: number;
  };
  folderStatistics: {
    [folderName: string]: {
      documentCount: number;
      totalSize: number;
      averageSize: number;
      successRate: number;
    };
  };
}

export interface ExportReportOptions {
  includeAuditTrail: boolean;
  includeErrorDetails: boolean;
  includeStatistics: boolean;
  includeLogAnalysis: boolean;
  includeFolderStructure: boolean;
  outputFormat: 'json' | 'html' | 'csv' | 'markdown';
  outputDirectory: string;
  generateSummaryOnly: boolean;
}

/**
 * Comprehensive export reporting system for Quip bulk export operations
 */
export class ExportReporter {
  private logger: ExportLogger;
  private auditLogger?: AuditLogger;
  private documentMappings: Map<string, ExportDocumentMapping> = new Map();
  private errors: ExportErrorReport[] = [];
  private startTime: Date;
  private endTime?: Date;
  private outputDirectory: string;

  constructor(logger: ExportLogger, outputDirectory: string, auditLogger?: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.outputDirectory = outputDirectory;
    this.startTime = new Date();
  }

  /**
   * Record the start of a document export
   */
  public recordDocumentStart(
    quipDocumentId: string,
    quipDocumentTitle: string,
    quipUrl: string,
    folderName?: string
  ): void {
    const mapping: ExportDocumentMapping = {
      quipDocumentId,
      quipDocumentTitle,
      quipUrl,
      folderName,
      localPath: '',
      relativePath: '',
      status: 'skipped',
      createdAt: new Date()
    };
    
    this.documentMappings.set(quipDocumentId, mapping);
  }

  /**
   * Record successful document export
   */
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
      mapping.relativePath = path.relative(this.outputDirectory, localPath);
      mapping.fileSize = details.fileSize;
      mapping.processingTime = details.processingTime;
      mapping.exportFormat = details.exportFormat;
    }
  }

  /**
   * Record multi-format export results for a document
   */
  public recordMultiFormatResults(
    quipDocumentId: string,
    formatResults: { [format: string]: FormatExportResult }
  ): void {
    const mapping = this.documentMappings.get(quipDocumentId);
    if (mapping) {
      mapping.formatResults = formatResults;
      
      // Determine overall status based on format results
      const hasSuccess = Object.values(formatResults).some(result => result.success);
      const allFailed = Object.values(formatResults).every(result => !result.success);
      
      if (hasSuccess) {
        mapping.status = 'success';
        
        // Use the first successful format for legacy fields
        const firstSuccess = Object.values(formatResults).find(result => result.success);
        if (firstSuccess) {
          mapping.localPath = firstSuccess.filePath || '';
          mapping.relativePath = firstSuccess.filePath ? path.relative(this.outputDirectory, firstSuccess.filePath) : '';
          mapping.fileSize = firstSuccess.fileSize;
          mapping.exportFormat = firstSuccess.format;
        }
      } else if (allFailed) {
        mapping.status = 'failed';
        
        // Collect all errors
        const errors = Object.values(formatResults)
          .filter(result => result.error)
          .map(result => `${result.format}: ${result.error}`)
          .join('; ');
        mapping.error = errors || 'All formats failed';
      }
      
      // Calculate total processing time across all formats
      const totalProcessingTime = Object.values(formatResults)
        .reduce((total, result) => total + (result.processingTime || 0), 0);
      mapping.processingTime = totalProcessingTime;
    }
  }

  /**
   * Record failed document export
   */
  public recordDocumentFailure(
    quipDocumentId: string,
    error: Error,
    context?: any
  ): void {
    const mapping = this.documentMappings.get(quipDocumentId);
    if (mapping) {
      mapping.status = 'failed';
      mapping.error = error.message;
    }

    this.recordError(error, quipDocumentId, mapping?.quipDocumentTitle, mapping?.folderName, context);
  }

  /**
   * Record an error during export
   */
  public recordError(
    error: Error,
    documentId?: string,
    documentTitle?: string,
    folderName?: string,
    context?: any
  ): void {
    const severity = this.determineErrorSeverity(error, context);
    
    const errorReport: ExportErrorReport = {
      timestamp: new Date(),
      documentId,
      documentTitle,
      folderName,
      errorType: error.constructor.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      context,
      severity
    };

    this.errors.push(errorReport);
    this.logger.logDebug('Export error recorded', errorReport);
  }

  /**
   * Generate comprehensive export report
   */
  public async generateReport(
    finalState: ProgressState,
    options: Partial<ExportReportOptions> = {}
  ): Promise<ExportReport> {
    this.endTime = new Date();
    
    const reportOptions: ExportReportOptions = {
      includeAuditTrail: true,
      includeErrorDetails: true,
      includeStatistics: true,
      includeLogAnalysis: false,
      includeFolderStructure: true,
      outputFormat: 'html',
      outputDirectory: path.join(this.outputDirectory, 'reports'),
      generateSummaryOnly: false,
      ...options
    };

    // Gather audit events if available
    const auditEvents = reportOptions.includeAuditTrail && this.auditLogger
      ? await this.auditLogger.getAuditEvents()
      : [];

    // Generate log analysis if requested
    let logAnalysis: LogAnalysisResult | undefined;
    if (reportOptions.includeLogAnalysis) {
      try {
        const logDirectory = path.join(this.outputDirectory, 'logs');
        logAnalysis = await LogAnalyzer.analyzeLogDirectory(logDirectory);
      } catch (error) {
        this.logger.logWarning('Failed to generate log analysis', { error });
      }
    }

    const report: ExportReport = {
      sessionId: finalState.sessionId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime.getTime() - this.startTime.getTime(),
      summary: this.generateSummary(finalState),
      documentMappings: Array.from(this.documentMappings.values()),
      folderStructure: reportOptions.includeFolderStructure 
        ? this.generateFolderStructureReport() 
        : { rootDirectory: '', totalFolders: 0, folderHierarchy: [], documentDistribution: {} },
      errors: reportOptions.includeErrorDetails ? this.errors : [],
      statistics: reportOptions.includeStatistics ? this.generateStatistics() : {} as ExportStatistics,
      auditTrail: auditEvents,
      logAnalysis
    };

    await this.saveReport(report, reportOptions);
    return report;
  }

  /**
   * Generate quick summary report
   */
  public generateQuickSummary(finalState: ProgressState): string {
    const summary = this.generateSummary(finalState);
    const duration = this.formatDuration(Date.now() - this.startTime.getTime());
    
    let report = '# Export Summary\n\n';
    report += `**Session ID:** ${finalState.sessionId}\n`;
    report += `**Duration:** ${duration}\n`;
    report += `**Output Directory:** ${summary.outputDirectory}\n\n`;
    
    report += '## Results\n';
    report += `- **Total Documents:** ${summary.totalDocuments}\n`;
    report += `- **Successful Exports:** ${summary.successfulExports}\n`;
    report += `- **Failed Exports:** ${summary.failedExports}\n`;
    report += `- **Success Rate:** ${summary.successRate.toFixed(1)}%\n`;
    report += `- **Data Exported:** ${this.formatBytes(summary.totalDataExported)}\n`;
    
    if (summary.exportSpeed > 0) {
      report += `- **Average Speed:** ${this.formatBytes(summary.exportSpeed)}/s\n`;
    }

    // Add format-specific summary
    if (summary.formatResults && summary.formatResults.totalFormats > 0) {
      report += '\n## Format Results\n';
      report += `- **Total Format Exports:** ${summary.formatResults.totalFormats}\n`;
      report += `- **Successful Formats:** ${summary.formatResults.successfulFormats}\n`;
      report += `- **Failed Formats:** ${summary.formatResults.failedFormats}\n`;
      
      if (Object.keys(summary.formatResults.formatCounts).length > 0) {
        report += '\n### Format Breakdown\n';
        Object.entries(summary.formatResults.formatCounts).forEach(([format, counts]) => {
          const successRate = summary.formatResults!.formatSuccessRates[format];
          report += `- **${format.toUpperCase()}:** ${counts.success}/${counts.total} (${successRate.toFixed(1)}%)\n`;
        });
      }

      if (Object.keys(summary.formatResults.formatDirectories).length > 0) {
        report += '\n### Output Directories\n';
        Object.entries(summary.formatResults.formatDirectories).forEach(([format, directory]) => {
          report += `- **${format.toUpperCase()}:** ${directory || 'Root'}\n`;
        });
      }
    }
    
    if (this.errors.length > 0) {
      report += '\n## Errors\n';
      const criticalErrors = this.errors.filter(e => e.severity === 'critical').length;
      const highErrors = this.errors.filter(e => e.severity === 'high').length;
      
      if (criticalErrors > 0) {
        report += `- **Critical:** ${criticalErrors}\n`;
      }
      if (highErrors > 0) {
        report += `- **High:** ${highErrors}\n`;
      }
      report += `- **Total:** ${this.errors.length}\n`;
    }
    
    return report;
  }

  private generateSummary(state: ProgressState): ExportSummary {
    const mappings = Array.from(this.documentMappings.values());
    const successfulExports = mappings.filter(m => m.status === 'success').length;
    const failedExports = mappings.filter(m => m.status === 'failed').length;
    const skippedDocuments = mappings.filter(m => m.status === 'skipped').length;
    
    const totalDataExported = mappings
      .filter(m => m.status === 'success' && m.fileSize)
      .reduce((total, m) => total + (m.fileSize || 0), 0);

    const totalProcessingTime = mappings
      .filter(m => m.processingTime)
      .reduce((total, m) => total + (m.processingTime || 0), 0);

    const averageProcessingTime = mappings.length > 0 
      ? totalProcessingTime / mappings.length 
      : 0;

    const duration = this.endTime && this.startTime 
      ? (this.endTime.getTime() - this.startTime.getTime()) / 1000 // seconds
      : 1;

    const exportSpeed = totalDataExported / duration;

    const exportFormats = Array.from(new Set(
      mappings
        .filter(m => m.exportFormat)
        .map(m => m.exportFormat!)
    ));

    // Generate format summary for multi-format exports
    const formatSummary = this.generateFormatSummary(mappings);

    return {
      totalDocuments: state.totalDocuments,
      successfulExports,
      failedExports,
      skippedDocuments,
      successRate: state.totalDocuments > 0 
        ? (successfulExports / state.totalDocuments) * 100 
        : 0,
      averageProcessingTime,
      totalDataExported,
      exportSpeed,
      outputDirectory: this.outputDirectory,
      exportFormats,
      formatResults: formatSummary
    };
  }

  /**
   * Generate format-specific summary for multi-format exports
   */
  private generateFormatSummary(mappings: ExportDocumentMapping[]): FormatSummary {
    const formatCounts: { [format: string]: { success: number; failed: number; total: number } } = {};
    const formatSuccessRates: { [format: string]: number } = {};
    const formatDirectories: { [format: string]: string } = {};
    
    let totalFormats = 0;
    let successfulFormats = 0;
    let failedFormats = 0;

    // Analyze format results from multi-format exports
    mappings.forEach(mapping => {
      if (mapping.formatResults) {
        Object.values(mapping.formatResults).forEach(formatResult => {
          const format = formatResult.format;
          
          if (!formatCounts[format]) {
            formatCounts[format] = { success: 0, failed: 0, total: 0 };
          }
          
          formatCounts[format].total++;
          totalFormats++;
          
          if (formatResult.success) {
            formatCounts[format].success++;
            successfulFormats++;
            
            // Track format directory structure
            if (formatResult.filePath && !formatDirectories[format]) {
              const formatDir = path.dirname(formatResult.filePath);
              formatDirectories[format] = path.relative(this.outputDirectory, formatDir);
            }
          } else {
            formatCounts[format].failed++;
            failedFormats++;
          }
        });
      } else if (mapping.exportFormat) {
        // Handle legacy single-format exports
        const format = mapping.exportFormat;
        
        if (!formatCounts[format]) {
          formatCounts[format] = { success: 0, failed: 0, total: 0 };
        }
        
        formatCounts[format].total++;
        totalFormats++;
        
        if (mapping.status === 'success') {
          formatCounts[format].success++;
          successfulFormats++;
          
          if (mapping.localPath && !formatDirectories[format]) {
            const formatDir = path.dirname(mapping.localPath);
            formatDirectories[format] = path.relative(this.outputDirectory, formatDir);
          }
        } else {
          formatCounts[format].failed++;
          failedFormats++;
        }
      }
    });

    // Calculate success rates for each format
    Object.keys(formatCounts).forEach(format => {
      const counts = formatCounts[format];
      formatSuccessRates[format] = counts.total > 0 
        ? (counts.success / counts.total) * 100 
        : 0;
    });

    return {
      totalFormats,
      successfulFormats,
      failedFormats,
      formatSuccessRates,
      formatCounts,
      formatDirectories
    };
  }

  private generateFolderStructureReport(): FolderStructureReport {
    const mappings = Array.from(this.documentMappings.values());
    const folderMap = new Map<string, { count: number; size: number; paths: Set<string> }>();
    
    // Analyze folder distribution
    mappings.forEach(mapping => {
      const folderName = mapping.folderName || 'Root';
      const existing = folderMap.get(folderName) || { count: 0, size: 0, paths: new Set() };
      
      existing.count++;
      if (mapping.fileSize) {
        existing.size += mapping.fileSize;
      }
      if (mapping.localPath) {
        existing.paths.add(path.dirname(mapping.localPath));
      }
      
      folderMap.set(folderName, existing);
    });

    // Build folder hierarchy
    const folderHierarchy: FolderNode[] = [];
    const documentDistribution: { [folderName: string]: number } = {};
    
    folderMap.forEach((data, folderName) => {
      documentDistribution[folderName] = data.count;
      
      // Create folder node (simplified - could be enhanced for nested structures)
      const folderNode: FolderNode = {
        name: folderName,
        path: Array.from(data.paths)[0] || '',
        documentCount: data.count,
        totalSize: data.size,
        children: []
      };
      
      folderHierarchy.push(folderNode);
    });

    return {
      rootDirectory: this.outputDirectory,
      totalFolders: folderMap.size,
      folderHierarchy: folderHierarchy.sort((a, b) => b.documentCount - a.documentCount),
      documentDistribution
    };
  }

  private generateStatistics(): ExportStatistics {
    const mappings = Array.from(this.documentMappings.values());
    const successfulMappings = mappings.filter(m => m.status === 'success');
    
    const duration = this.endTime && this.startTime 
      ? (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60 * 60) // hours
      : 1;

    const documentsPerHour = mappings.length / duration;

    const fileSizes = successfulMappings
      .map(m => m.fileSize)
      .filter((size): size is number => size !== undefined);

    const averageFileSize = fileSizes.length > 0 
      ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length 
      : 0;

    const largestFile = successfulMappings.reduce((largest, mapping) => {
      if (!mapping.fileSize) return largest;
      if (!largest || mapping.fileSize > largest.size) {
        return { 
          title: mapping.quipDocumentTitle, 
          size: mapping.fileSize,
          path: mapping.relativePath
        };
      }
      return largest;
    }, null as { title: string; size: number; path: string } | null) || 
    { title: 'N/A', size: 0, path: '' };

    const smallestFile = successfulMappings.reduce((smallest, mapping) => {
      if (!mapping.fileSize) return smallest;
      if (!smallest || mapping.fileSize < smallest.size) {
        return { 
          title: mapping.quipDocumentTitle, 
          size: mapping.fileSize,
          path: mapping.relativePath
        };
      }
      return smallest;
    }, null as { title: string; size: number; path: string } | null) || 
    { title: 'N/A', size: 0, path: '' };

    const formatDistribution = successfulMappings.reduce((dist, mapping) => {
      const format = mapping.exportFormat || 'unknown';
      dist[format] = (dist[format] || 0) + 1;
      return dist;
    }, {} as { [format: string]: number });

    const errorDistribution = this.errors.reduce((dist, error) => {
      dist[error.errorType] = (dist[error.errorType] || 0) + 1;
      return dist;
    }, {} as { [errorType: string]: number });

    const processingTimes = successfulMappings
      .map(m => m.processingTime)
      .filter((time): time is number => time !== undefined);

    const processingTimeDistribution = processingTimes.reduce((dist, time) => {
      const seconds = time / 1000;
      if (seconds < 30) dist.under30s++;
      else if (seconds < 120) dist.under2min++;
      else if (seconds < 300) dist.under5min++;
      else dist.over5min++;
      return dist;
    }, { under30s: 0, under2min: 0, under5min: 0, over5min: 0 });

    // Folder statistics
    const folderStats: { [folderName: string]: any } = {};
    const folderGroups = new Map<string, ExportDocumentMapping[]>();
    
    mappings.forEach(mapping => {
      const folderName = mapping.folderName || 'Root';
      const existing = folderGroups.get(folderName) || [];
      existing.push(mapping);
      folderGroups.set(folderName, existing);
    });

    folderGroups.forEach((folderMappings, folderName) => {
      const successful = folderMappings.filter(m => m.status === 'success');
      const totalSize = successful.reduce((sum, m) => sum + (m.fileSize || 0), 0);
      
      folderStats[folderName] = {
        documentCount: folderMappings.length,
        totalSize,
        averageSize: successful.length > 0 ? totalSize / successful.length : 0,
        successRate: folderMappings.length > 0 ? (successful.length / folderMappings.length) * 100 : 0
      };
    });

    return {
      documentsPerHour,
      averageFileSize,
      largestFile,
      smallestFile,
      formatDistribution,
      errorDistribution,
      processingTimeDistribution,
      folderStatistics: folderStats
    };
  }

  private async saveReport(report: ExportReport, options: ExportReportOptions): Promise<void> {
    try {
      if (!fs.existsSync(options.outputDirectory)) {
        fs.mkdirSync(options.outputDirectory, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFileName = `export-report-${report.sessionId}-${timestamp}`;

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
        case 'markdown':
          await this.saveMarkdownReport(report, options.outputDirectory, baseFileName);
          break;
      }

      // Always save a quick summary
      const summaryPath = path.join(options.outputDirectory, `${baseFileName}-summary.md`);
      const quickSummary = this.generateQuickSummary({
        sessionId: report.sessionId,
        totalDocuments: report.summary.totalDocuments,
        processedDocuments: report.summary.successfulExports + report.summary.failedExports,
        successfulExports: report.summary.successfulExports,
        failedExports: report.summary.failedExports,
        startTime: report.startTime,
        lastUpdateTime: report.endTime
      } as ProgressState);
      
      fs.writeFileSync(summaryPath, quickSummary);

      this.logger.logDebug(`Export report saved to ${options.outputDirectory}`);
    } catch (error) {
      this.logger.logWarning('Failed to save export report', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private async saveJsonReport(
    report: ExportReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.json`);
    const jsonContent = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, jsonContent);
  }

  private async saveHtmlReport(
    report: ExportReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.html`);
    const htmlContent = this.generateHtmlReport(report);
    fs.writeFileSync(filePath, htmlContent);
  }

  private async saveCsvReport(
    report: ExportReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.csv`);
    const csvContent = this.generateCsvReport(report);
    fs.writeFileSync(filePath, csvContent);
  }

  private async saveMarkdownReport(
    report: ExportReport,
    directory: string,
    baseFileName: string
  ): Promise<void> {
    const filePath = path.join(directory, `${baseFileName}.md`);
    const markdownContent = this.generateMarkdownReport(report);
    fs.writeFileSync(filePath, markdownContent);
  }

  private generateHtmlReport(report: ExportReport): string {
    const successRate = report.summary.successRate.toFixed(1);
    const duration = this.formatDuration(report.duration);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Export Report - ${report.sessionId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 5px 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .stat-value { font-size: 2.5em; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .success { color: #27ae60; }
        .failed { color: #e74c3c; }
        .info { color: #3498db; }
        .warning { color: #f39c12; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; }
        .format-results { background: #e8f5e8; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .format-breakdown { font-size: 0.9em; }
        .format-breakdown .success { color: #27ae60; margin-right: 10px; }
        .format-breakdown .failed { color: #e74c3c; }
        .folder-structure { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .folder-item { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .error-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .chart { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Export Report</h1>
        <p><strong>Session ID:</strong> ${report.sessionId}</p>
        <p><strong>Start Time:</strong> ${report.startTime.toISOString()}</p>
        <p><strong>End Time:</strong> ${report.endTime.toISOString()}</p>
        <p><strong>Duration:</strong> ${duration}</p>
        <p><strong>Output Directory:</strong> ${report.summary.outputDirectory}</p>
    </div>

    <div class="summary">
        <div class="stat">
            <div class="stat-value info">${report.summary.totalDocuments}</div>
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
            <div class="stat-value info">${successRate}%</div>
            <div class="stat-label">Success Rate</div>
        </div>
        <div class="stat">
            <div class="stat-value info">${this.formatBytes(report.summary.totalDataExported)}</div>
            <div class="stat-label">Data Exported</div>
        </div>
        <div class="stat">
            <div class="stat-value info">${this.formatBytes(report.summary.exportSpeed)}/s</div>
            <div class="stat-label">Avg Speed</div>
        </div>
        ${report.summary.formatResults ? `
        <div class="stat">
            <div class="stat-value info">${report.summary.formatResults.totalFormats}</div>
            <div class="stat-label">Total Formats</div>
        </div>
        <div class="stat">
            <div class="stat-value success">${report.summary.formatResults.successfulFormats}</div>
            <div class="stat-label">Format Success</div>
        </div>
        ` : ''}
    </div>

    ${report.summary.formatResults && report.summary.formatResults.totalFormats > 0 ? `
    <div class="format-results">
        <h2>Format Export Results</h2>
        <p><strong>Total Format Exports:</strong> ${report.summary.formatResults.totalFormats}</p>
        <p><strong>Successful Formats:</strong> ${report.summary.formatResults.successfulFormats}</p>
        <p><strong>Failed Formats:</strong> ${report.summary.formatResults.failedFormats}</p>
        
        <h3>Format Breakdown</h3>
        <table>
            <thead>
                <tr>
                    <th>Format</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Total</th>
                    <th>Success Rate</th>
                    <th>Output Directory</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(report.summary.formatResults.formatCounts).map(([format, counts]) => `
                    <tr>
                        <td><strong>${format.toUpperCase()}</strong></td>
                        <td class="success">${counts.success}</td>
                        <td class="failed">${counts.failed}</td>
                        <td>${counts.total}</td>
                        <td>${report.summary.formatResults!.formatSuccessRates[format].toFixed(1)}%</td>
                        <td><small>${report.summary.formatResults!.formatDirectories[format] || 'Root'}</small></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${report.folderStructure.folderHierarchy.length > 0 ? `
    <div class="folder-structure">
        <h2>Folder Structure</h2>
        <p><strong>Root Directory:</strong> ${report.folderStructure.rootDirectory}</p>
        <p><strong>Total Folders:</strong> ${report.folderStructure.totalFolders}</p>
        ${report.folderStructure.folderHierarchy.map(folder => `
            <div class="folder-item">
                <strong>${folder.name}</strong> - ${folder.documentCount} documents (${this.formatBytes(folder.totalSize)})
                <br><small>${folder.path}</small>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <h2>Document Export Results</h2>
    <table>
        <thead>
            <tr>
                <th>Document</th>
                <th>Folder</th>
                <th>Status</th>
                <th>Formats</th>
                <th>Total Size</th>
                <th>Time</th>
            </tr>
        </thead>
        <tbody>
            ${report.documentMappings.map(mapping => {
                let formatInfo = 'N/A';
                let totalSize = mapping.fileSize || 0;
                
                if (mapping.formatResults) {
                    const formatEntries = Object.entries(mapping.formatResults);
                    const successfulFormats = formatEntries.filter(([, result]) => result.success);
                    const failedFormats = formatEntries.filter(([, result]) => !result.success);
                    
                    formatInfo = `
                        <div class="format-breakdown">
                            ${successfulFormats.length > 0 ? `<span class="success">✓ ${successfulFormats.map(([format]) => format.toUpperCase()).join(', ')}</span>` : ''}
                            ${failedFormats.length > 0 ? `<span class="failed">✗ ${failedFormats.map(([format]) => format.toUpperCase()).join(', ')}</span>` : ''}
                        </div>
                    `;
                    
                    // Calculate total size across all successful formats
                    totalSize = successfulFormats.reduce((sum, [, result]) => sum + (result.fileSize || 0), 0);
                } else if (mapping.exportFormat) {
                    formatInfo = mapping.exportFormat.toUpperCase();
                }
                
                return `
                    <tr>
                        <td><a href="${mapping.quipUrl}" target="_blank">${mapping.quipDocumentTitle}</a></td>
                        <td>${mapping.folderName || 'Root'}</td>
                        <td class="${mapping.status}">${mapping.status}</td>
                        <td>${formatInfo}</td>
                        <td>${totalSize > 0 ? this.formatBytes(totalSize) : 'N/A'}</td>
                        <td>${mapping.processingTime ? this.formatDuration(mapping.processingTime) : 'N/A'}</td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    ${report.errors.length > 0 ? `
    <div class="error-section">
        <h2>Errors (${report.errors.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Document</th>
                    <th>Folder</th>
                    <th>Error</th>
                    <th>Severity</th>
                </tr>
            </thead>
            <tbody>
                ${report.errors.map(error => `
                    <tr>
                        <td>${error.timestamp.toISOString()}</td>
                        <td>${error.documentTitle || 'N/A'}</td>
                        <td>${error.folderName || 'N/A'}</td>
                        <td>${error.errorMessage}</td>
                        <td class="${error.severity}">${error.severity}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${report.logAnalysis ? `
    <div class="log-analysis">
        <h2>Log Analysis</h2>
        <p>Comprehensive log analysis with ${report.logAnalysis.summary.totalLogEntries} log entries analyzed.</p>
        <!-- Additional log analysis details could be added here -->
    </div>
    ` : ''}
</body>
</html>`;
  }

  private generateCsvReport(report: ExportReport): string {
    const headers = [
      'Quip Document ID',
      'Document Title',
      'Quip URL',
      'Folder Name',
      'Local Path',
      'Relative Path',
      'Status',
      'File Size (bytes)',
      'Export Format',
      'Processing Time (ms)',
      'Created At',
      'Error Message'
    ];

    const rows = report.documentMappings.map(mapping => [
      mapping.quipDocumentId,
      `"${mapping.quipDocumentTitle}"`,
      mapping.quipUrl,
      `"${mapping.folderName || ''}"`,
      `"${mapping.localPath}"`,
      `"${mapping.relativePath}"`,
      mapping.status,
      mapping.fileSize || '',
      mapping.exportFormat || '',
      mapping.processingTime || '',
      mapping.createdAt.toISOString(),
      `"${mapping.error || ''}"`
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private generateMarkdownReport(report: ExportReport): string {
    const successRate = report.summary.successRate.toFixed(1);
    const duration = this.formatDuration(report.duration);
    
    let markdown = `# Export Report\n\n`;
    markdown += `**Session ID:** ${report.sessionId}  \n`;
    markdown += `**Duration:** ${duration}  \n`;
    markdown += `**Output Directory:** ${report.summary.outputDirectory}  \n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Documents | ${report.summary.totalDocuments} |\n`;
    markdown += `| Successful Exports | ${report.summary.successfulExports} |\n`;
    markdown += `| Failed Exports | ${report.summary.failedExports} |\n`;
    markdown += `| Success Rate | ${successRate}% |\n`;
    markdown += `| Data Exported | ${this.formatBytes(report.summary.totalDataExported)} |\n`;
    markdown += `| Average Speed | ${this.formatBytes(report.summary.exportSpeed)}/s |\n\n`;

    if (report.folderStructure.folderHierarchy.length > 0) {
      markdown += `## Folder Structure\n\n`;
      markdown += `**Root Directory:** ${report.folderStructure.rootDirectory}  \n`;
      markdown += `**Total Folders:** ${report.folderStructure.totalFolders}  \n\n`;
      
      report.folderStructure.folderHierarchy.forEach(folder => {
        markdown += `- **${folder.name}**: ${folder.documentCount} documents (${this.formatBytes(folder.totalSize)})\n`;
      });
      markdown += '\n';
    }

    if (report.errors.length > 0) {
      markdown += `## Errors (${report.errors.length})\n\n`;
      const criticalErrors = report.errors.filter(e => e.severity === 'critical');
      const highErrors = report.errors.filter(e => e.severity === 'high');
      
      if (criticalErrors.length > 0) {
        markdown += `### Critical Errors (${criticalErrors.length})\n\n`;
        criticalErrors.slice(0, 5).forEach(error => {
          markdown += `- **${error.documentTitle || 'Unknown'}**: ${error.errorMessage}\n`;
        });
        markdown += '\n';
      }
      
      if (highErrors.length > 0) {
        markdown += `### High Priority Errors (${highErrors.length})\n\n`;
        highErrors.slice(0, 5).forEach(error => {
          markdown += `- **${error.documentTitle || 'Unknown'}**: ${error.errorMessage}\n`;
        });
        markdown += '\n';
      }
    }

    return markdown;
  }

  private determineErrorSeverity(error: Error, context?: any): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    
    // Check context for severity hints
    if (context?.severity) {
      return context.severity;
    }
    
    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    
    if (message.includes('authentication') || message.includes('unauthorized') || 
        message.includes('permission') || message.includes('access denied')) {
      return 'high';
    }
    
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('rate limit') || message.includes('quota')) {
      return 'medium';
    }
    
    return 'low';
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