import { Logger, LogLevel } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  sessionId?: string;
  component?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  logDirectory: string;
  maxFileSize: number; // in bytes
  maxFiles: number;
  enableConsole: boolean;
  sessionId?: string;
  component?: string;
}

/**
 * Enhanced logger with file output and structured logging
 */
export class EnhancedLogger implements Logger {
  private readonly config: LoggerConfig;
  private currentLogFile?: string;
  private logFileSize: number = 0;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'INFO',
      enableFileLogging: true,
      logDirectory: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableConsole: true,
      ...config
    };

    if (this.config.enableFileLogging) {
      this.initializeFileLogging();
    }
  }

  error(message: string, meta?: any): void {
    this.log('ERROR', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('WARN', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('INFO', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log('DEBUG', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      sessionId: this.config.sessionId,
      component: this.config.component
    };

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.config.enableFileLogging) {
      this.logToFile(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level}] ${entry.timestamp}`;
    const suffix = entry.component ? ` [${entry.component}]` : '';
    const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    
    const fullMessage = `${prefix}${suffix} ${entry.message}${metaStr}`;

    switch (entry.level) {
      case 'ERROR':
        console.error(fullMessage);
        break;
      case 'WARN':
        console.warn(fullMessage);
        break;
      case 'INFO':
        console.info(fullMessage);
        break;
      case 'DEBUG':
        console.debug(fullMessage);
        break;
    }
  }

  private logToFile(entry: LogEntry): void {
    if (!this.currentLogFile) {
      return;
    }

    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(this.currentLogFile, logLine);
      this.logFileSize += Buffer.byteLength(logLine);
      
      if (this.logFileSize > this.config.maxFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private initializeFileLogging(): void {
    try {
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(this.config.logDirectory, `migration-${timestamp}.log`);
      
      // Initialize file
      fs.writeFileSync(this.currentLogFile, '');
      this.logFileSize = 0;
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
      this.config.enableFileLogging = false;
    }
  }

  private rotateLogFile(): void {
    if (!this.currentLogFile) return;

    try {
      // Clean up old log files
      this.cleanupOldLogFiles();
      
      // Create new log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(this.config.logDirectory, `migration-${timestamp}.log`);
      fs.writeFileSync(this.currentLogFile, '');
      this.logFileSize = 0;
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private cleanupOldLogFiles(): void {
    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith('migration-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          mtime: fs.statSync(path.join(this.config.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent files
      const filesToDelete = files.slice(this.config.maxFiles - 1);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex <= currentLevelIndex;
  }

  public getLogFilePath(): string | undefined {
    return this.currentLogFile;
  }

  public createChildLogger(component: string): Logger {
    return new EnhancedLogger({
      ...this.config,
      component
    });
  }
}

/**
 * Simple console logger implementation (kept for backward compatibility)
 */
export class ConsoleLogger implements Logger {
  private readonly logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'INFO') {
    this.logLevel = logLevel;
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('ERROR')) {
      console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('WARN')) {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('INFO')) {
      console.info(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('DEBUG')) {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex <= currentLevelIndex;
  }
}

// Default logger instance
export const logger = new EnhancedLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
  sessionId: process.env.SESSION_ID,
  enableFileLogging: false
});