// Core migration types

import { MigrationState, MigrationConfig, QuipDocument } from '../types';
import { ExportState, ExportConfig } from './export-types';

export * from './logger';

export interface BatchProcessingOptions {
  batchSize: number;
  concurrency: number;
  delayBetweenBatches: number;
}

export interface ExportSession {
  id: string;
  config: ExportConfig;
  state: ExportState;
  documents: QuipDocument[];
  createdAt: Date;
  updatedAt: Date;
}

// Legacy interface for backward compatibility
export interface MigrationSession {
  id: string;
  config: MigrationConfig;
  state: MigrationState;
  documents: QuipDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingResult {
  success: boolean;
  processedCount: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
}