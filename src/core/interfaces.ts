// Core migration interfaces

import {
  MigrationConfig,
  MigrationState,
  MigrationReport,
  QuipDocument,
  ProgressInfo,
} from '../types';
import { ExportConfig } from './export-types';
import { BatchProcessingOptions, ProcessingResult, MigrationSession } from './types';

export interface IMigrationOrchestrator {
  startMigration(config: MigrationConfig, documents: QuipDocument[]): Promise<string>;
  resumeMigration(sessionId: string): Promise<void>;
  pauseMigration(sessionId: string): Promise<void>;
  getMigrationState(sessionId: string): Promise<MigrationState>;
  generateReport(sessionId: string): Promise<MigrationReport>;
}

export interface IBatchProcessor {
  processBatch(
    documents: QuipDocument[],
    options: BatchProcessingOptions
  ): Promise<ProcessingResult>;
  setProgressCallback(callback: (progress: ProgressInfo) => void): void;
}

export interface IStateManager {
  saveState(sessionId: string, state: MigrationState): Promise<void>;
  loadState(sessionId: string): Promise<MigrationState | null>;
  deleteState(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  saveSession(session: MigrationSession): Promise<void>;
  loadSession(sessionId: string): Promise<MigrationSession | null>;
  updateSession(sessionId: string, updates: Partial<MigrationSession>): Promise<void>;
  createSession(
    sessionId: string,
    config: MigrationConfig,
    documents: QuipDocument[]
  ): Promise<MigrationSession>;
}

export interface IErrorHandler {
  handleError(error: Error, context: Record<string, unknown>): Promise<boolean>; // returns true if should retry
  categorizeError(error: Error): 'auth' | 'api' | 'file' | 'permission' | 'network' | 'unknown';
  shouldRetry(error: Error, retryCount: number): boolean;
}

export interface IProgressTracker {
  updateProgress(current: number, total: number, currentItem?: string): void;
  setProgressCallback(callback: (progress: number) => void): void;
  getProgress(): { current: number; total: number; percentage: number };
}

export interface IConfigValidator {
  validateConfig(config: MigrationConfig): Promise<{ isValid: boolean; errors: string[] }>;
  validateAuthentication(): Promise<boolean>;
}

export interface IExportConfigValidator {
  validateConfig(config: ExportConfig): Promise<{ isValid: boolean; errors: string[] }>;
  validateAuthentication(): Promise<boolean>;
}

export interface ILogger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  setLevel(level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'): void;
}
