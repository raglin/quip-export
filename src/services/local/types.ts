// Local file management types and interfaces

export interface LocalDirectoryConfig {
  baseOutputPath: string;
  preserveFolderStructure: boolean;
  sanitizeFileNames: boolean;
  conflictResolution: 'number' | 'timestamp' | 'overwrite';
  useFormatDirectories?: boolean; // New option for format-based organization
}

export interface DirectoryStructure {
  path: string;
  name: string;
  type: 'folder' | 'file';
  children?: DirectoryStructure[];
  size?: number;
  created?: Date;
}

export interface FileWriteResult {
  success: boolean;
  filePath?: string;
  originalName?: string;
  finalName?: string;
  size?: number;
  error?: string;
}

export interface DirectoryCreateResult {
  success: boolean;
  directoryPath?: string;
  created?: boolean; // true if created, false if already existed
  error?: string;
}

export interface PathSanitizationResult {
  sanitized: string;
  changed: boolean;
  originalUnsafeChars?: string[];
}

export interface ConflictResolutionResult {
  resolvedPath: string;
  strategy: 'original' | 'numbered' | 'timestamped' | 'overwritten';
  finalName: string;
}