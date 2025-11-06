import { ExportStateManager } from '../../core/export-state-manager';
import { ExportConfigManager } from '../../core/export-config-manager';
import { ConsoleLogger } from '../../core/logger';
import { ExportConfig } from '../../core/export-types';

describe('Export Orchestration Integration', () => {
  let logger: ConsoleLogger;
  let stateManager: ExportStateManager;
  let config: ExportConfig;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    stateManager = new ExportStateManager(logger);
    config = ExportConfigManager.createDefault();
  });

  describe('Configuration Validation', () => {
    it('should validate export configuration', () => {
      const validation = stateManager.validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        ...config,
        outputDirectory: '',
        exportFormat: 'invalid' as any
      };

      const validation = stateManager.validateConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('State Management Integration', () => {
    it('should create and manage export sessions', () => {
      const session = stateManager.createSession(config);
      expect(session).toBeDefined();
      expect(session.config).toEqual(config);
      expect(session.state.status).toBe('initializing');
    });

    it('should track export progress', () => {
      stateManager.createSession(config);
      stateManager.initializeExport(10);
      stateManager.startExport();
      
      const progress = stateManager.getProgress();
      expect(progress.total).toBe(10);
      expect(progress.current).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('should handle document processing', () => {
      stateManager.createSession(config);
      stateManager.initializeExport(5);
      stateManager.startExport();
      
      stateManager.startDocumentExport('doc1', 'Test Document', 'Private');
      stateManager.completeDocumentExport('doc1', '/path/test.docx', 1024);
      
      const progress = stateManager.getProgress();
      expect(progress.current).toBe(1);
      expect(progress.percentage).toBe(20);
      
      const session = stateManager.getCurrentSession()!;
      expect(session.state.successfulExports).toBe(1);
    });
  });

  describe('Configuration Presets', () => {
    it('should create configuration from presets', () => {
      const conservativeConfig = ExportConfigManager.createFromPreset('conservative');
      expect(conservativeConfig.rateLimitDelay).toBe(500);
      expect(conservativeConfig.retryAttempts).toBe(5);
      
      const fastConfig = ExportConfigManager.createFromPreset('fast');
      expect(fastConfig.rateLimitDelay).toBe(50);
      expect(fastConfig.retryAttempts).toBe(1);
    });

    it('should recommend configuration based on document count', () => {
      const smallRecommendation = ExportConfigManager.getRecommendedConfig(25);
      expect(smallRecommendation.config.rateLimitDelay).toBe(50);
      
      const largeRecommendation = ExportConfigManager.getRecommendedConfig(500);
      expect(largeRecommendation.config.rateLimitDelay).toBe(500);
    });
  });
});