// Export-specific types and interfaces

export interface ExportState {
  sessionId: string;
  totalDocuments: number;
  processedDocuments: number;
  successfulExports: number;
  failedExports: number;
  currentDocument?: string;
  currentFolder?: string;
  currentOperation?: string;
  currentFormat?: string;
  currentFormats?: string[];
  errors: ExportError[];
  startTime: Date;
  lastUpdateTime: Date;
  outputDirectory: string;
  status: ExportStatus;
}

export interface ExportConfig {
  outputDirectory: string;
  exportFormat: 'native' | 'html' | 'markdown';
  exportFormats?: ('docx' | 'html' | 'xlsx' | 'markdown')[]; // New multi-format support
  maxDocuments?: number;
  includeSharedDocuments: boolean;
  includeFolders: string[]; // folder IDs to include
  rateLimitDelay: number;
  retryAttempts: number;
  preserveFolderStructure: boolean;
  sanitizeFileNames: boolean;
  conflictResolution: 'number' | 'timestamp' | 'overwrite';
  useFormatDirectories?: boolean; // New option for format-based organization
}

export interface ExportError {
  documentId: string;
  documentTitle: string;
  folderPath: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

export interface ExportProgress {
  sessionId: string;
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  currentFolder?: string;
  currentOperation?: string;
  currentFormat?: string;
  currentFormats?: string[];
  estimatedTimeRemaining?: number;
  exportSpeed?: number; // documents per minute
}

export interface ExportSummary {
  sessionId: string;
  totalDocuments: number;
  successfulExports: number;
  failedExports: number;
  skippedDocuments: number;
  outputDirectory: string;
  totalSize: number;
  duration: number;
  exportFormat: string;
  errors: ExportError[];
  folderStructure: FolderSummary[];
}

export interface FolderSummary {
  folderPath: string;
  localPath: string;
  documentCount: number;
  successfulExports: number;
  failedExports: number;
  totalSize: number;
  formatBreakdown?: FormatSummary[]; // New format-specific breakdown
}

export interface FormatSummary {
  format: string;
  documentCount: number;
  successfulExports: number;
  failedExports: number;
  totalSize: number;
  localPath: string;
}

export type ExportStatus =
  | 'initializing'
  | 'discovering'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface ExportSession {
  id: string;
  config: ExportConfig;
  state: ExportState;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentExportTask {
  documentId: string;
  documentTitle: string;
  documentType: string;
  folderPath: string;
  exportFormat: 'docx' | 'html' | 'xlsx' | 'markdown';
  exportFormats?: ('docx' | 'html' | 'xlsx' | 'markdown')[]; // Multi-format support
  priority: number;
  retryCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  error?: string;
  filePath?: string;
  filePaths?: { [format: string]: string }; // Format-specific file paths
  fileSize?: number;
  fileSizes?: { [format: string]: number }; // Format-specific file sizes
  exportedAt?: Date;
}
