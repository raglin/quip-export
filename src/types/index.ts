// Core interfaces and types for the migration tool

export * from './utils';

export interface QuipDocument {
  id: string;
  title: string;
  type: 'DOCUMENT' | 'SPREADSHEET' | 'CHAT';
  created_usec: number;
  updated_usec: number;
  author_id: string;
  owning_company_id: string | null;
  link: string;
  secret_path: string;
  is_template: boolean;
  is_deleted: boolean;
}

export interface QuipFolder {
  id: string;
  title: string;
  created_usec: number;
  updated_usec: number;
  children: string[];
  member_ids: string[];
}

// Export state and error types are defined in core/export-types.ts

// Legacy interfaces for backward compatibility
export interface MigrationError {
  documentId: string;
  documentTitle: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

export interface MigrationState {
  sessionId: string;
  totalDocuments: number;
  processedDocuments: number;
  successfulMigrations: number;
  failedMigrations: number;
  currentDocument?: string;
  errors: MigrationError[];
  startTime: Date;
  lastUpdateTime: Date;
}

// Export types are defined in core/export-types.ts

// Legacy interface for backward compatibility
export interface MigrationConfig {
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  outputFormat: 'native' | 'html' | 'markdown';
  preserveFolderStructure: boolean;
  includeSharedDocuments: boolean;
}

export interface AuthTokens {
  quipToken?: string;
  microsoftAccessToken?: string;
  microsoftRefreshToken?: string;
  expiresAt?: Date;
}

export interface DocumentExport {
  documentId: string;
  title: string;
  format: string;
  content: Buffer;
  metadata: QuipDocument;
  folderPath: string;
}

// Export result and report types are defined in core/export-types.ts

// Legacy interfaces for backward compatibility
export interface UploadResult {
  success: boolean;
  fileName: string;
  filePath: string;
  fileSize: number;
  webUrl?: string;
  error?: string;
  uploadedAt: Date;
}

export interface MigrationReport {
  sessionId: string;
  totalDocuments: number;
  successfulMigrations: number;
  failedMigrations: number;
  duration: number;
  errors: MigrationError[];
  documentMappings: Array<{
    quipUrl: string;
    oneDriveUrl: string;
    title: string;
  }>;
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// Progress tracking types
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
}

export type ProgressCallback = (progress: ProgressInfo) => void;

// Configuration validation
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

// File system types
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  content: Buffer;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}
