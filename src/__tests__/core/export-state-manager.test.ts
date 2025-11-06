import { ExportStateManager } from '../../core/export-state-manager';
import { ExportConfigManager } from '../../core/export-config-manager';
import { ExportConfig, ExportProgress, ExportState } from '../../core/export-types';
import { ConsoleLogger } from '../../core/logger';

describe('ExportStateManager', () => {
  let stateManager: ExportStateManager;
  let logger: ConsoleLogger;
  let config: ExportConfig;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    stateManager = new ExportStateManager(logger);
    config = ExportConfigManager.createDefault();
  });

  describe('Session Management', () => {
    it('should create a new export session', () => {
      const session = stateManager.createSession(config);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^export_[a-z0-9]+_[a-z0-9]+$/);
      expect(session.config).toEqual(config);
      expect(session.state.sessionId).toBe(session.id);
      expect(session.state.status).toBe('initializing');
      expect(session.state.totalDocuments).toBe(0);
      expect(session.state.processedDocuments).toBe(0);
      expect(session.state.successfulExports).toBe(0);
      expect(session.state.failedExports).toBe(0);
    });

    it('should get current session', () => {
      expect(stateManager.getCurrentSession()).toBeNull();

      const session = stateManager.createSession(config);
      expect(stateManager.getCurrentSession()).toBe(session);
    });

    it('should clear session', () => {
      stateManager.createSession(config);
      expect(stateManager.getCurrentSession()).not.toBeNull();

      stateManager.clearSession();
      expect(stateManager.getCurrentSession()).toBeNull();
    });

    it('should update configuration', (done) => {
      const session = stateManager.createSession(config);
      const originalUpdatedAt = session.updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        stateManager.updateConfig({ exportFormat: 'html' });

        expect(session.config.exportFormat).toBe('html');
        expect(session.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        done();
      }, 10);
    });

    it('should throw error when updating config without session', () => {
      expect(() => {
        stateManager.updateConfig({ exportFormat: 'html' });
      }).toThrow('No active export session');
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      stateManager.createSession(config);
    });

    it('should update export state', () => {
      stateManager.updateState({ totalDocuments: 100 });

      const session = stateManager.getCurrentSession()!;
      expect(session.state.totalDocuments).toBe(100);
      expect(session.state.lastUpdateTime).toBeInstanceOf(Date);
    });

    it('should set export status', () => {
      stateManager.setStatus('exporting');

      const session = stateManager.getCurrentSession()!;
      expect(session.state.status).toBe('exporting');
    });

    it('should initialize export', () => {
      stateManager.initializeExport(50);

      const session = stateManager.getCurrentSession()!;
      expect(session.state.totalDocuments).toBe(50);
      expect(session.state.status).toBe('discovering');
    });

    it('should start export', () => {
      stateManager.startExport();

      const session = stateManager.getCurrentSession()!;
      expect(session.state.status).toBe('exporting');
      expect(session.state.startTime).toBeInstanceOf(Date);
    });

    it('should track document export start', () => {
      stateManager.startDocumentExport('doc1', 'Test Document', 'Private/Folder');

      const session = stateManager.getCurrentSession()!;
      expect(session.state.currentDocument).toBe('Test Document');
      expect(session.state.currentFolder).toBe('Private/Folder');
    });

    it('should complete document export', () => {
      stateManager.initializeExport(10);
      stateManager.completeDocumentExport();

      const session = stateManager.getCurrentSession()!;
      expect(session.state.processedDocuments).toBe(1);
      expect(session.state.successfulExports).toBe(1);
    });

    it('should handle document export failure', () => {
      stateManager.initializeExport(10);
      stateManager.failDocumentExport('doc1', 'Test Document', 'Private/Folder', 'Export failed', 1);

      const session = stateManager.getCurrentSession()!;
      expect(session.state.processedDocuments).toBe(1);
      expect(session.state.failedExports).toBe(1);
      expect(session.state.errors).toHaveLength(1);
      expect(session.state.errors[0].documentId).toBe('doc1');
      expect(session.state.errors[0].error).toBe('Export failed');
      expect(session.state.errors[0].retryCount).toBe(1);
    });

    it('should complete export', () => {
      stateManager.completeExport();

      const session = stateManager.getCurrentSession()!;
      expect(session.state.status).toBe('completed');
      expect(session.state.currentDocument).toBeUndefined();
      expect(session.state.currentFolder).toBeUndefined();
    });

    it('should fail export', () => {
      stateManager.failExport('Critical error occurred');

      const session = stateManager.getCurrentSession()!;
      expect(session.state.status).toBe('failed');
    });

    it('should cancel export', () => {
      stateManager.cancelExport();

      const session = stateManager.getCurrentSession()!;
      expect(session.state.status).toBe('cancelled');
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      stateManager.createSession(config);
      stateManager.initializeExport(100);
    });

    it('should calculate progress correctly', () => {
      stateManager.updateState({ processedDocuments: 25 });

      const progress = stateManager.getProgress();

      expect(progress.current).toBe(25);
      expect(progress.total).toBe(100);
      expect(progress.percentage).toBe(25);
    });

    it('should handle zero total documents', () => {
      stateManager.updateState({ totalDocuments: 0, processedDocuments: 0 });

      const progress = stateManager.getProgress();

      expect(progress.percentage).toBe(0);
    });

    it('should calculate export speed and estimated time', () => {
      // Simulate some time passing and documents processed
      const session = stateManager.getCurrentSession()!;
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago
      session.state.startTime = pastTime;
      
      stateManager.updateState({ processedDocuments: 10 });

      const progress = stateManager.getProgress();

      expect(progress.exportSpeed).toBeGreaterThan(0);
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    it('should notify progress callbacks', () => {
      const progressUpdates: ExportProgress[] = [];
      
      stateManager.onProgress((progress) => {
        progressUpdates.push(progress);
      });

      stateManager.updateState({ processedDocuments: 10 });

      expect(progressUpdates).toHaveLength(1);
      expect(progressUpdates[0].current).toBe(10);
    });

    it('should notify state change callbacks', () => {
      const stateUpdates: ExportState[] = [];
      
      stateManager.onStateChange((state) => {
        stateUpdates.push({ ...state });
      });

      stateManager.setStatus('exporting');

      expect(stateUpdates).toHaveLength(1);
      expect(stateUpdates[0].status).toBe('exporting');
    });

    it('should remove callbacks', () => {
      const callback = jest.fn();
      
      stateManager.onProgress(callback);
      stateManager.updateState({ processedDocuments: 5 });
      expect(callback).toHaveBeenCalledTimes(1);

      stateManager.removeProgressCallback(callback);
      stateManager.updateState({ processedDocuments: 10 });
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Summary Generation', () => {
    beforeEach(() => {
      stateManager.createSession(config);
      stateManager.initializeExport(10);
    });

    it('should generate export summary', () => {
      // Set start time to ensure duration > 0
      const session = stateManager.getCurrentSession()!;
      session.state.startTime = new Date(Date.now() - 1000); // 1 second ago
      
      // Simulate some exports
      stateManager.completeDocumentExport();
      stateManager.failDocumentExport('doc2', 'Failed Doc', 'Private', 'Export error');

      const summary = stateManager.generateSummary();

      expect(summary.sessionId).toBeDefined();
      expect(summary.totalDocuments).toBe(10);
      expect(summary.successfulExports).toBe(1);
      expect(summary.failedExports).toBe(1);
      expect(summary.skippedDocuments).toBe(8);
      expect(summary.errors).toHaveLength(1);
      expect(summary.duration).toBeGreaterThan(0);
    });

    it('should include folder summaries in export summary', () => {
      const folderSummaries = [
        {
          folderPath: 'Private',
          localPath: '/export/Private',
          documentCount: 5,
          successfulExports: 4,
          failedExports: 1,
          totalSize: 5120
        }
      ];

      const summary = stateManager.generateSummary(folderSummaries);

      expect(summary.folderStructure).toEqual(folderSummaries);
      expect(summary.totalSize).toBe(5120);
    });
  });

  describe('Statistics', () => {
    it('should provide statistics without session', () => {
      const stats = stateManager.getStatistics();

      expect(stats.totalSessions).toBe(0);
      expect(stats.currentSession).toBeNull();
      expect(stats.averageExportSpeed).toBeUndefined();
      expect(stats.successRate).toBeUndefined();
    });

    it('should provide statistics with active session', () => {
      stateManager.createSession(config);
      stateManager.initializeExport(20);
      
      // Simulate some time and progress
      const session = stateManager.getCurrentSession()!;
      session.state.startTime = new Date(Date.now() - 30000); // 30 seconds ago
      stateManager.updateState({ processedDocuments: 10, successfulExports: 8 });

      const stats = stateManager.getStatistics();

      expect(stats.totalSessions).toBe(1);
      expect(stats.currentSession).toBeDefined();
      expect(stats.averageExportSpeed).toBeGreaterThan(0);
      expect(stats.successRate).toBe(80); // 8/10 * 100
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const result = stateManager.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        ...config,
        outputDirectory: '',
        exportFormat: 'invalid' as any,
        maxDocuments: -1,
        retryAttempts: 15
      };

      const result = stateManager.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Output directory is required');
    });
  });
});