import { ConsoleLogger } from '../../core/logger';
import { ErrorHandler } from '../../core/error-handler';
import { BatchProcessor } from '../../core/batch-processor';
import { ExportStateManager } from '../../core/export-state-manager';
import { ExportConfigManager } from '../../core/export-config-manager';
import { DirectoryManager } from '../../services/local/directory-manager';
import { FileWriter } from '../../services/local/file-writer';
import { LocalDirectoryConfig } from '../../services/local/types';
import { ExportConfig } from '../../core/export-types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Basic Integration Tests', () => {
  let tempDir: string;
  let logger: ConsoleLogger;

  beforeAll(async () => {
    // Create temporary directory for test operations
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'basic-integration-test-'));
    logger = new ConsoleLogger('ERROR'); // Reduce noise in tests
  });

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Core Components Integration', () => {
    it('should initialize core components successfully', () => {
      const errorHandler = new ErrorHandler(logger);
      const batchProcessor = new BatchProcessor(logger, {
        batchSize: 5,
        concurrency: 2,
        rateLimitDelay: 0,
        maxRetries: 2,
        retryDelay: 100
      });
      const stateManager = new ExportStateManager(logger);
      const configManager = new ExportConfigManager();

      expect(errorHandler).toBeDefined();
      expect(batchProcessor).toBeDefined();
      expect(stateManager).toBeDefined();
      expect(configManager).toBeDefined();
    });

    it('should handle error categorization', async () => {
      const errorHandler = new ErrorHandler(logger);

      // Test different error types
      const authError = new Error('Unauthorized access');
      const networkError = new Error('Network timeout');
      const fileError = new Error('ENOENT: no such file or directory');

      // These should not throw errors
      const authResult = await errorHandler.handleError(authError, { 
        operation: 'auth',
        timestamp: new Date()
      });
      const networkResult = await errorHandler.handleError(networkError, { 
        operation: 'network',
        timestamp: new Date()
      });
      const fileResult = await errorHandler.handleError(fileError, { 
        operation: 'file',
        timestamp: new Date()
      });

      expect(authResult).toBeDefined();
      expect(networkResult).toBeDefined();
      expect(fileResult).toBeDefined();
    });

    it('should process items in batches', async () => {
      const batchProcessor = new BatchProcessor(logger, {
        batchSize: 3,
        concurrency: 2,
        rateLimitDelay: 0,
        maxRetries: 2,
        retryDelay: 100
      });

      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
        priority: 1,
        retryCount: 0,
        status: 'pending' as const
      }));

      const mockProcessor = jest.fn().mockImplementation(async (item: any) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${item.value}`;
      });

      const result = await batchProcessor.process(items, mockProcessor);

      expect(result.successfulItems).toBe(5);
      expect(result.failedItems).toBe(0);
      expect(mockProcessor).toHaveBeenCalledTimes(5);
    });
  });

  describe('File System Integration', () => {
    it('should create directories and write files', async () => {
      const config: LocalDirectoryConfig = {
        baseOutputPath: tempDir,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const directoryManager = new DirectoryManager(config, logger);
      const fileWriter = new FileWriter(directoryManager, config, logger);

      // Create a test directory
      const testDir = path.join(tempDir, 'test-folder');
      const dirResult = await directoryManager.createQuipFolderStructure(testDir);
      expect(dirResult.success).toBe(true);

      // Write a test file
      const testContent = Buffer.from('Test file content');
      const writeResult = await fileWriter.writeDocument(
        testDir,
        {
          fileName: 'test-file.txt',
          content: testContent,
          overwrite: false
        }
      );

      expect(writeResult.success).toBe(true);
      expect(writeResult.filePath).toBe(path.join(testDir, 'test-file.txt'));

      // Verify file was written correctly
      const writtenContent = await fs.readFile(path.join(testDir, 'test-file.txt'));
      expect(writtenContent).toEqual(testContent);
    });

    it('should handle file name conflicts', async () => {
      const config: LocalDirectoryConfig = {
        baseOutputPath: tempDir,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const directoryManager = new DirectoryManager(config, logger);
      const fileWriter = new FileWriter(directoryManager, config, logger);

      const testDir = path.join(tempDir, 'conflict-test');
      await directoryManager.createQuipFolderStructure(testDir);

      // Write first file
      const content1 = Buffer.from('First file');
      const result1 = await fileWriter.writeDocument(
        testDir,
        {
          fileName: 'duplicate.txt',
          content: content1,
          overwrite: false
        }
      );
      expect(result1.success).toBe(true);

      // Write second file with same name
      const content2 = Buffer.from('Second file');
      const result2 = await fileWriter.writeDocument(
        testDir,
        {
          fileName: 'duplicate.txt',
          content: content2,
          overwrite: false
        }
      );
      expect(result2.success).toBe(true);
      expect(result2.finalName).not.toBe('duplicate.txt'); // Should be renamed

      // Verify both files exist
      const files = await fs.readdir(testDir);
      expect(files.length).toBe(2);
    });

    it('should sanitize invalid file names', async () => {
      const config: LocalDirectoryConfig = {
        baseOutputPath: tempDir,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const directoryManager = new DirectoryManager(config, logger);
      const fileWriter = new FileWriter(directoryManager, config, logger);

      const testDir = path.join(tempDir, 'sanitize-test');
      await directoryManager.createQuipFolderStructure(testDir);

      // Try to write file with invalid characters
      const content = Buffer.from('Test content');
      const result = await fileWriter.writeDocument(
        testDir,
        {
          fileName: 'file<with>invalid:chars.txt',
          content: content,
          overwrite: false
        }
      );

      expect(result.success).toBe(true);
      expect(result.finalName).not.toMatch(/[<>:"|*?\\\/]/);

      // Verify file was created with sanitized name
      const files = await fs.readdir(testDir);
      expect(files.length).toBe(1);
      expect(files[0]).not.toMatch(/[<>:"|*?\\\/]/);
    });
  });

  describe('Configuration Management Integration', () => {
    it('should validate export configurations', () => {
      const validConfig: ExportConfig = {
        outputDirectory: tempDir,
        exportFormat: 'native',
        maxDocuments: 10,
        includeSharedDocuments: true,
        includeFolders: [],
        rateLimitDelay: 1000,
        retryAttempts: 3,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const validation = ExportConfigManager.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configurations', () => {
      const invalidConfig: ExportConfig = {
        outputDirectory: '', // Invalid: empty directory
        exportFormat: 'native',
        maxDocuments: -1, // Invalid: negative number
        includeSharedDocuments: true,
        includeFolders: [],
        rateLimitDelay: 1000,
        retryAttempts: 3,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const validation = ExportConfigManager.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('State Management Integration', () => {
    it('should manage export state lifecycle', async () => {
      const stateManager = new ExportStateManager(logger);

      const config: ExportConfig = {
        outputDirectory: tempDir,
        exportFormat: 'native',
        maxDocuments: 5,
        includeSharedDocuments: true,
        includeFolders: [],
        rateLimitDelay: 1000,
        retryAttempts: 3,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      // Create session and initialize export
      const session = stateManager.createSession(config);
      expect(session.state.status).toBe('initializing');

      // Initialize with document count
      stateManager.initializeExport(3);
      const currentSession = stateManager.getCurrentSession();
      expect(currentSession?.state.status).toBe('discovering');
      expect(currentSession?.state.totalDocuments).toBe(3);

      // Start export
      stateManager.startExport();
      const startedSession = stateManager.getCurrentSession();
      expect(startedSession?.state.status).toBe('exporting');

      // Update progress
      stateManager.updateState({ 
        processedDocuments: 1,
        currentDocument: 'Document 1',
        currentFolder: 'Private'
      });
      const progressSession = stateManager.getCurrentSession();
      expect(progressSession?.state.processedDocuments).toBe(1);

      // Complete export
      stateManager.setStatus('completed');
      const completedSession = stateManager.getCurrentSession();
      expect(completedSession?.state.status).toBe('completed');
    });

    it('should handle export failures', async () => {
      const stateManager = new ExportStateManager(logger);

      const config: ExportConfig = {
        outputDirectory: tempDir,
        exportFormat: 'native',
        maxDocuments: 1,
        includeSharedDocuments: true,
        includeFolders: [],
        rateLimitDelay: 1000,
        retryAttempts: 3,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      stateManager.createSession(config);
      stateManager.initializeExport(1);
      stateManager.startExport();

      // Simulate failure
      stateManager.setStatus('failed');

      const failedSession = stateManager.getCurrentSession();
      expect(failedSession?.state.status).toBe('failed');
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete a basic export workflow', async () => {
      const config: LocalDirectoryConfig = {
        baseOutputPath: tempDir,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const exportConfig: ExportConfig = {
        outputDirectory: tempDir,
        exportFormat: 'native',
        maxDocuments: 3,
        includeSharedDocuments: true,
        includeFolders: [],
        rateLimitDelay: 0, // No delay for tests
        retryAttempts: 2,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      // Mock documents to process
      const mockDocuments = [
        { id: 'doc1', title: 'Document 1', content: 'Content 1' },
        { id: 'doc2', title: 'Document 2', content: 'Content 2' },
        { id: 'doc3', title: 'Document 3', content: 'Content 3' }
      ];

      // Initialize components
      const batchProcessor = new BatchProcessor(logger, {
        batchSize: 2,
        concurrency: 1,
        rateLimitDelay: 0,
        maxRetries: 2,
        retryDelay: 100
      });
      const stateManager = new ExportStateManager(logger);
      const directoryManager = new DirectoryManager(config, logger);
      const fileWriter = new FileWriter(directoryManager, config, logger);

      // Validate configuration
      const validation = ExportConfigManager.validateConfig(exportConfig);
      expect(validation.isValid).toBe(true);

      // Initialize export state
      stateManager.createSession(exportConfig);
      stateManager.initializeExport(mockDocuments.length);
      stateManager.startExport();

      // Process documents
      const items = mockDocuments.map(doc => ({
        id: doc.id,
        value: doc,
        priority: 1,
        retryCount: 0,
        status: 'pending' as const
      }));

      const mockProcessor = jest.fn().mockImplementation(async (item: any) => {
        const doc = item.value;
        
        // Create directory for document
        const docDir = path.join(tempDir, 'Documents');
        await directoryManager.createQuipFolderStructure(docDir);
        
        // Write document file
        const content = Buffer.from(doc.content);
        const writeResult = await fileWriter.writeDocument(
          docDir,
          {
            fileName: `${doc.title}.txt`,
            content: content,
            overwrite: false
          }
        );

        if (!writeResult.success) {
          throw new Error(`Failed to write ${doc.title}: ${writeResult.error}`);
        }

        // Update progress
        stateManager.updateState({ 
          processedDocuments: (stateManager.getCurrentSession()?.state.processedDocuments || 0) + 1,
          currentDocument: doc.title,
          currentFolder: 'Documents'
        });

        return {
          documentId: doc.id,
          title: doc.title,
          filePath: writeResult.filePath
        };
      });

      // Execute batch processing
      const result = await batchProcessor.process(items, mockProcessor);

      // Verify results
      expect(result.successfulItems).toBe(3);
      expect(result.failedItems).toBe(0);

      // Complete export
      stateManager.setStatus('completed');
      const finalSession = stateManager.getCurrentSession();
      expect(finalSession?.state.status).toBe('completed');
      expect(finalSession?.state.processedDocuments).toBe(3);

      // Verify files were created
      const documentsDir = path.join(tempDir, 'Documents');
      const files = await fs.readdir(documentsDir);
      expect(files).toContain('Document 1.txt');
      expect(files).toContain('Document 2.txt');
      expect(files).toContain('Document 3.txt');

      // Verify file contents
      for (const doc of mockDocuments) {
        const filePath = path.join(documentsDir, `${doc.title}.txt`);
        const fileContent = await fs.readFile(filePath, 'utf8');
        expect(fileContent).toBe(doc.content);
      }
    });

    it('should handle partial failures gracefully', async () => {
      const config: LocalDirectoryConfig = {
        baseOutputPath: tempDir,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const exportConfig: ExportConfig = {
        outputDirectory: tempDir,
        exportFormat: 'native',
        maxDocuments: 3,
        includeSharedDocuments: true,
        includeFolders: [],
        rateLimitDelay: 0,
        retryAttempts: 1,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'number'
      };

      const mockDocuments = [
        { id: 'good1', title: 'Good Document 1', content: 'Content 1', shouldFail: false },
        { id: 'bad1', title: 'Bad Document', content: 'Content 2', shouldFail: true },
        { id: 'good2', title: 'Good Document 2', content: 'Content 3', shouldFail: false }
      ];

      const batchProcessor = new BatchProcessor(logger, {
        batchSize: 2,
        concurrency: 1,
        rateLimitDelay: 0,
        maxRetries: 2,
        retryDelay: 100
      });
      const stateManager = new ExportStateManager(logger);
      const directoryManager = new DirectoryManager(config, logger);
      const fileWriter = new FileWriter(directoryManager, config, logger);

      stateManager.createSession(exportConfig);
      stateManager.initializeExport(mockDocuments.length);
      stateManager.startExport();

      const items = mockDocuments.map(doc => ({
        id: doc.id,
        value: doc,
        priority: 1,
        retryCount: 0,
        status: 'pending' as const
      }));

      const mockProcessor = jest.fn().mockImplementation(async (item: any) => {
        const doc = item.value;
        
        if (doc.shouldFail) {
          throw new Error(`Simulated failure for ${doc.title}`);
        }

        const docDir = path.join(tempDir, 'PartialTest');
        await directoryManager.createQuipFolderStructure(docDir);
        
        const content = Buffer.from(doc.content);
        const writeResult = await fileWriter.writeDocument(
          docDir,
          {
            fileName: `${doc.title}.txt`,
            content: content,
            overwrite: false
          }
        );

        if (!writeResult.success) {
          throw new Error(`Failed to write ${doc.title}`);
        }

        stateManager.updateState({ 
          processedDocuments: (stateManager.getCurrentSession()?.state.processedDocuments || 0) + 1,
          currentDocument: doc.title,
          currentFolder: 'PartialTest'
        });
        return { documentId: doc.id, title: doc.title };
      });

      const result = await batchProcessor.process(items, mockProcessor);

      // Should have 2 successes and 1 failure
      expect(result.successfulItems).toBe(2);
      expect(result.failedItems).toBe(1);

      stateManager.setStatus('completed');
      const finalSession = stateManager.getCurrentSession();
      expect(finalSession?.state.status).toBe('completed');

      // Verify only successful files were created
      const testDir = path.join(tempDir, 'PartialTest');
      const files = await fs.readdir(testDir);
      expect(files).toContain('Good Document 1.txt');
      expect(files).toContain('Good Document 2.txt');
      expect(files).not.toContain('Bad Document.txt');
    });
  });
});