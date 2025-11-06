import { FolderStructureMapper, QuipFolderInfo } from '../../../services/local/folder-structure-mapper';
import { DirectoryManager } from '../../../services/local/directory-manager';
import { LocalDirectoryConfig } from '../../../services/local/types';
import { ConsoleLogger } from '../../../core/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FolderStructureMapper', () => {
  let tempDir: string;
  let folderMapper: FolderStructureMapper;
  let directoryManager: DirectoryManager;
  let logger: ConsoleLogger;
  let config: LocalDirectoryConfig;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quip-folder-mapper-test-'));
    
    logger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    
    config = {
      baseOutputPath: tempDir,
      preserveFolderStructure: true,
      sanitizeFileNames: true,
      conflictResolution: 'number'
    };
    
    directoryManager = new DirectoryManager(config, logger);
    folderMapper = new FolderStructureMapper(directoryManager, config, logger);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(folderMapper.initialize()).resolves.not.toThrow();
      
      // Verify base directory was created
      const stats = await fs.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should clear mappings on initialization', async () => {
      // Add some mappings first
      const folder: QuipFolderInfo = {
        id: 'folder1',
        name: 'Test Folder',
        type: 'private',
        fullPath: 'Private/Test'
      };
      
      await folderMapper.initialize();
      await folderMapper.mapQuipFolder(folder);
      
      expect(folderMapper.getFolderMappings().size).toBe(1);
      
      // Re-initialize should clear mappings
      await folderMapper.initialize();
      expect(folderMapper.getFolderMappings().size).toBe(0);
    });
  });

  describe('Single Folder Mapping', () => {
    beforeEach(async () => {
      await folderMapper.initialize();
    });

    it('should map a private folder with hierarchical structure', async () => {
      const folder: QuipFolderInfo = {
        id: 'private1',
        name: 'Projects',
        type: 'private',
        fullPath: 'Private/Projects/Important'
      };

      const result = await folderMapper.mapQuipFolder(folder);

      expect(result.success).toBe(true);
      expect(result.quipPath).toBe('Private/Projects/Important');
      expect(result.localPath).toBe(path.join(tempDir, 'Private', 'Projects', 'Important'));
      expect(result.created).toBe(true);

      // Verify directory was created
      const stats = await fs.stat(result.localPath!);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should map a shared folder', async () => {
      const folder: QuipFolderInfo = {
        id: 'shared1',
        name: 'Team Documents',
        type: 'shared',
        fullPath: 'Shared/Team/Documents'
      };

      const result = await folderMapper.mapQuipFolder(folder);

      expect(result.success).toBe(true);
      expect(result.quipPath).toBe('Shared/Team/Documents');
      expect(result.localPath).toBe(path.join(tempDir, 'Shared', 'Team', 'Documents'));
    });

    it('should handle root-level folders', async () => {
      const folder: QuipFolderInfo = {
        id: 'archive1',
        name: 'Archive',
        type: 'archive',
        fullPath: ''
      };

      const result = await folderMapper.mapQuipFolder(folder);

      expect(result.success).toBe(true);
      expect(result.localPath).toBe(path.join(tempDir, 'Root'));
    });

    it('should sanitize unsafe folder names', async () => {
      const folder: QuipFolderInfo = {
        id: 'unsafe1',
        name: 'Unsafe<>:|?*Folder',
        type: 'private',
        fullPath: 'Private/Unsafe<>:|?*Folder'
      };

      const result = await folderMapper.mapQuipFolder(folder);

      expect(result.success).toBe(true);
      expect(result.localPath).toBe(path.join(tempDir, 'Private', 'Unsafe______Folder'));
    });

    it('should cache folder mappings', async () => {
      const folder: QuipFolderInfo = {
        id: 'cached1',
        name: 'Cached Folder',
        type: 'private',
        fullPath: 'Private/Cached'
      };

      // First mapping
      const result1 = await folderMapper.mapQuipFolder(folder);
      expect(result1.success).toBe(true);
      expect(result1.created).toBe(true);

      // Second mapping should use cache
      const result2 = await folderMapper.mapQuipFolder(folder);
      expect(result2.success).toBe(true);
      expect(result2.created).toBe(false);
      expect(result2.localPath).toBe(result1.localPath);
    });
  });

  describe('Flattened Structure', () => {
    beforeEach(async () => {
      config.preserveFolderStructure = false;
      directoryManager = new DirectoryManager(config, logger);
      folderMapper = new FolderStructureMapper(directoryManager, config, logger);
      await folderMapper.initialize();
    });

    it('should create flattened structure when preserveFolderStructure is false', async () => {
      const folder: QuipFolderInfo = {
        id: 'flat1',
        name: 'Deep Nested Folder',
        type: 'private',
        fullPath: 'Private/Very/Deep/Nested/Folder'
      };

      const result = await folderMapper.mapQuipFolder(folder);

      expect(result.success).toBe(true);
      expect(result.localPath).toBe(tempDir); // Should use base directory
    });
  });

  describe('Batch Folder Mapping', () => {
    beforeEach(async () => {
      await folderMapper.initialize();
    });

    it('should map multiple folders in correct order', async () => {
      const folders: QuipFolderInfo[] = [
        {
          id: 'folder1',
          name: 'Parent',
          type: 'private',
          fullPath: 'Private/Parent'
        },
        {
          id: 'folder2',
          name: 'Child',
          type: 'private',
          fullPath: 'Private/Parent/Child'
        },
        {
          id: 'folder3',
          name: 'Grandchild',
          type: 'private',
          fullPath: 'Private/Parent/Child/Grandchild'
        }
      ];

      const results = await folderMapper.mapQuipFolders(folders);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // Verify all directories were created
      for (const result of results) {
        const stats = await fs.stat(result.localPath!);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should handle mixed folder types', async () => {
      const folders: QuipFolderInfo[] = [
        {
          id: 'private1',
          name: 'Private Folder',
          type: 'private',
          fullPath: 'Private/Folder'
        },
        {
          id: 'shared1',
          name: 'Shared Folder',
          type: 'shared',
          fullPath: 'Shared/Folder'
        },
        {
          id: 'archive1',
          name: 'Archive Folder',
          type: 'archive',
          fullPath: 'Archive/Folder'
        }
      ];

      const results = await folderMapper.mapQuipFolders(folders);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // Verify folder type directories were created
      const privateStats = await fs.stat(path.join(tempDir, 'Private', 'Folder'));
      const sharedStats = await fs.stat(path.join(tempDir, 'Shared', 'Folder'));
      const archiveStats = await fs.stat(path.join(tempDir, 'Archive', 'Folder'));

      expect(privateStats.isDirectory()).toBe(true);
      expect(sharedStats.isDirectory()).toBe(true);
      expect(archiveStats.isDirectory()).toBe(true);
    });
  });

  describe('Document Path Mapping', () => {
    beforeEach(async () => {
      await folderMapper.initialize();
    });

    it('should create correct document path mapping', async () => {
      const mapping = folderMapper.getDocumentLocalPath(
        'My Important Document',
        'DOCUMENT',
        'Private/Projects',
        'docx'
      );

      expect(mapping.documentTitle).toBe('My Important Document');
      expect(mapping.quipFolderPath).toBe('Private/Projects');
      expect(mapping.localDirectoryPath).toBe(path.join(tempDir, 'Private', 'Projects'));
      expect(mapping.fileName).toBe('My Important Document.docx');
      expect(mapping.localFilePath).toBe(path.join(tempDir, 'Private', 'Projects', 'My Important Document.docx'));
    });

    it('should handle different document types and formats', () => {
      const docMapping = folderMapper.getDocumentLocalPath('Document', 'DOCUMENT', 'Private', 'docx');
      const spreadsheetMapping = folderMapper.getDocumentLocalPath('Spreadsheet', 'SPREADSHEET', 'Private', 'docx');
      const htmlMapping = folderMapper.getDocumentLocalPath('Document', 'DOCUMENT', 'Private', 'html');

      expect(docMapping.fileName).toBe('Document.docx');
      expect(spreadsheetMapping.fileName).toBe('Spreadsheet.xlsx');
      expect(htmlMapping.fileName).toBe('Document.html');
    });

    it('should sanitize document titles', () => {
      const mapping = folderMapper.getDocumentLocalPath(
        'Unsafe<>:|?*Document',
        'DOCUMENT',
        'Private',
        'docx'
      );

      expect(mapping.fileName).toBe('Unsafe______Document.docx');
    });

    it('should handle empty document titles', () => {
      const mapping = folderMapper.getDocumentLocalPath(
        '',
        'DOCUMENT',
        'Private',
        'docx'
      );

      expect(mapping.fileName).toBe('Untitled.docx');
    });
  });

  describe('Folder Path Validation', () => {
    it('should validate correct folder paths', () => {
      const result = folderMapper.validateQuipFolderPath('Private/Projects/Important');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty folder paths', () => {
      const result = folderMapper.validateQuipFolderPath('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject paths with control characters', () => {
      const result = folderMapper.validateQuipFolderPath('Private\x00Projects');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid control characters');
    });

    it('should reject extremely long paths', () => {
      const longPath = 'Private/' + 'a'.repeat(1000);
      const result = folderMapper.validateQuipFolderPath(longPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      await folderMapper.initialize();
    });

    it('should provide folder structure statistics', async () => {
      // Create some folders
      const folders: QuipFolderInfo[] = [
        { id: '1', name: 'Folder1', type: 'private', fullPath: 'Private/Folder1' },
        { id: '2', name: 'Folder2', type: 'shared', fullPath: 'Shared/Folder2' }
      ];

      await folderMapper.mapQuipFolders(folders);

      const stats = await folderMapper.getFolderStructureStats();

      expect(stats.mappedFolders).toBe(2);
      expect(stats.totalFolders).toBeGreaterThan(0);
      expect(stats.localDirectoryStructure).toBeDefined();
      expect(stats.localDirectoryStructure.type).toBe('folder');
    });

    it('should generate folder report', async () => {
      const folder: QuipFolderInfo = {
        id: 'report1',
        name: 'Report Folder',
        type: 'private',
        fullPath: 'Private/Report'
      };

      await folderMapper.mapQuipFolder(folder);

      const report = folderMapper.generateFolderReport();

      expect(report.mappings).toHaveLength(1);
      expect(report.mappings[0].quipPath).toBe('Private/Report');
      expect(report.summary.totalMappings).toBe(1);
      expect(report.summary.preserveStructure).toBe(true);
      expect(report.summary.baseOutputPath).toBe(tempDir);
    });

    it('should clear mappings', async () => {
      const folder: QuipFolderInfo = {
        id: 'clear1',
        name: 'Clear Test',
        type: 'private',
        fullPath: 'Private/Clear'
      };

      await folderMapper.mapQuipFolder(folder);
      expect(folderMapper.getFolderMappings().size).toBe(1);

      folderMapper.clearMappings();
      expect(folderMapper.getFolderMappings().size).toBe(0);
    });
  });
});