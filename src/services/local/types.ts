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

/**
 * Result of path/filename sanitization operation
 */
export interface PathSanitizationResult {
  /**
   * The sanitized filename or path component
   */
  sanitized: string;
  
  /**
   * Whether the sanitization process modified the original string
   */
  changed: boolean;
  
  /**
   * Array of unique unsafe characters that were found and replaced during sanitization
   */
  originalUnsafeChars?: string[];
  
  /**
   * Indicates if the sanitization resulted in significant changes (>30% of characters modified).
   * This flag helps identify cases where the sanitized filename may be substantially different
   * from the original, warranting user notification or logging.
   * 
   * @remarks
   * - Set to `true` when more than 30% of the original characters were replaced
   * - Set to `undefined` when changes are minor or no changes occurred
   * - Used to trigger INFO-level logging for significant filename transformations
   */
  significantChange?: boolean;
}

export interface ConflictResolutionResult {
  resolvedPath: string;
  strategy: 'original' | 'numbered' | 'timestamped' | 'overwritten';
  finalName: string;
}