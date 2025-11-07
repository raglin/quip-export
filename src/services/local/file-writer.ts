// Local file writer for handling document exports to local storage

import * as fs from 'fs/promises';
import { Logger } from '../../types';
import { 
  LocalDirectoryConfig, 
  FileWriteResult
} from './types';
import { DirectoryManager } from './directory-manager';
import { PathUtils } from './path-utils';

export interface FileWriteOptions {
  fileName: string;
  content: Buffer | string;
  documentType?: string;
  exportFormat?: 'docx' | 'html' | 'xlsx' | 'markdown';
  overwrite?: boolean;
}

export interface FormatFileWriteOptions extends FileWriteOptions {
  format: string;
  quipFolderPath?: string;
}

export interface FileWriteProgress {
  fileName: string;
  bytesWritten: number;
  totalBytes: number;
  percentage: number;
}

/**
 * Handles writing exported documents to local storage with progress tracking
 */
export class FileWriter {
  private readonly directoryManager: DirectoryManager;
  private readonly config: LocalDirectoryConfig;
  private readonly logger: Logger;

  constructor(directoryManager: DirectoryManager, config: LocalDirectoryConfig, logger: Logger) {
    this.directoryManager = directoryManager;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Write a document to local storage
   */
  async writeDocument(
    targetDirectory: string,
    options: FileWriteOptions,
    onProgress?: (progress: FileWriteProgress) => void
  ): Promise<FileWriteResult> {
    try {
      // Validate content is provided
      if (options.content === undefined || options.content === null) {
        return {
          success: false,
          error: `Content is required but was ${options.content}`,
          originalName: options.fileName
        };
      }
      // Create proper filename with extension
      let fileName = options.fileName;
      
      // Ensure file has proper extension based on export format
      if (options.exportFormat) {
        const expectedExtension = PathUtils.getFileExtensionForFormat(options.exportFormat, options.documentType);
        if (!fileName.toLowerCase().endsWith(expectedExtension.toLowerCase())) {
          fileName = fileName + expectedExtension;
        }
      }
      
      // Sanitize filename if configured
      if (this.config.sanitizeFileNames) {
        const sanitized = PathUtils.sanitizeFileNameEnhanced(fileName, options.exportFormat, options.documentType);
        fileName = sanitized.sanitized;
        
        // INFO-level logging for significant filename changes
        if (sanitized.significantChange) {
          this.logger.info(`Significant filename change detected: "${options.fileName}" -> "${fileName}"`);
        }
        
        // DEBUG-level logging for all sanitization operations
        if (sanitized.changed) {
          const unsafeCharsMsg = sanitized.originalUnsafeChars 
            ? ` (unsafe characters: ${sanitized.originalUnsafeChars.map(c => `'${c}'`).join(', ')})` 
            : '';
          this.logger.debug(`Sanitized filename: "${options.fileName}" -> "${fileName}"${unsafeCharsMsg}`);
        }
      }

      // Ensure directory exists with better error handling
      try {
        await fs.mkdir(targetDirectory, { recursive: true });
      } catch (error: any) {
        if (error.code === 'EACCES') {
          throw new Error(`Permission denied: Cannot create directory ${targetDirectory}. Check folder permissions.`);
        } else if (error.code === 'ENOSPC') {
          throw new Error(`Insufficient disk space: Cannot create directory ${targetDirectory}. Free up disk space and try again.`);
        } else if (error.code === 'EROFS') {
          throw new Error(`Read-only filesystem: Cannot create directory ${targetDirectory}. Choose a writable location.`);
        } else {
          throw new Error(`Failed to create directory ${targetDirectory}: ${error.message}`);
        }
      }

      // Resolve conflicts
      const conflictResolution = await this.directoryManager.resolveFilePathConflict(
        targetDirectory, 
        fileName
      );

      const finalPath = conflictResolution.resolvedPath;
      const finalName = conflictResolution.finalName;

      // Log conflict resolution if needed
      if (conflictResolution.strategy !== 'original') {
        this.logger.info(`File conflict resolved using ${conflictResolution.strategy} strategy: "${fileName}" -> "${finalName}"`);
      }

      // Write the file
      const writeResult = await this.writeFileWithProgress(
        finalPath,
        options.content,
        onProgress ? (progress) => onProgress({
          fileName: finalName,
          ...progress
        }) : undefined
      );

      if (!writeResult.success) {
        return {
          success: false,
          error: writeResult.error,
          originalName: options.fileName,
          finalName
        };
      }

      // Verify file integrity
      const verificationResult = await this.verifyFileIntegrity(finalPath, options.content);
      if (!verificationResult.success) {
        // Clean up the corrupted file
        try {
          await fs.unlink(finalPath);
        } catch (cleanupError) {
          this.logger.warn(`Failed to clean up corrupted file: ${finalPath}`);
        }
        
        return {
          success: false,
          error: verificationResult.error,
          originalName: options.fileName,
          finalName
        };
      }

      this.logger.debug(`Successfully wrote file: ${finalPath} (${writeResult.size} bytes)`);

      return {
        success: true,
        filePath: finalPath,
        originalName: options.fileName,
        finalName,
        size: writeResult.size
      };

    } catch (error) {
      const errorMessage = `Failed to write document "${options.fileName}": ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        originalName: options.fileName
      };
    }
  }

  /**
   * Write multiple documents in batch
   */
  async writeDocuments(
    documents: Array<{
      targetDirectory: string;
      options: FileWriteOptions;
    }>,
    onProgress?: (current: number, total: number, currentFile: string) => void,
    onFileProgress?: (progress: FileWriteProgress) => void
  ): Promise<FileWriteResult[]> {
    const results: FileWriteResult[] = [];
    
    for (let i = 0; i < documents.length; i++) {
      const { targetDirectory, options } = documents[i];
      
      if (onProgress) {
        onProgress(i + 1, documents.length, options.fileName);
      }

      const result = await this.writeDocument(targetDirectory, options, onFileProgress);
      results.push(result);

      // Small delay to prevent overwhelming the file system
      if (i < documents.length - 1) {
        await this.sleep(10);
      }
    }

    return results;
  }

  /**
   * Write file with progress tracking for large files
   */
  private async writeFileWithProgress(
    filePath: string,
    content: Buffer | string,
    onProgress?: (progress: { bytesWritten: number; totalBytes: number; percentage: number }) => void
  ): Promise<{ success: boolean; size?: number; error?: string }> {
    try {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      const totalBytes = buffer.length;

      // For small files, write directly
      if (totalBytes < 1024 * 1024) { // Less than 1MB
        await fs.writeFile(filePath, buffer);
        
        if (onProgress) {
          onProgress({ bytesWritten: totalBytes, totalBytes, percentage: 100 });
        }
        
        return { success: true, size: totalBytes };
      }

      // For larger files, write in chunks with progress
      const fileHandle = await fs.open(filePath, 'w');
      let bytesWritten = 0;
      const chunkSize = 64 * 1024; // 64KB chunks

      try {
        for (let offset = 0; offset < totalBytes; offset += chunkSize) {
          const end = Math.min(offset + chunkSize, totalBytes);
          const chunk = buffer.subarray(offset, end);
          
          await fileHandle.write(chunk, 0, chunk.length, offset);
          bytesWritten += chunk.length;

          if (onProgress) {
            const percentage = Math.round((bytesWritten / totalBytes) * 100);
            onProgress({ bytesWritten, totalBytes, percentage });
          }
        }

        return { success: true, size: bytesWritten };
      } finally {
        await fileHandle.close();
      }

    } catch (error: any) {
      let errorMessage = 'File write error: ';
      
      if (error.code === 'EACCES') {
        errorMessage += `Permission denied. Check file and folder permissions for: ${filePath}`;
      } else if (error.code === 'ENOSPC') {
        errorMessage += `Insufficient disk space. Free up space and try again.`;
      } else if (error.code === 'EROFS') {
        errorMessage += `Read-only filesystem. Choose a writable location.`;
      } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
        errorMessage += `Too many open files. Close other applications and try again.`;
      } else {
        errorMessage += error instanceof Error ? error.message : String(error);
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify file integrity after writing
   */
  private async verifyFileIntegrity(
    filePath: string,
    originalContent: Buffer | string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);
      const expectedSize = Buffer.isBuffer(originalContent) 
        ? originalContent.length 
        : Buffer.from(originalContent, 'utf8').length;

      if (stats.size !== expectedSize) {
        return {
          success: false,
          error: `File size mismatch: expected ${expectedSize} bytes, got ${stats.size} bytes`
        };
      }

      // For small files, verify content
      if (stats.size < 1024 * 1024) { // Less than 1MB
        const writtenContent = await fs.readFile(filePath);
        const expectedBuffer = Buffer.isBuffer(originalContent) 
          ? originalContent 
          : Buffer.from(originalContent, 'utf8');

        if (!writtenContent.equals(expectedBuffer)) {
          return {
            success: false,
            error: 'File content verification failed'
          };
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `File verification error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Write a document to format-specific directory structure
   */
  async writeFormatDocument(
    options: FormatFileWriteOptions,
    onProgress?: (progress: FileWriteProgress) => void
  ): Promise<FileWriteResult> {
    try {
      // Ensure format directory exists
      const formatDirResult = await this.directoryManager.createFormatDirectory(options.format);
      if (!formatDirResult.success) {
        return {
          success: false,
          error: formatDirResult.error,
          originalName: options.fileName
        };
      }

      // Create format-specific folder structure if needed
      let targetDirectory: string;
      if (options.quipFolderPath && this.config.preserveFolderStructure) {
        const folderResult = await this.directoryManager.createFormatQuipFolderStructure(
          options.format, 
          options.quipFolderPath
        );
        if (!folderResult.success) {
          return {
            success: false,
            error: folderResult.error,
            originalName: options.fileName
          };
        }
        targetDirectory = folderResult.directoryPath!;
      } else {
        targetDirectory = formatDirResult.directoryPath!;
      }

      // Generate format-specific filename
      const fileName = this.createSafeFileNameForFormat(
        options.fileName,
        options.format,
        options.documentType
      );

      // Write the document
      return await this.writeDocument(
        targetDirectory,
        {
          ...options,
          fileName,
          exportFormat: options.exportFormat || options.format as any
        },
        onProgress
      );

    } catch (error) {
      const errorMessage = `Failed to write format document "${options.fileName}" (${options.format}): ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        originalName: options.fileName
      };
    }
  }

  /**
   * Create a safe filename for a Quip document
   */
  createSafeFileName(
    documentTitle: string,
    documentType: string,
    exportFormat: 'docx' | 'html' | 'xlsx'
  ): string {
    // Use document title or fallback to 'Untitled'
    const baseTitle = documentTitle && documentTitle.trim() 
      ? documentTitle.trim() 
      : 'Untitled';

    // Get appropriate file extension
    const extension = PathUtils.getFileExtension(documentType, exportFormat);

    // Combine title and extension
    const fileName = baseTitle + extension;

    // Sanitize if configured
    if (this.config.sanitizeFileNames) {
      // Don't pass format to avoid extension replacement - filename already has correct extension
      return PathUtils.sanitizeFileNameEnhanced(fileName).sanitized;
    }

    return fileName;
  }

  /**
   * Create a safe filename for any export format
   */
  createSafeFileNameForFormat(
    documentTitle: string,
    format: string,
    documentType?: string
  ): string {
    // Use document title or fallback to 'Untitled'
    const baseTitle = documentTitle && documentTitle.trim() 
      ? documentTitle.trim() 
      : 'Untitled';

    // Get appropriate file extension for the format
    const extension = PathUtils.getFileExtensionForFormat(format, documentType);

    // Remove existing extension if present
    const titleWithoutExt = baseTitle.replace(/\.[^/.]+$/, '');

    // Combine title and extension
    const fileName = titleWithoutExt + extension;

    // Enhanced sanitization with format-specific handling
    if (this.config.sanitizeFileNames) {
      const sanitizationResult = PathUtils.sanitizeFileNameEnhanced(fileName, format, documentType);
      
      // INFO-level logging for significant filename changes
      if (sanitizationResult.significantChange) {
        this.logger.info(`Significant filename change detected: "${fileName}" -> "${sanitizationResult.sanitized}"`);
      }
      
      // DEBUG-level logging for all sanitization operations
      if (sanitizationResult.changed) {
        const unsafeCharsMsg = sanitizationResult.originalUnsafeChars 
          ? ` (unsafe characters: ${sanitizationResult.originalUnsafeChars.map(c => `'${c}'`).join(', ')})` 
          : '';
        this.logger.debug(`Sanitized filename: "${fileName}" -> "${sanitizationResult.sanitized}"${unsafeCharsMsg}`);
      }
      
      return sanitizationResult.sanitized;
    }

    return fileName;
  }

  /**
   * Get file statistics for a written file
   */
  async getFileStats(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    created?: Date;
    modified?: Date;
    error?: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return { exists: false };
      }
      
      return {
        exists: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Clean up temporary or failed files
   */
  async cleanupFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      this.logger.debug(`Cleaned up file: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to cleanup file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get available disk space in the target directory
   */
  async getAvailableSpace(directoryPath: string): Promise<{
    available: number;
    total: number;
    used: number;
  } | null> {
    try {
      // This is a simplified implementation - in a real scenario you might use a library like 'statvfs'
      await fs.stat(directoryPath);
      
      // Return null for now - this would need platform-specific implementation
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get disk space info: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Utility method for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}