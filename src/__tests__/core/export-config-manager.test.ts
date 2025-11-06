import { ExportConfigManager } from '../../core/export-config-manager';
import { DEFAULT_EXPORT_CONFIG } from '../../core/constants';
import { ExportConfig } from '../../core/export-types';

describe('ExportConfigManager', () => {
  describe('Default Configuration', () => {
    it('should create default configuration', () => {
      const config = ExportConfigManager.createDefault();

      expect(config).toEqual(DEFAULT_EXPORT_CONFIG);
      expect(config.outputDirectory).toBe('./quip-export');
      expect(config.exportFormat).toBe('native');
      expect(config.includeSharedDocuments).toBe(true);
      expect(config.rateLimitDelay).toBe(100);
      expect(config.retryAttempts).toBe(3);
      expect(config.preserveFolderStructure).toBe(true);
      expect(config.sanitizeFileNames).toBe(true);
      expect(config.conflictResolution).toBe('number');
    });
  });

  describe('Presets', () => {
    it('should create configuration from conservative preset', () => {
      const config = ExportConfigManager.createFromPreset('conservative');

      expect(config.rateLimitDelay).toBe(500);
      expect(config.retryAttempts).toBe(5);
      expect(config.exportFormat).toBe('native');
    });

    it('should create configuration from balanced preset', () => {
      const config = ExportConfigManager.createFromPreset('balanced');

      expect(config.rateLimitDelay).toBe(200);
      expect(config.retryAttempts).toBe(3);
      expect(config.exportFormat).toBe('native');
    });

    it('should create configuration from fast preset', () => {
      const config = ExportConfigManager.createFromPreset('fast');

      expect(config.rateLimitDelay).toBe(50);
      expect(config.retryAttempts).toBe(1);
      expect(config.exportFormat).toBe('native');
    });

    it('should create configuration from comprehensive preset', () => {
      const config = ExportConfigManager.createFromPreset('comprehensive');

      expect(config.rateLimitDelay).toBe(300);
      expect(config.retryAttempts).toBe(5);
      expect(config.exportFormat).toBe('native');
      expect(config.includeSharedDocuments).toBe(true);
    });

    it('should throw error for unknown preset', () => {
      expect(() => {
        ExportConfigManager.createFromPreset('unknown' as any);
      }).toThrow('Unknown preset: unknown');
    });
  });

  describe('Configuration Merging', () => {
    it('should merge user configuration with defaults', () => {
      const userConfig: Partial<ExportConfig> = {
        outputDirectory: '/custom/path',
        exportFormat: 'html',
        rateLimitDelay: 250
      };

      const merged = ExportConfigManager.mergeWithDefaults(userConfig);

      expect(merged.outputDirectory).toBe('/custom/path');
      expect(merged.exportFormat).toBe('html');
      expect(merged.rateLimitDelay).toBe(250);
      expect(merged.retryAttempts).toBe(DEFAULT_EXPORT_CONFIG.retryAttempts);
      expect(merged.includeSharedDocuments).toBe(DEFAULT_EXPORT_CONFIG.includeSharedDocuments);
    });

    it('should handle empty user configuration', () => {
      const merged = ExportConfigManager.mergeWithDefaults({});

      expect(merged).toEqual(DEFAULT_EXPORT_CONFIG);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const config = ExportConfigManager.createDefault();
      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty output directory', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        outputDirectory: ''
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output directory cannot be empty');
    });

    it('should reject invalid export format', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        exportFormat: 'invalid' as any
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Export format must be one of: native, html, markdown');
    });

    it('should reject invalid max documents', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        maxDocuments: -1
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max documents must be a positive integer');
    });

    it('should reject excessive max documents', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        maxDocuments: 15000
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max documents cannot exceed 10,000 for performance reasons');
    });

    it('should reject invalid rate limit delay', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        rateLimitDelay: -100
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rate limit delay must be a non-negative integer (milliseconds)');
    });

    it('should reject excessive rate limit delay', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        rateLimitDelay: 15000
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rate limit delay cannot exceed 10 seconds');
    });

    it('should reject invalid retry attempts', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        retryAttempts: 15
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Retry attempts must be an integer between 0 and 10');
    });

    it('should reject invalid conflict resolution', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        conflictResolution: 'invalid' as any
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Conflict resolution must be "number", "timestamp", or "overwrite"');
    });

    it('should reject invalid included folders', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        includeFolders: 'not-an-array' as any
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Included folders must be an array');
    });

    it('should reject output directory with invalid characters', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        outputDirectory: '/path/with<invalid>chars'
      };

      const result = ExportConfigManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output directory contains invalid characters');
    });
  });

  describe('Configuration Sanitization', () => {
    it('should sanitize configuration values', () => {
      const config: ExportConfig = {
        outputDirectory: '  ./export  ',
        exportFormat: 'invalid' as any,
        maxDocuments: 15000,
        includeSharedDocuments: true,
        includeFolders: 'not-array' as any,
        rateLimitDelay: -100,
        retryAttempts: 15,
        preserveFolderStructure: true,
        sanitizeFileNames: true,
        conflictResolution: 'invalid' as any
      };

      const sanitized = ExportConfigManager.sanitizeConfig(config);

      expect(sanitized.outputDirectory).toMatch(/export$/); // Should be resolved path
      expect(sanitized.exportFormat).toBe('native');
      expect(sanitized.maxDocuments).toBe(10000);
      expect(sanitized.rateLimitDelay).toBe(0);
      expect(sanitized.retryAttempts).toBe(10);
      expect(sanitized.conflictResolution).toBe('number');
      expect(Array.isArray(sanitized.includeFolders)).toBe(true);
    });

    it('should preserve valid values during sanitization', () => {
      const config = ExportConfigManager.createDefault();
      const sanitized = ExportConfigManager.sanitizeConfig(config);

      expect(sanitized.exportFormat).toBe(config.exportFormat);
      expect(sanitized.rateLimitDelay).toBe(config.rateLimitDelay);
      expect(sanitized.retryAttempts).toBe(config.retryAttempts);
      expect(sanitized.conflictResolution).toBe(config.conflictResolution);
    });
  });

  describe('Configuration Summary', () => {
    it('should generate configuration summary', () => {
      const config = ExportConfigManager.createDefault();
      const summary = ExportConfigManager.getConfigSummary(config);

      expect(summary['Output Directory']).toBe(config.outputDirectory);
      expect(summary['Export Format']).toBe(config.exportFormat);
      expect(summary['Max Documents']).toBe('No limit');
      expect(summary['Include Shared Documents']).toBe(config.includeSharedDocuments);
      expect(summary['Rate Limit Delay (ms)']).toBe(config.rateLimitDelay);
      expect(summary['Retry Attempts']).toBe(config.retryAttempts);
    });

    it('should show max documents when specified', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        maxDocuments: 500
      };

      const summary = ExportConfigManager.getConfigSummary(config);

      expect(summary['Max Documents']).toBe(500);
    });
  });

  describe('Configuration Import/Export', () => {
    it('should export configuration to JSON', () => {
      const config = ExportConfigManager.createDefault();
      const json = ExportConfigManager.exportConfig(config);

      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(config);
    });

    it('should import configuration from JSON', () => {
      const originalConfig = ExportConfigManager.createDefault();
      const json = ExportConfigManager.exportConfig(originalConfig);
      const importedConfig = ExportConfigManager.importConfig(json);

      // Path gets resolved during import, so check other properties
      expect(importedConfig.exportFormat).toBe(originalConfig.exportFormat);
      expect(importedConfig.includeSharedDocuments).toBe(originalConfig.includeSharedDocuments);
      expect(importedConfig.rateLimitDelay).toBe(originalConfig.rateLimitDelay);
      expect(importedConfig.retryAttempts).toBe(originalConfig.retryAttempts);
      expect(importedConfig.conflictResolution).toBe(originalConfig.conflictResolution);
      expect(importedConfig.outputDirectory).toMatch(/quip-export$/);
    });

    it('should handle partial configuration import', () => {
      const partialJson = JSON.stringify({
        outputDirectory: '/custom/path',
        exportFormat: 'html'
      });

      const importedConfig = ExportConfigManager.importConfig(partialJson);

      expect(importedConfig.outputDirectory).toMatch(/custom\/path$/);
      expect(importedConfig.exportFormat).toBe('html');
      expect(importedConfig.retryAttempts).toBe(DEFAULT_EXPORT_CONFIG.retryAttempts);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        ExportConfigManager.importConfig('invalid json');
      }).toThrow('Invalid configuration JSON');
    });
  });

  describe('Scenario-based Configuration', () => {
    it('should create personal scenario configuration', () => {
      const config = ExportConfigManager.createForScenario('personal');

      expect(config.includeSharedDocuments).toBe(false);
      expect(config.exportFormat).toBe('native');
      expect(config.rateLimitDelay).toBe(100);
    });

    it('should create team scenario configuration', () => {
      const config = ExportConfigManager.createForScenario('team');

      expect(config.includeSharedDocuments).toBe(true);
      expect(config.exportFormat).toBe('native');
      expect(config.rateLimitDelay).toBe(200);
    });

    it('should create archive scenario configuration', () => {
      const config = ExportConfigManager.createForScenario('archive');

      expect(config.includeSharedDocuments).toBe(true);
      expect(config.exportFormat).toBe('native');
      expect(config.rateLimitDelay).toBe(500);
      expect(config.retryAttempts).toBe(5);
    });

    it('should create migration scenario configuration', () => {
      const config = ExportConfigManager.createForScenario('migration');

      expect(config.includeSharedDocuments).toBe(true);
      expect(config.exportFormat).toBe('native');
      expect(config.rateLimitDelay).toBe(300);
      expect(config.retryAttempts).toBe(3);
      expect(config.preserveFolderStructure).toBe(true);
    });
  });

  describe('Export Time Estimation', () => {
    it('should estimate export time for small document count', () => {
      const config = ExportConfigManager.createDefault();
      const estimate = ExportConfigManager.estimateExportTime(config, 10);

      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(0);
      expect(estimate.estimatedSeconds).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(estimate.factors)).toBe(true);
    });

    it('should estimate longer time for both formats', () => {
      const config = {
        ...ExportConfigManager.createDefault(),
        exportFormat: 'native' as const
      };

      const singleFormatEstimate = ExportConfigManager.estimateExportTime(
        { ...config, exportFormat: 'native' },
        100
      );
      const bothFormatsEstimate = ExportConfigManager.estimateExportTime(
        { ...config, exportFormat: 'markdown' },
        100
      );

      const singleTotal = singleFormatEstimate.estimatedMinutes * 60 + singleFormatEstimate.estimatedSeconds;
      const bothTotal = bothFormatsEstimate.estimatedMinutes * 60 + bothFormatsEstimate.estimatedSeconds;

      expect(bothTotal).toBeGreaterThan(singleTotal);
      expect(bothFormatsEstimate.factors).toContain('Converting to Markdown format');
    });

    it('should account for rate limiting in estimation', () => {
      const fastConfig = {
        ...ExportConfigManager.createDefault(),
        rateLimitDelay: 50
      };

      const slowConfig = {
        ...ExportConfigManager.createDefault(),
        rateLimitDelay: 1000
      };

      const fastEstimate = ExportConfigManager.estimateExportTime(fastConfig, 100);
      const slowEstimate = ExportConfigManager.estimateExportTime(slowConfig, 100);

      const fastTotal = fastEstimate.estimatedMinutes * 60 + fastEstimate.estimatedSeconds;
      const slowTotal = slowEstimate.estimatedMinutes * 60 + slowEstimate.estimatedSeconds;

      expect(slowTotal).toBeGreaterThan(fastTotal);
      expect(slowEstimate.factors).toContain('Conservative rate limiting');
    });
  });

  describe('Recommended Configuration', () => {
    it('should recommend fast preset for small document count', () => {
      const recommendation = ExportConfigManager.getRecommendedConfig(25);

      expect(recommendation.config.rateLimitDelay).toBe(50);
      expect(recommendation.config.retryAttempts).toBe(1);
      expect(recommendation.reasoning).toContain('Small document count - using fast preset');
    });

    it('should recommend balanced preset for medium document count', () => {
      const recommendation = ExportConfigManager.getRecommendedConfig(150);

      expect(recommendation.config.rateLimitDelay).toBe(200);
      expect(recommendation.config.retryAttempts).toBe(3);
      expect(recommendation.reasoning).toContain('Medium document count - using balanced preset');
    });

    it('should recommend conservative preset for large document count', () => {
      const recommendation = ExportConfigManager.getRecommendedConfig(500);

      expect(recommendation.config.rateLimitDelay).toBe(500);
      expect(recommendation.config.retryAttempts).toBe(5);
      expect(recommendation.reasoning).toContain('Large document count - using conservative preset');
    });

    it('should recommend comprehensive preset with limits for very large document count', () => {
      const recommendation = ExportConfigManager.getRecommendedConfig(2000);

      expect(recommendation.config.rateLimitDelay).toBe(300);
      expect(recommendation.config.retryAttempts).toBe(5);
      expect(recommendation.config.maxDocuments).toBe(1000);
      expect(recommendation.reasoning).toContain('Very large document count - using comprehensive preset');
      expect(recommendation.reasoning).toContain('Limited to 1000 documents for initial export');
    });
  });
});