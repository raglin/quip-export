// Folder structure mapper for preserving Quip organization in local storage

import * as path from 'path';
import { Logger } from '../../types';
import { DirectoryManager } from './directory-manager';
import { LocalDirectoryConfig, DirectoryStructure } from './types';
import { PathUtils } from './path-utils';

export interface QuipFolderInfo {
  id: string;
  name: string;
  type: 'private' | 'shared' | 'archive' | 'starred' | 'trash' | 'desktop';
  parentPath?: string;
  fullPath: string;
}

export interface FolderMappingResult {
  success: boolean;
  localPath?: string;
  quipPath: string;
  created?: boolean;
  error?: string;
}

export interface DocumentPathMapping {
  documentId: string;
  documentTitle: string;
  quipFolderPath: string;
  localDirectoryPath: string;
  localFilePath: string;
  fileName: string;
}

/**
 * Maps Quip folder structures to local directory organization
 */
export class FolderStructureMapper {
  private readonly directoryManager: DirectoryManager;
  private readonly config: LocalDirectoryConfig;
  private readonly logger: Logger;
  private readonly folderMappings = new Map<string, string>(); // Quip path -> Local path

  constructor(directoryManager: DirectoryManager, config: LocalDirectoryConfig, logger: Logger) {
    this.directoryManager = directoryManager;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the folder structure mapping system
   */
  async initialize(): Promise<void> {
    this.logger.debug('Initializing folder structure mapper');
    
    // Clear any existing mappings
    this.folderMappings.clear();
    
    // Initialize base directory
    const baseResult = await this.directoryManager.initializeBaseDirectory();
    if (!baseResult.success) {
      throw new Error(`Failed to initialize base directory: ${baseResult.error}`);
    }

    this.logger.info('Folder structure mapper initialized');
  }

  /**
   * Map a Quip folder to a local directory path
   */
  async mapQuipFolder(folderInfo: QuipFolderInfo): Promise<FolderMappingResult> {
    try {
      this.logger.debug(`Mapping Quip folder: ${folderInfo.fullPath} (${folderInfo.type})`);

      // Check if we already have this mapping cached
      const cachedPath = this.folderMappings.get(folderInfo.fullPath);
      if (cachedPath) {
        return {
          success: true,
          localPath: cachedPath,
          quipPath: folderInfo.fullPath,
          created: false
        };
      }

      // Determine local path based on configuration
      if (this.config.preserveFolderStructure) {
        // Create hierarchical structure - handled by directoryManager
      } else {
        // Flatten structure - handled by directoryManager
      }

      // Create the directory
      const createResult = await this.directoryManager.createQuipFolderStructure(folderInfo.fullPath);
      if (!createResult.success) {
        return {
          success: false,
          quipPath: folderInfo.fullPath,
          error: createResult.error
        };
      }

      // Cache the mapping
      this.folderMappings.set(folderInfo.fullPath, createResult.directoryPath!);

      this.logger.debug(`Mapped folder: ${folderInfo.fullPath} -> ${createResult.directoryPath}`);

      return {
        success: true,
        localPath: createResult.directoryPath!,
        quipPath: folderInfo.fullPath,
        created: createResult.created
      };

    } catch (error) {
      const errorMessage = `Failed to map Quip folder '${folderInfo.fullPath}': ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        quipPath: folderInfo.fullPath,
        error: errorMessage
      };
    }
  }

  /**
   * Map multiple Quip folders in batch
   */
  async mapQuipFolders(folders: QuipFolderInfo[]): Promise<FolderMappingResult[]> {
    const results: FolderMappingResult[] = [];
    
    // Sort folders by depth to ensure parent directories are created first
    const sortedFolders = folders.sort((a, b) => {
      const aDepth = a.fullPath.split('/').length;
      const bDepth = b.fullPath.split('/').length;
      return aDepth - bDepth;
    });

    for (const folder of sortedFolders) {
      const result = await this.mapQuipFolder(folder);
      results.push(result);
    }

    return results;
  }

  /**
   * Get the local directory path for a Quip document
   */
  getDocumentLocalPath(
    documentTitle: string,
    documentType: string,
    quipFolderPath: string,
    exportFormat: 'docx' | 'html' | 'xlsx'
  ): DocumentPathMapping {
    // Get the local directory path
    const localDirectoryPath = this.directoryManager.getTargetDirectoryPath(quipFolderPath);
    
    // Create safe filename
    const fileName = this.createSafeDocumentFileName(documentTitle, documentType, exportFormat);
    
    // Combine directory and filename
    const localFilePath = path.join(localDirectoryPath, fileName);

    return {
      documentId: '', // Will be set by caller
      documentTitle,
      quipFolderPath,
      localDirectoryPath,
      localFilePath,
      fileName
    };
  }





  /**
   * Create a safe filename for a document
   */
  private createSafeDocumentFileName(
    documentTitle: string,
    documentType: string,
    exportFormat: 'docx' | 'html' | 'xlsx'
  ): string {
    // Use document title or fallback
    const baseTitle = documentTitle && documentTitle.trim() 
      ? documentTitle.trim() 
      : 'Untitled';

    // Get appropriate extension
    const extension = PathUtils.getFileExtension(documentType, exportFormat);
    
    // Combine and sanitize
    const fileName = baseTitle + extension;
    
    if (this.config.sanitizeFileNames) {
      return PathUtils.sanitizeFileName(fileName).sanitized;
    }
    
    return fileName;
  }

  /**
   * Get all folder mappings
   */
  getFolderMappings(): Map<string, string> {
    return new Map(this.folderMappings);
  }

  /**
   * Clear all cached folder mappings
   */
  clearMappings(): void {
    this.folderMappings.clear();
    this.logger.debug('Cleared all folder mappings');
  }

  /**
   * Get statistics about the folder structure
   */
  async getFolderStructureStats(): Promise<{
    totalFolders: number;
    mappedFolders: number;
    localDirectoryStructure: DirectoryStructure;
  }> {
    const localStructure = await this.directoryManager.analyzeDirectoryStructure();
    
    return {
      totalFolders: this.countFolders(localStructure),
      mappedFolders: this.folderMappings.size,
      localDirectoryStructure: localStructure
    };
  }

  /**
   * Recursively count folders in directory structure
   */
  private countFolders(structure: DirectoryStructure): number {
    let count = structure.type === 'folder' ? 1 : 0;
    
    if (structure.children) {
      for (const child of structure.children) {
        count += this.countFolders(child);
      }
    }
    
    return count;
  }

  /**
   * Validate that a Quip folder path is valid for mapping
   */
  validateQuipFolderPath(folderPath: string): { valid: boolean; error?: string } {
    if (!folderPath) {
      return { valid: false, error: 'Folder path cannot be empty' };
    }

    // Check for invalid characters that could cause issues
    const invalidChars = /[\x00-\x1f\x7f]/;
    if (invalidChars.test(folderPath)) {
      return { valid: false, error: 'Folder path contains invalid control characters' };
    }

    // Check path length
    if (folderPath.length > 1000) {
      return { valid: false, error: 'Folder path is too long' };
    }

    return { valid: true };
  }

  /**
   * Generate a folder structure report
   */
  generateFolderReport(): {
    mappings: Array<{ quipPath: string; localPath: string }>;
    summary: {
      totalMappings: number;
      preserveStructure: boolean;
      baseOutputPath: string;
    };
  } {
    const mappings = Array.from(this.folderMappings.entries()).map(([quipPath, localPath]) => ({
      quipPath,
      localPath
    }));

    return {
      mappings,
      summary: {
        totalMappings: mappings.length,
        preserveStructure: this.config.preserveFolderStructure,
        baseOutputPath: this.config.baseOutputPath
      }
    };
  }
}