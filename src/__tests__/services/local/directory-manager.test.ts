import { DirectoryManager } from '../../../services/local/directory-manager';
import { LocalDirectoryConfig } from '../../../services/local/types';
import { ConsoleLogger } from '../../../core/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DirectoryManager', () => {
  let tempDir: string;
  let directoryManager: DirectoryManager;
  let logger: ConsoleLogger;
  let config: LocalDirectoryConfig;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quip-export-test-'));
    
    logger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    
    config = {
      baseOutputPath: tempDir,
      preserveFolderStructure: true,
      sanitizeFileNames: true,
      conflictResolution: 'number'
    };
    
    directoryManager = new DirectoryManager(config, logger);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Base Directory Management', () => {
    it('should initialize base directory successfully', async () => {
      const result = await directoryManager.initializeBaseDirectory();
      
      expect(result.success).toBe(true);
      expect(result.directoryPath).toBe(tempDir);
      expect(result.created).toBe(true);
      
      // Verify directory exists
      const stats = await fs.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle existing base directory', async () => {
      // Directory already exists from beforeEach
      const result = await directoryManager.initializeBaseDirectory();
      
      expect(result.success).toBe(true);
      expect(result.directoryPath).toBe(tempDir);
    });

    it('should detect write permission issues', async () => {
      // Create a read-only directory (if possible on this platform)
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      
      try {
        await fs.chmod(readOnlyDir, 0o444); // Read-only
        
        const readOnlyConfig = { ...config, baseOutputPath: readOnlyDir };
        const readOnlyManager = new DirectoryManager(readOnlyConfig, logger);
        
        const result = await readOnlyManager.initializeBaseDirectory();
        
        // Should fail due to write permissions (on systems that support it)
        if (process.platform !== 'win32') {
          expect(result.success).toBe(false);
          expect(result.error).toContain('No write permission');
        }
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });
  });

  describe('Quip Folder Structure Creation', () => {
    it('should create nested folder structure', async () => {
      await directoryManager.initializeBaseDirectory();
      
      const result = await directoryManager.createQuipFolderStructure('Private/Projects/Important');
      
      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      
      const expectedPath = path.join(tempDir, 'Private', 'Projects', 'Important');
      expect(result.directoryPath).toBe(expectedPath);
      
      // Verify directory exists
      const stats = await fs.stat(expectedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle root folder path', async () => {
      await directoryManager.initializeBaseDirectory();
      
      const result = await directoryManager.createQuipFolderStructure('');
      
      expect(result.success).toBe(true);
      
      const expectedPath = path.join(tempDir, 'Root');
      expect(result.directoryPath).toBe(expectedPath);
    });

    it('should sanitize unsafe folder names', async () => {
      await directoryManager.initializeBaseDirectory();
      
      const result = await directoryManager.createQuipFolderStructure('Private/Projects<>:|?*/Important');
      
      expect(result.success).toBe(true);
      
      // Unsafe characters are replaced: < > : | ? * / → _ _ - _ _ _ -
      // After collapsing consecutive separators: Projects-
      const expectedPath = path.join(tempDir, 'Private', 'Projects-', 'Important');
      expect(result.directoryPath).toBe(expectedPath);
      
      const stats = await fs.stat(expectedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle flattened structure when preserveFolderStructure is false', async () => {
      const flatConfig = { ...config, preserveFolderStructure: false };
      const flatManager = new DirectoryManager(flatConfig, logger);
      
      await flatManager.initializeBaseDirectory();
      
      const result = await flatManager.createQuipFolderStructure('Private/Projects/Important');
      
      expect(result.success).toBe(true);
      expect(result.directoryPath).toBe(tempDir);
    });
  });

  describe('Folder Type Directories', () => {
    it('should create folder type directories', async () => {
      await directoryManager.initializeBaseDirectory();
      
      const result = await directoryManager.createFolderTypeDirectory('Private');
      
      expect(result.success).toBe(true);
      
      const expectedPath = path.join(tempDir, 'Private');
      expect(result.directoryPath).toBe(expectedPath);
      
      const stats = await fs.stat(expectedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should sanitize folder type names', async () => {
      await directoryManager.initializeBaseDirectory();
      
      const result = await directoryManager.createFolderTypeDirectory('Shared<>Folder');
      
      expect(result.success).toBe(true);
      
      const expectedPath = path.join(tempDir, 'Shared_Folder'); // Consecutive separators collapsed
      expect(result.directoryPath).toBe(expectedPath);
    });
  });

  describe('File Path Conflict Resolution', () => {
    beforeEach(async () => {
      await directoryManager.initializeBaseDirectory();
    });

    it('should return original path when no conflict exists', async () => {
      const result = await directoryManager.resolveFilePathConflict(tempDir, 'test.docx');
      
      expect(result.strategy).toBe('original');
      expect(result.finalName).toBe('test.docx');
      expect(result.resolvedPath).toBe(path.join(tempDir, 'test.docx'));
    });

    it('should resolve conflicts with numbering strategy', async () => {
      // Create a conflicting file
      const conflictFile = path.join(tempDir, 'test.docx');
      await fs.writeFile(conflictFile, 'existing content');
      
      const result = await directoryManager.resolveFilePathConflict(tempDir, 'test.docx');
      
      expect(result.strategy).toBe('numbered');
      expect(result.finalName).toBe('test_1.docx');
      expect(result.resolvedPath).toBe(path.join(tempDir, 'test_1.docx'));
    });

    it('should resolve conflicts with timestamp strategy', async () => {
      const timestampConfig = { ...config, conflictResolution: 'timestamp' as const };
      const timestampManager = new DirectoryManager(timestampConfig, logger);
      
      // Create a conflicting file
      const conflictFile = path.join(tempDir, 'test.docx');
      await fs.writeFile(conflictFile, 'existing content');
      
      const result = await timestampManager.resolveFilePathConflict(tempDir, 'test.docx');
      
      expect(result.strategy).toBe('timestamped');
      expect(result.finalName).toMatch(/^test_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.docx$/);
    });

    it('should handle overwrite strategy', async () => {
      const overwriteConfig = { ...config, conflictResolution: 'overwrite' as const };
      const overwriteManager = new DirectoryManager(overwriteConfig, logger);
      
      // Create a conflicting file
      const conflictFile = path.join(tempDir, 'test.docx');
      await fs.writeFile(conflictFile, 'existing content');
      
      const result = await overwriteManager.resolveFilePathConflict(tempDir, 'test.docx');
      
      expect(result.strategy).toBe('overwritten');
      expect(result.finalName).toBe('test.docx');
      expect(result.resolvedPath).toBe(conflictFile);
    });
  });

  describe('Directory Analysis', () => {
    it('should analyze directory structure', async () => {
      await directoryManager.initializeBaseDirectory();
      
      // Create some test structure
      await directoryManager.createFolderTypeDirectory('Private');
      await directoryManager.createFolderTypeDirectory('Archive');
      
      // Add some test files
      await fs.writeFile(path.join(tempDir, 'Private', 'test1.docx'), 'content1');
      await fs.writeFile(path.join(tempDir, 'Archive', 'test2.docx'), 'content2');
      
      const structure = await directoryManager.analyzeDirectoryStructure();
      
      expect(structure.type).toBe('folder');
      expect(structure.children).toBeDefined();
      expect(structure.children!.length).toBeGreaterThan(0);
      
      // Should find the Private and Archive folders
      const folderNames = structure.children!.map(child => child.name);
      expect(folderNames).toContain('Private');
      expect(folderNames).toContain('Archive');
    });
  });

  describe('Target Directory Path', () => {
    it('should return correct target path with folder structure preservation', async () => {
      const targetPath = directoryManager.getTargetDirectoryPath('Private/Projects');
      
      const expectedPath = path.join(tempDir, 'Private', 'Projects');
      expect(targetPath).toBe(expectedPath);
    });

    it('should return base path when not preserving folder structure', async () => {
      const flatConfig = { ...config, preserveFolderStructure: false };
      const flatManager = new DirectoryManager(flatConfig, logger);
      
      const targetPath = flatManager.getTargetDirectoryPath('Private/Projects');
      
      expect(targetPath).toBe(tempDir);
    });
  });

  describe('Format-Based Directory Management', () => {
    beforeEach(async () => {
      await directoryManager.initializeBaseDirectory();
    });

    it('should create format directory successfully', async () => {
      const result = await directoryManager.createFormatDirectory('markdown');
      
      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      
      const expectedPath = path.join(tempDir, 'markdown');
      expect(result.directoryPath).toBe(expectedPath);
      
      // Verify directory exists
      const stats = await fs.stat(expectedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create multiple format directories', async () => {
      const formats = ['docx', 'html', 'markdown'];
      
      for (const format of formats) {
        const result = await directoryManager.createFormatDirectory(format);
        expect(result.success).toBe(true);
        
        const expectedPath = path.join(tempDir, format);
        const stats = await fs.stat(expectedPath);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should get format directory path with folder structure preservation', async () => {
      const formatPath = directoryManager.getFormatDirectoryPath('html', 'Private/Projects');
      
      const expectedPath = path.join(tempDir, 'html', 'Private', 'Projects');
      expect(formatPath).toBe(expectedPath);
    });

    it('should get format directory path without folder structure preservation', async () => {
      const flatConfig = { ...config, preserveFolderStructure: false };
      const flatManager = new DirectoryManager(flatConfig, logger);
      
      const formatPath = flatManager.getFormatDirectoryPath('html', 'Private/Projects');
      
      const expectedPath = path.join(tempDir, 'html');
      expect(formatPath).toBe(expectedPath);
    });

    it('should create format-specific Quip folder structure', async () => {
      const result = await directoryManager.createFormatQuipFolderStructure('markdown', 'Private/Projects/Important');
      
      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      
      const expectedPath = path.join(tempDir, 'markdown', 'Private', 'Projects', 'Important');
      expect(result.directoryPath).toBe(expectedPath);
      
      // Verify directory exists
      const stats = await fs.stat(expectedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle format-specific file path conflicts with numbering', async () => {
      // Create a conflicting file
      const formatDir = path.join(tempDir, 'html');
      await fs.mkdir(formatDir, { recursive: true });
      const conflictFile = path.join(formatDir, 'test.html');
      await fs.writeFile(conflictFile, 'existing content');
      
      const result = await directoryManager.resolveFormatFilePathConflict(formatDir, 'test.html', 'html');
      
      expect(result.strategy).toBe('numbered');
      expect(result.finalName).toBe('test_1.html');
      expect(result.resolvedPath).toBe(path.join(formatDir, 'test_1.html'));
    });

    it('should handle format-specific file path conflicts with timestamp', async () => {
      const timestampConfig = { ...config, conflictResolution: 'timestamp' as const };
      const timestampManager = new DirectoryManager(timestampConfig, logger);
      
      // Create a conflicting file
      const formatDir = path.join(tempDir, 'markdown');
      await fs.mkdir(formatDir, { recursive: true });
      const conflictFile = path.join(formatDir, 'test.md');
      await fs.writeFile(conflictFile, 'existing content');
      
      const result = await timestampManager.resolveFormatFilePathConflict(formatDir, 'test.md', 'markdown');
      
      expect(result.strategy).toBe('timestamped');
      expect(result.finalName).toMatch(/^test_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.md$/);
    });

    it('should return original path when no format conflict exists', async () => {
      const formatDir = path.join(tempDir, 'html');
      await fs.mkdir(formatDir, { recursive: true });
      
      const result = await directoryManager.resolveFormatFilePathConflict(formatDir, 'test.html', 'html');
      
      expect(result.strategy).toBe('original');
      expect(result.finalName).toBe('test.html');
      expect(result.resolvedPath).toBe(path.join(formatDir, 'test.html'));
    });
  });
});