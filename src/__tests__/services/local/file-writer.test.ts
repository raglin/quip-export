import { FileWriter } from '../../../services/local/file-writer';
import { DirectoryManager } from '../../../services/local/directory-manager';
import { LocalDirectoryConfig } from '../../../services/local/types';
import { ConsoleLogger } from '../../../core/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FileWriter', () => {
  let tempDir: string;
  let fileWriter: FileWriter;
  let directoryManager: DirectoryManager;
  let logger: ConsoleLogger;
  let config: LocalDirectoryConfig;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quip-file-writer-test-'));
    
    logger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    
    config = {
      baseOutputPath: tempDir,
      preserveFolderStructure: true,
      sanitizeFileNames: true,
      conflictResolution: 'number'
    };
    
    directoryManager = new DirectoryManager(config, logger);
    fileWriter = new FileWriter(directoryManager, config, logger);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Single Document Writing', () => {
    it('should write a text document successfully', async () => {
      const content = 'This is test content for a document';
      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content,
        exportFormat: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(path.join(tempDir, 'test.html'));
      expect(result.originalName).toBe('test.html');
      expect(result.finalName).toBe('test.html');
      expect(result.size).toBe(Buffer.from(content, 'utf8').length);

      // Verify file exists and has correct content
      const writtenContent = await fs.readFile(result.filePath!, 'utf8');
      expect(writtenContent).toBe(content);
    });

    it('should write a binary document successfully', async () => {
      const content = Buffer.from('This is binary content', 'utf8');
      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.docx',
        content,
        exportFormat: 'docx'
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(path.join(tempDir, 'test.docx'));
      expect(result.size).toBe(content.length);

      // Verify file exists and has correct content
      const writtenContent = await fs.readFile(result.filePath!);
      expect(writtenContent.equals(content)).toBe(true);
    });

    it('should sanitize unsafe filenames', async () => {
      const content = 'Test content';
      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'test<>:|?*file.html',
        content,
        exportFormat: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.originalName).toBe('test<>:|?*file.html');
      expect(result.finalName).toBe('test______file.html');
      expect(result.filePath).toBe(path.join(tempDir, 'test______file.html'));
    });

    it('should automatically add file extensions based on document type and export format', async () => {
      const content = 'Test content';
      
      // Test DOCX extension for DOCUMENT type
      const docResult = await fileWriter.writeDocument(tempDir, {
        fileName: 'My Document',
        content,
        documentType: 'DOCUMENT',
        exportFormat: 'docx'
      });

      expect(docResult.success).toBe(true);
      expect(docResult.finalName).toBe('My Document.docx');
      expect(docResult.filePath).toBe(path.join(tempDir, 'My Document.docx'));

      // Test XLSX extension for SPREADSHEET type
      const sheetResult = await fileWriter.writeDocument(tempDir, {
        fileName: 'My Spreadsheet',
        content,
        documentType: 'SPREADSHEET',
        exportFormat: 'xlsx'
      });

      expect(sheetResult.success).toBe(true);
      expect(sheetResult.finalName).toBe('My Spreadsheet.xlsx');
      expect(sheetResult.filePath).toBe(path.join(tempDir, 'My Spreadsheet.xlsx'));

      // Test HTML extension
      const htmlResult = await fileWriter.writeDocument(tempDir, {
        fileName: 'My Document',
        content,
        documentType: 'DOCUMENT',
        exportFormat: 'html'
      });

      expect(htmlResult.success).toBe(true);
      expect(htmlResult.finalName).toBe('My Document.html');
      expect(htmlResult.filePath).toBe(path.join(tempDir, 'My Document.html'));
    });

    it('should not duplicate extensions if already present', async () => {
      const content = 'Test content';
      
      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'My Document.docx',
        content,
        documentType: 'DOCUMENT',
        exportFormat: 'docx'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toBe('My Document.docx');
      expect(result.filePath).toBe(path.join(tempDir, 'My Document.docx'));
    });

    it('should handle file conflicts with numbering', async () => {
      const content = 'Test content';
      
      // Write first file
      const result1 = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content,
        exportFormat: 'html'
      });

      expect(result1.success).toBe(true);
      expect(result1.finalName).toBe('test.html');

      // Write second file with same name
      const result2 = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content: 'Different content',
        exportFormat: 'html'
      });

      expect(result2.success).toBe(true);
      expect(result2.finalName).toBe('test_1.html');
      expect(result2.filePath).toBe(path.join(tempDir, 'test_1.html'));
    });

    it('should handle file conflicts with timestamp strategy', async () => {
      const timestampConfig = { ...config, conflictResolution: 'timestamp' as const };
      const timestampManager = new DirectoryManager(timestampConfig, logger);
      const timestampWriter = new FileWriter(timestampManager, timestampConfig, logger);

      const content = 'Test content';
      
      // Write first file
      await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content,
        exportFormat: 'html'
      });

      // Write second file with same name using timestamp strategy
      const result = await timestampWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content: 'Different content',
        exportFormat: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toMatch(/^test_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.html$/);
    });

    it('should handle file conflicts with overwrite strategy', async () => {
      const overwriteConfig = { ...config, conflictResolution: 'overwrite' as const };
      const overwriteManager = new DirectoryManager(overwriteConfig, logger);
      const overwriteWriter = new FileWriter(overwriteManager, overwriteConfig, logger);

      const content1 = 'Original content';
      const content2 = 'New content';
      
      // Write first file
      await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content: content1,
        exportFormat: 'html'
      });

      // Write second file with same name using overwrite strategy
      const result = await overwriteWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content: content2,
        exportFormat: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toBe('test.html');

      // Verify content was overwritten
      const writtenContent = await fs.readFile(result.filePath!, 'utf8');
      expect(writtenContent).toBe(content2);
    });

    it('should create target directory if it does not exist', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'directory');
      const content = 'Test content';
      
      const result = await fileWriter.writeDocument(nestedDir, {
        fileName: 'test.html',
        content,
        exportFormat: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(path.join(nestedDir, 'test.html'));

      // Verify directory was created
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should track progress for large files', async () => {
      const largeContent = Buffer.alloc(2 * 1024 * 1024, 'a'); // 2MB file
      const progressUpdates: Array<{ bytesWritten: number; totalBytes: number; percentage: number }> = [];

      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'large.docx',
        content: largeContent,
        exportFormat: 'docx'
      }, (progress) => {
        progressUpdates.push(progress);
      });

      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have final progress update at 100%
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.percentage).toBe(100);
      expect(finalProgress.bytesWritten).toBe(largeContent.length);
    });

    it('should handle undefined content gracefully', async () => {
      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content: undefined as any,
        exportFormat: 'html'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content is required but was undefined');
      expect(result.originalName).toBe('test.html');
    });

    it('should handle null content gracefully', async () => {
      const result = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content: null as any,
        exportFormat: 'html'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content is required but was null');
      expect(result.originalName).toBe('test.html');
    });
  });

  describe('Batch Document Writing', () => {
    it('should write multiple documents successfully', async () => {
      const documents = [
        {
          targetDirectory: tempDir,
          options: {
            fileName: 'doc1.html',
            content: 'Content 1',
            exportFormat: 'html' as const
          }
        },
        {
          targetDirectory: tempDir,
          options: {
            fileName: 'doc2.docx',
            content: Buffer.from('Content 2'),
            exportFormat: 'docx' as const
          }
        }
      ];

      const progressUpdates: Array<{ current: number; total: number; currentFile: string }> = [];

      const results = await fileWriter.writeDocuments(documents, (current, total, currentFile) => {
        progressUpdates.push({ current, total, currentFile });
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0]).toEqual({ current: 1, total: 2, currentFile: 'doc1.html' });
      expect(progressUpdates[1]).toEqual({ current: 2, total: 2, currentFile: 'doc2.docx' });

      // Verify files exist
      const file1Stats = await fs.stat(path.join(tempDir, 'doc1.html'));
      const file2Stats = await fs.stat(path.join(tempDir, 'doc2.docx'));
      expect(file1Stats.isFile()).toBe(true);
      expect(file2Stats.isFile()).toBe(true);
    });

    it('should handle partial failures in batch writing', async () => {
      const documents = [
        {
          targetDirectory: tempDir,
          options: {
            fileName: 'good.html',
            content: 'Good content',
            exportFormat: 'html' as const
          }
        },
        {
          targetDirectory: '/invalid/path/that/does/not/exist',
          options: {
            fileName: 'bad.html',
            content: 'Bad content',
            exportFormat: 'html' as const
          }
        }
      ];

      const results = await fileWriter.writeDocuments(documents);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('Safe Filename Creation', () => {
    it('should create safe filenames for different document types', () => {
      expect(fileWriter.createSafeFileName('My Document', 'DOCUMENT', 'docx')).toBe('My Document.docx');
      expect(fileWriter.createSafeFileName('My Spreadsheet', 'SPREADSHEET', 'docx')).toBe('My Spreadsheet.xlsx');
      expect(fileWriter.createSafeFileName('My Document', 'DOCUMENT', 'html')).toBe('My Document.html');
    });

    it('should handle empty or invalid titles', () => {
      expect(fileWriter.createSafeFileName('', 'DOCUMENT', 'docx')).toBe('Untitled.docx');
      expect(fileWriter.createSafeFileName('   ', 'DOCUMENT', 'docx')).toBe('Untitled.docx');
    });

    it('should sanitize unsafe characters in titles', () => {
      const result = fileWriter.createSafeFileName('My<>:|?*Document', 'DOCUMENT', 'docx');
      expect(result).toBe('My______Document.docx');
    });
  });

  describe('File Statistics and Utilities', () => {
    it('should get file statistics for existing files', async () => {
      const content = 'Test content';
      const writeResult = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content,
        exportFormat: 'html'
      });

      const stats = await fileWriter.getFileStats(writeResult.filePath!);

      expect(stats.exists).toBe(true);
      expect(stats.size).toBe(Buffer.from(content, 'utf8').length);
      expect(stats.created).toBeDefined();
      expect(stats.modified).toBeDefined();
    });

    it('should handle non-existent files', async () => {
      const stats = await fileWriter.getFileStats(path.join(tempDir, 'nonexistent.html'));

      expect(stats.exists).toBe(false);
      expect(stats.size).toBeUndefined();
      expect(stats.error).toBeUndefined();
    });

    it('should cleanup files successfully', async () => {
      const content = 'Test content';
      const writeResult = await fileWriter.writeDocument(tempDir, {
        fileName: 'test.html',
        content,
        exportFormat: 'html'
      });

      // Verify file exists
      let stats = await fileWriter.getFileStats(writeResult.filePath!);
      expect(stats.exists).toBe(true);

      // Cleanup file
      const cleanupResult = await fileWriter.cleanupFile(writeResult.filePath!);
      expect(cleanupResult).toBe(true);

      // Verify file no longer exists
      stats = await fileWriter.getFileStats(writeResult.filePath!);
      expect(stats.exists).toBe(false);
    });
  });

  describe('Format-Based Document Writing', () => {
    beforeEach(async () => {
      await directoryManager.initializeBaseDirectory();
    });

    it('should write document to format-specific directory', async () => {
      const content = 'This is markdown content';
      const result = await fileWriter.writeFormatDocument({
        fileName: 'test-document',
        content,
        format: 'markdown',
        exportFormat: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toBe('test-document.md');
      
      const expectedPath = path.join(tempDir, 'markdown', 'test-document.md');
      expect(result.filePath).toBe(expectedPath);

      // Verify format directory was created
      const formatDirStats = await fs.stat(path.join(tempDir, 'markdown'));
      expect(formatDirStats.isDirectory()).toBe(true);

      // Verify file exists with correct content
      const writtenContent = await fs.readFile(result.filePath!, 'utf8');
      expect(writtenContent).toBe(content);
    });

    it('should write document to format-specific folder structure', async () => {
      const content = 'HTML content';
      const result = await fileWriter.writeFormatDocument({
        fileName: 'important-doc',
        content,
        format: 'html',
        exportFormat: 'html',
        quipFolderPath: 'Private/Projects'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toBe('important-doc.html');
      
      const expectedPath = path.join(tempDir, 'html', 'Private', 'Projects', 'important-doc.html');
      expect(result.filePath).toBe(expectedPath);

      // Verify nested directory structure was created
      const nestedDirStats = await fs.stat(path.join(tempDir, 'html', 'Private', 'Projects'));
      expect(nestedDirStats.isDirectory()).toBe(true);
    });

    it('should handle format-specific filename generation', async () => {
      const content = 'Test content';
      
      // Test different formats
      const formats = [
        { format: 'markdown', expectedExt: '.md' },
        { format: 'html', expectedExt: '.html' },
        { format: 'docx', expectedExt: '.docx' }
      ];

      for (const { format, expectedExt } of formats) {
        const result = await fileWriter.writeFormatDocument({
          fileName: `test-${format}`,
          content,
          format,
          exportFormat: format as any
        });

        expect(result.success).toBe(true);
        expect(result.finalName).toBe(`test-${format}${expectedExt}`);
        expect(result.filePath).toBe(path.join(tempDir, format, `test-${format}${expectedExt}`));
      }
    });

    it('should correct wrong file extensions for format', async () => {
      const content = 'Test content';
      const result = await fileWriter.writeFormatDocument({
        fileName: 'test.docx', // Wrong extension for markdown
        content,
        format: 'markdown',
        exportFormat: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toBe('test.md'); // Should be corrected to .md
      expect(result.filePath).toBe(path.join(tempDir, 'markdown', 'test.md'));
    });

    it('should handle flattened structure when preserveFolderStructure is false', async () => {
      const flatConfig = { ...config, preserveFolderStructure: false };
      const flatManager = new DirectoryManager(flatConfig, logger);
      const flatWriter = new FileWriter(flatManager, flatConfig, logger);

      const content = 'Test content';
      const result = await flatWriter.writeFormatDocument({
        fileName: 'test-doc',
        content,
        format: 'html',
        exportFormat: 'html',
        quipFolderPath: 'Private/Projects/Important'
      });

      expect(result.success).toBe(true);
      
      // Should be in format directory root, not nested
      const expectedPath = path.join(tempDir, 'html', 'test-doc.html');
      expect(result.filePath).toBe(expectedPath);
    });

    it('should sanitize filenames with format-specific handling', async () => {
      const content = 'Test content';
      const result = await fileWriter.writeFormatDocument({
        fileName: 'test<>:|?*file',
        content,
        format: 'markdown',
        exportFormat: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.finalName).toBe('test_file.md');
      expect(result.filePath).toBe(path.join(tempDir, 'markdown', 'test_file.md'));
    });

    it('should handle format directory creation errors gracefully', async () => {
      // Mock directory manager to simulate failure
      const failingManager = {
        ...directoryManager,
        createFormatDirectory: jest.fn().mockResolvedValue({
          success: false,
          error: 'Permission denied'
        })
      };

      const failingWriter = new FileWriter(failingManager as any, config, logger);

      const result = await failingWriter.writeFormatDocument({
        fileName: 'test',
        content: 'content',
        format: 'html',
        exportFormat: 'html'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('Format-Specific Filename Creation', () => {
    it('should create safe filenames for all supported formats', () => {
      const title = 'My Document';
      
      expect(fileWriter.createSafeFileNameForFormat(title, 'docx')).toBe('My Document.docx');
      expect(fileWriter.createSafeFileNameForFormat(title, 'html')).toBe('My Document.html');
      expect(fileWriter.createSafeFileNameForFormat(title, 'markdown')).toBe('My Document.md');
      expect(fileWriter.createSafeFileNameForFormat(title, 'xlsx')).toBe('My Document.xlsx');
    });

    it('should remove existing extensions and add format-specific ones', () => {
      expect(fileWriter.createSafeFileNameForFormat('document.docx', 'html')).toBe('document.html');
      expect(fileWriter.createSafeFileNameForFormat('spreadsheet.xlsx', 'markdown')).toBe('spreadsheet.md');
    });

    it('should handle empty titles with format context', () => {
      expect(fileWriter.createSafeFileNameForFormat('', 'html')).toBe('Untitled.html');
      expect(fileWriter.createSafeFileNameForFormat('   ', 'markdown')).toBe('Untitled.md');
    });

    it('should sanitize unsafe characters with format-specific extensions', () => {
      const result = fileWriter.createSafeFileNameForFormat('My<>:|?*Document', 'html');
      expect(result).toBe('My_Document.html');
    });

    it('should handle multiple dots in filenames', () => {
      const result = fileWriter.createSafeFileNameForFormat('my.backup.document.old', 'markdown');
      expect(result).toBe('my.backup.document.md');
    });
  });
});