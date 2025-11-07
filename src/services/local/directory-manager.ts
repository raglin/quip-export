// Local directory manager for creating and managing folder structures

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../types';
import { 
  LocalDirectoryConfig, 
  DirectoryCreateResult, 
  DirectoryStructure,
  ConflictResolutionResult 
} from './types';
import { PathUtils } from './path-utils';

/**
 * Manages local directory creation and folder structure mirroring Quip organization
 */
export class DirectoryManager {
  private readonly config: LocalDirectoryConfig;
  private readonly logger: Logger;

  constructor(config: LocalDirectoryConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Create the base output directory structure
   */
  async initializeBaseDirectory(): Promise<DirectoryCreateResult> {
    try {
      this.logger.debug(`Initializing base directory: ${this.config.baseOutputPath}`);
      
      // Ensure the base path is safe
      if (!PathUtils.isValidPath(this.config.baseOutputPath)) {
        return {
          success: false,
          error: `Invalid base output path: ${this.config.baseOutputPath}`
        };
      }

      // Create the directory
      await fs.mkdir(this.config.baseOutputPath, { recursive: true });
      
      // Verify it was created and is writable
      const stats = await fs.stat(this.config.baseOutputPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Base path exists but is not a directory: ${this.config.baseOutputPath}`
        };
      }

      // Test write permissions
      const testFile = path.join(this.config.baseOutputPath, '.write_test');
      try {
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
      } catch (error) {
        return {
          success: false,
          error: `No write permission in base directory: ${this.config.baseOutputPath}`
        };
      }

      this.logger.info(`Base directory initialized: ${this.config.baseOutputPath}`);
      
      return {
        success: true,
        directoryPath: this.config.baseOutputPath,
        created: true
      };
    } catch (error) {
      const errorMessage = `Failed to initialize base directory: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create a directory structure that mirrors Quip folder organization
   */
  async createQuipFolderStructure(quipFolderPath: string): Promise<DirectoryCreateResult> {
    try {
      let targetPath: string;

      if (this.config.preserveFolderStructure) {
        // Create nested structure mirroring Quip
        const safeFolderPath = PathUtils.createSafeRelativePath(quipFolderPath);
        targetPath = path.join(this.config.baseOutputPath, safeFolderPath);
      } else {
        // Flatten structure - use base directory
        targetPath = this.config.baseOutputPath;
      }

      // Ensure path length is within limits
      targetPath = PathUtils.ensurePathLength(targetPath);

      this.logger.debug(`Creating folder structure: ${quipFolderPath} -> ${targetPath}`);

      // Create the directory
      await fs.mkdir(targetPath, { recursive: true });

      // Verify creation
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Failed to create directory: ${targetPath}`
        };
      }

      return {
        success: true,
        directoryPath: targetPath,
        created: true
      };
    } catch (error) {
      const errorMessage = `Failed to create folder structure for '${quipFolderPath}': ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create a directory for a specific Quip folder type (Private, Archive, etc.)
   */
  async createFolderTypeDirectory(folderType: string): Promise<DirectoryCreateResult> {
    try {
      const sanitizedType = PathUtils.sanitizeFilenameComponent(folderType);
      const targetPath = path.join(this.config.baseOutputPath, sanitizedType);

      this.logger.debug(`Creating folder type directory: ${folderType} -> ${targetPath}`);

      await fs.mkdir(targetPath, { recursive: true });

      return {
        success: true,
        directoryPath: targetPath,
        created: true
      };
    } catch (error) {
      const errorMessage = `Failed to create folder type directory '${folderType}': ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Resolve file path conflicts using the configured strategy
   */
  async resolveFilePathConflict(
    directoryPath: string, 
    fileName: string
  ): Promise<ConflictResolutionResult> {
    const fullPath = path.join(directoryPath, fileName);

    try {
      // Check if file exists
      await fs.access(fullPath);
      
      // File exists, need to resolve conflict
      this.logger.debug(`File conflict detected: ${fullPath}`);

      switch (this.config.conflictResolution) {
        case 'overwrite':
          return {
            resolvedPath: fullPath,
            strategy: 'overwritten',
            finalName: fileName
          };

        case 'number':
        case 'timestamp':
          const uniqueFileName = PathUtils.createUniqueFileName(
            directoryPath, 
            fileName, 
            this.config.conflictResolution
          );
          const uniquePath = path.join(directoryPath, uniqueFileName);
          
          return {
            resolvedPath: uniquePath,
            strategy: this.config.conflictResolution === 'number' ? 'numbered' : 'timestamped',
            finalName: uniqueFileName
          };

        default:
          return {
            resolvedPath: fullPath,
            strategy: 'original',
            finalName: fileName
          };
      }
    } catch {
      // File doesn't exist, no conflict
      return {
        resolvedPath: fullPath,
        strategy: 'original',
        finalName: fileName
      };
    }
  }

  /**
   * Resolve file path conflicts with format-specific handling
   */
  async resolveFormatFilePathConflict(
    directoryPath: string, 
    fileName: string,
    format: string
  ): Promise<ConflictResolutionResult> {
    const fullPath = path.join(directoryPath, fileName);

    try {
      // Check if file exists
      await fs.access(fullPath);
      
      // File exists, need to resolve conflict
      this.logger.debug(`Format file conflict detected: ${fullPath} (${format})`);

      switch (this.config.conflictResolution) {
        case 'overwrite':
          return {
            resolvedPath: fullPath,
            strategy: 'overwritten',
            finalName: fileName
          };

        case 'number':
        case 'timestamp':
          const uniqueFileName = PathUtils.generateUniqueFileName(
            directoryPath, 
            fileName, 
            format,
            this.config.conflictResolution
          );
          const uniquePath = path.join(directoryPath, uniqueFileName);
          
          return {
            resolvedPath: uniquePath,
            strategy: this.config.conflictResolution === 'number' ? 'numbered' : 'timestamped',
            finalName: uniqueFileName
          };

        default:
          return {
            resolvedPath: fullPath,
            strategy: 'original',
            finalName: fileName
          };
      }
    } catch {
      // File doesn't exist, no conflict
      return {
        resolvedPath: fullPath,
        strategy: 'original',
        finalName: fileName
      };
    }
  }

  /**
   * Get the target directory path for a Quip document
   */
  getTargetDirectoryPath(quipFolderPath: string): string {
    if (this.config.preserveFolderStructure) {
      const safeFolderPath = PathUtils.createSafeRelativePath(quipFolderPath);
      return path.join(this.config.baseOutputPath, safeFolderPath);
    } else {
      return this.config.baseOutputPath;
    }
  }

  /**
   * Get the target directory path for a specific format and Quip folder
   */
  getFormatDirectoryPath(format: string, quipFolderPath: string): string {
    const formatDir = path.join(this.config.baseOutputPath, format);
    
    if (this.config.preserveFolderStructure) {
      const safeFolderPath = PathUtils.createSafeRelativePath(quipFolderPath);
      return path.join(formatDir, safeFolderPath);
    } else {
      return formatDir;
    }
  }

  /**
   * Create format-based directory structure
   */
  async createFormatDirectory(format: string): Promise<DirectoryCreateResult> {
    try {
      const formatPath = path.join(this.config.baseOutputPath, format);
      
      this.logger.debug(`Creating format directory: ${format} -> ${formatPath}`);

      await fs.mkdir(formatPath, { recursive: true });

      // Verify creation
      const stats = await fs.stat(formatPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Failed to create format directory: ${formatPath}`
        };
      }

      return {
        success: true,
        directoryPath: formatPath,
        created: true
      };
    } catch (error) {
      const errorMessage = `Failed to create format directory '${format}': ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create format-based folder structure that mirrors Quip organization
   */
  async createFormatQuipFolderStructure(format: string, quipFolderPath: string): Promise<DirectoryCreateResult> {
    try {
      const targetPath = this.getFormatDirectoryPath(format, quipFolderPath);

      // Ensure path length is within limits
      const safePath = PathUtils.ensurePathLength(targetPath);

      this.logger.debug(`Creating format folder structure: ${format}/${quipFolderPath} -> ${safePath}`);

      // Create the directory
      await fs.mkdir(safePath, { recursive: true });

      // Verify creation
      const stats = await fs.stat(safePath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Failed to create format folder structure: ${safePath}`
        };
      }

      return {
        success: true,
        directoryPath: safePath,
        created: true
      };
    } catch (error) {
      const errorMessage = `Failed to create format folder structure for '${format}/${quipFolderPath}': ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Scan and analyze the created directory structure
   */
  async analyzeDirectoryStructure(): Promise<DirectoryStructure> {
    try {
      return await this.scanDirectory(this.config.baseOutputPath);
    } catch (error) {
      this.logger.error(`Failed to analyze directory structure: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Recursively scan a directory and build structure information
   */
  private async scanDirectory(dirPath: string): Promise<DirectoryStructure> {
    const stats = await fs.stat(dirPath);
    const name = path.basename(dirPath);

    if (stats.isFile()) {
      return {
        path: dirPath,
        name,
        type: 'file',
        size: stats.size,
        created: stats.birthtime
      };
    }

    // Directory
    const children: DirectoryStructure[] = [];
    
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        try {
          const childStructure = await this.scanDirectory(entryPath);
          children.push(childStructure);
        } catch (error) {
          this.logger.warn(`Failed to scan directory entry: ${entryPath} - ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read directory: ${dirPath} - ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      path: dirPath,
      name,
      type: 'folder',
      children,
      created: stats.birthtime
    };
  }

  /**
   * Clean up empty directories
   */
  async cleanupEmptyDirectories(): Promise<void> {
    try {
      await this.removeEmptyDirectories(this.config.baseOutputPath);
    } catch (error) {
      this.logger.warn(`Failed to cleanup empty directories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recursively remove empty directories
   */
  private async removeEmptyDirectories(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);
      
      // Process subdirectories first
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isDirectory()) {
          await this.removeEmptyDirectories(entryPath);
        }
      }

      // Check if directory is now empty (after processing subdirectories)
      const remainingEntries = await fs.readdir(dirPath);
      if (remainingEntries.length === 0 && dirPath !== this.config.baseOutputPath) {
        await fs.rmdir(dirPath);
        this.logger.debug(`Removed empty directory: ${dirPath}`);
      }
    } catch (error) {
      // Ignore errors - directory might not be empty or might not exist
      this.logger.debug(`Could not remove directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}