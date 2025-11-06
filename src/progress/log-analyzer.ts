import { AuditEvent } from './audit-logger';
import { LogEntry } from '../core/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface LogAnalysisResult {
  summary: LogSummary;
  errorAnalysis: ErrorAnalysis;
  performanceAnalysis: PerformanceAnalysis;
  auditSummary?: AuditSummary;
}

export interface LogSummary {
  totalLogEntries: number;
  logLevelDistribution: { [level: string]: number };
  timeRange: {
    start: string;
    end: string;
    duration: number;
  };
  componentsActive: string[];
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorTypes: { [type: string]: number };
  criticalErrors: LogEntry[];
  errorTrends: { [hour: string]: number };
  mostCommonErrors: Array<{
    message: string;
    count: number;
    firstOccurrence: string;
    lastOccurrence: string;
  }>;
}

export interface PerformanceAnalysis {
  averageProcessingTime: number;
  slowestOperations: Array<{
    operation: string;
    duration: number;
    timestamp: string;
  }>;
  apiCallAnalysis: {
    totalCalls: number;
    averageResponseTime: number;
    failureRate: number;
    slowestEndpoints: Array<{
      endpoint: string;
      averageTime: number;
      callCount: number;
    }>;
  };
}

export interface AuditSummary {
  totalEvents: number;
  eventTypeDistribution: { [type: string]: number };
  operationSuccess: {
    successful: number;
    failed: number;
    successRate: number;
  };
  documentProcessing: {
    totalDocuments: number;
    successfulExports: number;
    failedExports: number;
    averageProcessingTime: number;
  };
}

/**
 * Analyzes export logs and audit trails to provide insights and troubleshooting information
 */
export class LogAnalyzer {
  /**
   * Analyze log files from a directory
   */
  public static async analyzeLogDirectory(logDirectory: string): Promise<LogAnalysisResult> {
    const logFiles = this.findLogFiles(logDirectory);
    const auditFiles = this.findAuditFiles(logDirectory);

    const logEntries = await this.parseLogFiles(logFiles);
    const auditEvents = await this.parseAuditFiles(auditFiles);

    return {
      summary: this.generateLogSummary(logEntries),
      errorAnalysis: this.analyzeErrors(logEntries),
      performanceAnalysis: this.analyzePerformance(logEntries, auditEvents),
      auditSummary: auditEvents.length > 0 ? this.generateAuditSummary(auditEvents) : undefined,
    };
  }

  /**
   * Analyze specific log file
   */
  public static async analyzeLogFile(logFilePath: string): Promise<LogAnalysisResult> {
    const logEntries = await this.parseLogFiles([logFilePath]);

    return {
      summary: this.generateLogSummary(logEntries),
      errorAnalysis: this.analyzeErrors(logEntries),
      performanceAnalysis: this.analyzePerformance(logEntries, []),
      auditSummary: undefined,
    };
  }

  /**
   * Generate troubleshooting report
   */
  public static generateTroubleshootingReport(analysis: LogAnalysisResult): string {
    let report = '# Export Log Analysis Report\n\n';

    // Summary
    report += '## Summary\n';
    report += `- Total log entries: ${analysis.summary.totalLogEntries}\n`;
    report += `- Time range: ${analysis.summary.timeRange.start} to ${analysis.summary.timeRange.end}\n`;
    report += `- Duration: ${this.formatDuration(analysis.summary.timeRange.duration)}\n`;
    report += `- Active components: ${analysis.summary.componentsActive.join(', ')}\n\n`;

    // Log levels
    report += '### Log Level Distribution\n';
    Object.entries(analysis.summary.logLevelDistribution).forEach(([level, count]) => {
      report += `- ${level}: ${count}\n`;
    });
    report += '\n';

    // Error Analysis
    report += '## Error Analysis\n';
    report += `- Total errors: ${analysis.errorAnalysis.totalErrors}\n`;

    if (analysis.errorAnalysis.totalErrors > 0) {
      report += '\n### Error Types\n';
      Object.entries(analysis.errorAnalysis.errorTypes).forEach(([type, count]) => {
        report += `- ${type}: ${count}\n`;
      });

      if (analysis.errorAnalysis.mostCommonErrors.length > 0) {
        report += '\n### Most Common Errors\n';
        analysis.errorAnalysis.mostCommonErrors.slice(0, 5).forEach((error, index) => {
          report += `${index + 1}. **${error.message}** (${error.count} occurrences)\n`;
          report += `   - First: ${error.firstOccurrence}\n`;
          report += `   - Last: ${error.lastOccurrence}\n\n`;
        });
      }

      if (analysis.errorAnalysis.criticalErrors.length > 0) {
        report += '\n### Critical Errors\n';
        analysis.errorAnalysis.criticalErrors.slice(0, 3).forEach((error, index) => {
          report += `${index + 1}. **${error.timestamp}**: ${error.message}\n`;
          if (error.meta?.stack) {
            report += `   Stack: ${error.meta.stack.split('\n')[0]}\n`;
          }
          report += '\n';
        });
      }
    }

    // Performance Analysis
    report += '## Performance Analysis\n';
    report += `- Average processing time: ${this.formatDuration(analysis.performanceAnalysis.averageProcessingTime)}\n`;

    if (analysis.performanceAnalysis.slowestOperations.length > 0) {
      report += '\n### Slowest Operations\n';
      analysis.performanceAnalysis.slowestOperations.slice(0, 5).forEach((op, index) => {
        report += `${index + 1}. ${op.operation}: ${this.formatDuration(op.duration)} (${op.timestamp})\n`;
      });
    }

    // API Analysis
    const apiAnalysis = analysis.performanceAnalysis.apiCallAnalysis;
    if (apiAnalysis.totalCalls > 0) {
      report += '\n### API Call Analysis\n';
      report += `- Total API calls: ${apiAnalysis.totalCalls}\n`;
      report += `- Average response time: ${apiAnalysis.averageResponseTime.toFixed(0)}ms\n`;
      report += `- Failure rate: ${(apiAnalysis.failureRate * 100).toFixed(1)}%\n`;

      if (apiAnalysis.slowestEndpoints.length > 0) {
        report += '\n#### Slowest Endpoints\n';
        apiAnalysis.slowestEndpoints.slice(0, 3).forEach((endpoint, index) => {
          report += `${index + 1}. ${endpoint.endpoint}: ${endpoint.averageTime.toFixed(0)}ms avg (${endpoint.callCount} calls)\n`;
        });
      }
    }

    // Audit Summary
    if (analysis.auditSummary) {
      report += '\n## Audit Summary\n';
      report += `- Total audit events: ${analysis.auditSummary.totalEvents}\n`;
      report += `- Success rate: ${analysis.auditSummary.operationSuccess.successRate.toFixed(1)}%\n`;

      if (analysis.auditSummary.documentProcessing.totalDocuments > 0) {
        report += '\n### Document Processing\n';
        report += `- Total documents: ${analysis.auditSummary.documentProcessing.totalDocuments}\n`;
        report += `- Successful exports: ${analysis.auditSummary.documentProcessing.successfulExports}\n`;
        report += `- Failed exports: ${analysis.auditSummary.documentProcessing.failedExports}\n`;
        report += `- Average processing time: ${this.formatDuration(analysis.auditSummary.documentProcessing.averageProcessingTime)}\n`;
      }
    }

    // Recommendations
    report += '\n## Recommendations\n';
    const recommendations = this.generateRecommendations(analysis);
    recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });

    return report;
  }

  private static findLogFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    return fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.log'))
      .map((file) => path.join(directory, file));
  }

  private static findAuditFiles(directory: string): string[] {
    const auditDir = path.join(directory, '..', 'audit');
    if (!fs.existsSync(auditDir)) return [];

    return fs
      .readdirSync(auditDir)
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => path.join(auditDir, file));
  }

  private static async parseLogFiles(logFiles: string[]): Promise<LogEntry[]> {
    const entries: LogEntry[] = [];

    for (const file of logFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content
          .trim()
          .split('\n')
          .filter((line) => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEntry;
            entries.push(entry);
          } catch {
            // Skip invalid JSON lines
          }
        }
      } catch (error) {
        console.warn(`Failed to parse log file ${file}:`, error);
      }
    }

    return entries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private static async parseAuditFiles(auditFiles: string[]): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];

    for (const file of auditFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content
          .trim()
          .split('\n')
          .filter((line) => line.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as AuditEvent;
            events.push(event);
          } catch {
            // Skip invalid JSON lines
          }
        }
      } catch (error) {
        console.warn(`Failed to parse audit file ${file}:`, error);
      }
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private static generateLogSummary(entries: LogEntry[]): LogSummary {
    const levelDistribution: { [level: string]: number } = {};
    const components = new Set<string>();

    let startTime = new Date();
    let endTime = new Date(0);

    entries.forEach((entry) => {
      levelDistribution[entry.level] = (levelDistribution[entry.level] || 0) + 1;

      if (entry.component) {
        components.add(entry.component);
      }

      const entryTime = new Date(entry.timestamp);
      if (entryTime < startTime) startTime = entryTime;
      if (entryTime > endTime) endTime = entryTime;
    });

    return {
      totalLogEntries: entries.length,
      logLevelDistribution: levelDistribution,
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
      },
      componentsActive: Array.from(components),
    };
  }

  private static analyzeErrors(entries: LogEntry[]): ErrorAnalysis {
    const errorEntries = entries.filter((entry) => entry.level === 'ERROR');
    const errorTypes: { [type: string]: number } = {};
    const errorMessages = new Map<string, { count: number; first: string; last: string }>();
    const errorTrends: { [hour: string]: number } = {};

    errorEntries.forEach((entry) => {
      // Error type analysis
      const errorType = entry.meta?.error || 'Unknown';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;

      // Error message analysis
      const message = entry.message;
      const existing = errorMessages.get(message);
      if (existing) {
        existing.count++;
        existing.last = entry.timestamp;
      } else {
        errorMessages.set(message, {
          count: 1,
          first: entry.timestamp,
          last: entry.timestamp,
        });
      }

      // Error trends by hour
      const hour = new Date(entry.timestamp).getHours().toString().padStart(2, '0');
      errorTrends[hour] = (errorTrends[hour] || 0) + 1;
    });

    const mostCommonErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        firstOccurrence: data.first,
        lastOccurrence: data.last,
      }))
      .sort((a, b) => b.count - a.count);

    const criticalErrors = errorEntries
      .filter(
        (entry) =>
          entry.message.toLowerCase().includes('critical') ||
          entry.message.toLowerCase().includes('fatal')
      )
      .slice(0, 10);

    return {
      totalErrors: errorEntries.length,
      errorTypes,
      criticalErrors,
      errorTrends,
      mostCommonErrors,
    };
  }

  private static analyzePerformance(
    entries: LogEntry[],
    auditEvents: AuditEvent[]
  ): PerformanceAnalysis {
    // Extract processing times from log entries
    const processingTimes: number[] = [];
    const slowOperations: Array<{ operation: string; duration: number; timestamp: string }> = [];

    entries.forEach((entry) => {
      if (entry.meta?.processingTime) {
        processingTimes.push(entry.meta.processingTime);
      }

      if (entry.meta?.duration && entry.meta.duration > 5000) {
        // Slow operations > 5s
        slowOperations.push({
          operation: entry.message,
          duration: entry.meta.duration,
          timestamp: entry.timestamp,
        });
      }
    });

    // API call analysis from audit events
    const apiCalls = auditEvents.filter((event) => event.eventType === 'api_call');
    const apiResponseTimes: number[] = [];
    const apiFailures = apiCalls.filter((event) => event.status === 'failed').length;
    const endpointStats = new Map<string, { times: number[]; count: number }>();

    apiCalls.forEach((event) => {
      if (event.duration) {
        apiResponseTimes.push(event.duration);

        const endpoint = event.operation.split(' ')[1] || event.operation;
        const stats = endpointStats.get(endpoint) || { times: [], count: 0 };
        stats.times.push(event.duration);
        stats.count++;
        endpointStats.set(endpoint, stats);
      }
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
        callCount: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime);

    return {
      averageProcessingTime:
        processingTimes.length > 0
          ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
          : 0,
      slowestOperations: slowOperations.sort((a, b) => b.duration - a.duration),
      apiCallAnalysis: {
        totalCalls: apiCalls.length,
        averageResponseTime:
          apiResponseTimes.length > 0
            ? apiResponseTimes.reduce((sum, time) => sum + time, 0) / apiResponseTimes.length
            : 0,
        failureRate: apiCalls.length > 0 ? apiFailures / apiCalls.length : 0,
        slowestEndpoints,
      },
    };
  }

  private static generateAuditSummary(events: AuditEvent[]): AuditSummary {
    const eventTypeDistribution: { [type: string]: number } = {};
    let successful = 0;
    let failed = 0;

    const documentEvents = events.filter((event) => event.eventType === 'document_export');
    const processingTimes: number[] = [];

    events.forEach((event) => {
      eventTypeDistribution[event.eventType] = (eventTypeDistribution[event.eventType] || 0) + 1;

      if (event.status === 'completed') successful++;
      else if (event.status === 'failed') failed++;

      if (event.duration && event.eventType === 'document_export') {
        processingTimes.push(event.duration);
      }
    });

    const successfulExports = documentEvents.filter((e) => e.status === 'completed').length;
    const failedExports = documentEvents.filter((e) => e.status === 'failed').length;

    return {
      totalEvents: events.length,
      eventTypeDistribution,
      operationSuccess: {
        successful,
        failed,
        successRate: successful + failed > 0 ? (successful / (successful + failed)) * 100 : 0,
      },
      documentProcessing: {
        totalDocuments: documentEvents.length,
        successfulExports,
        failedExports,
        averageProcessingTime:
          processingTimes.length > 0
            ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
            : 0,
      },
    };
  }

  private static generateRecommendations(analysis: LogAnalysisResult): string[] {
    const recommendations: string[] = [];

    // Error-based recommendations
    if (analysis.errorAnalysis.totalErrors > 0) {
      const errorRate = analysis.errorAnalysis.totalErrors / analysis.summary.totalLogEntries;
      if (errorRate > 0.1) {
        recommendations.push(
          'High error rate detected. Review error patterns and implement additional error handling.'
        );
      }

      if (analysis.errorAnalysis.criticalErrors.length > 0) {
        recommendations.push(
          'Critical errors found. Investigate and resolve these high-priority issues first.'
        );
      }
    }

    // Performance-based recommendations
    if (analysis.performanceAnalysis.averageProcessingTime > 30000) {
      // > 30 seconds
      recommendations.push(
        'Average processing time is high. Consider optimizing document processing or implementing parallel processing.'
      );
    }

    if (analysis.performanceAnalysis.apiCallAnalysis.failureRate > 0.05) {
      // > 5% failure rate
      recommendations.push(
        'API failure rate is elevated. Implement better retry logic and rate limiting.'
      );
    }

    if (analysis.performanceAnalysis.apiCallAnalysis.averageResponseTime > 2000) {
      // > 2 seconds
      recommendations.push(
        'API response times are slow. Consider implementing request caching or optimizing API calls.'
      );
    }

    // Audit-based recommendations
    if (analysis.auditSummary) {
      if (analysis.auditSummary.operationSuccess.successRate < 90) {
        recommendations.push(
          'Operation success rate is below 90%. Review failed operations and improve error recovery.'
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Export performance looks good. No immediate issues detected.');
    }

    return recommendations;
  }

  private static formatDuration(milliseconds: number): string {
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
