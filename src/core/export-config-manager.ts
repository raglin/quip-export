// Export configuration management for Quip bulk export tool

import { ExportConfig } from './export-types';
import { IExportConfigValidator } from './interfaces';
import { DEFAULT_EXPORT_CONFIG, SUPPORTED_EXPORT_FORMATS } from './constants';
import * as path from 'path';
import * as fs from 'fs';

export class ExportConfigManager implements IExportConfigValidator {
  /**
   * Create a default export configuration
   */
  static createDefault(): ExportConfig {
    return {
      outputDirectory: DEFAULT_EXPORT_CONFIG.outputDirectory,
      exportFormat: DEFAULT_EXPORT_CONFIG.exportFormat,
      maxDocuments: DEFAULT_EXPORT_CONFIG.maxDocuments,
      includeSharedDocuments: DEFAULT_EXPORT_CONFIG.includeSharedDocuments,
      includeFolders: DEFAULT_EXPORT_CONFIG.includeFolders,
      rateLimitDelay: DEFAULT_EXPORT_CONFIG.rateLimitDelay,
      retryAttempts: DEFAULT_EXPORT_CONFIG.retryAttempts,
      preserveFolderStructure: DEFAULT_EXPORT_CONFIG.preserveFolderStructure,
      sanitizeFileNames: DEFAULT_EXPORT_CONFIG.sanitizeFileNames,
      conflictResolution: DEFAULT_EXPORT_CONFIG.conflictResolution,
    };
  }

  /**
   * Create export configuration from environment variables
   */
  static createFromEnv(): ExportConfig {
    const defaultConfig = ExportConfigManager.createDefault();

    return {
      outputDirectory: process.env.EXPORT_OUTPUT_DIRECTORY || defaultConfig.outputDirectory,
      exportFormat: this.migrateExportFormat(
        process.env.EXPORT_FORMAT || defaultConfig.exportFormat
      ),
      maxDocuments: process.env.EXPORT_MAX_DOCUMENTS
        ? parseInt(process.env.EXPORT_MAX_DOCUMENTS, 10)
        : defaultConfig.maxDocuments,
      includeSharedDocuments:
        process.env.EXPORT_INCLUDE_SHARED === 'true' || defaultConfig.includeSharedDocuments,
      includeFolders: defaultConfig.includeFolders,
      rateLimitDelay: process.env.EXPORT_RATE_LIMIT_DELAY
        ? parseInt(process.env.EXPORT_RATE_LIMIT_DELAY, 10)
        : defaultConfig.rateLimitDelay,
      retryAttempts: defaultConfig.retryAttempts,
      preserveFolderStructure: defaultConfig.preserveFolderStructure,
      sanitizeFileNames: defaultConfig.sanitizeFileNames,
      conflictResolution: defaultConfig.conflictResolution,
    };
  }

  /**
   * Merge user configuration with defaults
   */
  static mergeWithDefaults(userConfig: Partial<ExportConfig>): ExportConfig {
    const defaultConfig = ExportConfigManager.createDefault();
    return {
      ...defaultConfig,
      ...userConfig,
    };
  }

  /**
   * Static method to validate export configuration
   */
  static validateConfig(config: ExportConfig): { isValid: boolean; errors: string[] } {
    const manager = new ExportConfigManager();
    return manager.validateConfigSync(config);
  }

  /**
   * Validate export configuration (async interface implementation)
   */
  async validateConfig(config: ExportConfig): Promise<{ isValid: boolean; errors: string[] }> {
    return this.validateConfigSync(config);
  }

  /**
   * Validate export configuration (synchronous version)
   */
  validateConfigSync(config: ExportConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate output directory
    if (!config.outputDirectory || config.outputDirectory.trim().length === 0) {
      errors.push('Output directory cannot be empty');
    }

    // Validate export format
    if (!SUPPORTED_EXPORT_FORMATS.includes(config.exportFormat)) {
      errors.push(`Export format must be one of: ${SUPPORTED_EXPORT_FORMATS.join(', ')}`);
    }

    // Validate rate limit delay
    if (config.rateLimitDelay < 0) {
      errors.push('Rate limit delay must be a non-negative integer (milliseconds)');
    }
    if (config.rateLimitDelay > 10000) {
      errors.push('Rate limit delay cannot exceed 10 seconds');
    }

    // Validate retry attempts
    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      errors.push('Retry attempts must be an integer between 0 and 10');
    }

    // Validate max documents if specified
    if (config.maxDocuments !== undefined) {
      if (config.maxDocuments <= 0) {
        errors.push('Max documents must be a positive integer');
      }
      if (config.maxDocuments > 10000) {
        errors.push('Max documents cannot exceed 10,000 for performance reasons');
      }
    }

    // Validate conflict resolution
    if (!['number', 'timestamp', 'overwrite'].includes(config.conflictResolution)) {
      errors.push('Conflict resolution must be "number", "timestamp", or "overwrite"');
    }

    // Validate include folders array
    if (!Array.isArray(config.includeFolders)) {
      errors.push('Included folders must be an array');
    }

    // Validate output directory for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(config.outputDirectory)) {
      errors.push('Output directory contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate authentication (placeholder - actual implementation would check tokens)
   */
  async validateAuthentication(): Promise<boolean> {
    // This would typically check if valid tokens exist and are not expired
    // For now, return true as authentication is handled by the auth manager
    return true;
  }

  /**
   * Migrate old export format values to new format values
   */
  static migrateExportFormat(format: string): 'native' | 'html' | 'markdown' {
    switch (format) {
      case 'docx':
      case 'both':
      case 'auto':
        return 'native';
      case 'html':
        return 'html';
      case 'markdown':
        return 'markdown';
      default:
        return 'native'; // Default fallback
    }
  }

  /**
   * Sanitize configuration values
   */
  static sanitizeConfig(config: ExportConfig): ExportConfig {
    return {
      ...config,
      outputDirectory: path.resolve(config.outputDirectory.trim()),
      rateLimitDelay: Math.max(0, Math.min(10000, Math.floor(config.rateLimitDelay))),
      retryAttempts: Math.max(0, Math.min(10, Math.floor(config.retryAttempts))),
      exportFormat: this.migrateExportFormat(config.exportFormat),
      maxDocuments:
        config.maxDocuments && config.maxDocuments > 0
          ? Math.min(10000, Math.floor(config.maxDocuments))
          : undefined,
      includeFolders: Array.isArray(config.includeFolders) ? config.includeFolders : [],
      conflictResolution: ['number', 'timestamp', 'overwrite'].includes(config.conflictResolution)
        ? config.conflictResolution
        : 'number',
    };
  }

  /**
   * Get configuration summary for display
   */
  static getConfigSummary(config: ExportConfig): Record<string, string | number | boolean> {
    return {
      'Output Directory': config.outputDirectory,
      'Export Format': config.exportFormat,
      'Max Documents': config.maxDocuments || 'No limit',
      'Rate Limit Delay (ms)': config.rateLimitDelay,
      'Retry Attempts': config.retryAttempts,
      'Preserve Folder Structure': config.preserveFolderStructure,
      'Include Shared Documents': config.includeSharedDocuments,
      'Include Folders':
        config.includeFolders.length > 0 ? config.includeFolders.join(', ') : 'All folders',
      'Sanitize File Names': config.sanitizeFileNames,
      'Conflict Resolution': config.conflictResolution,
    };
  }

  /**
   * Export configuration to JSON string
   */
  static exportConfig(config: ExportConfig): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  static importConfig(configJson: string): ExportConfig {
    try {
      const parsed = JSON.parse(configJson) as Partial<ExportConfig>;
      return ExportConfigManager.mergeWithDefaults(parsed);
    } catch (error) {
      throw new Error(
        `Invalid configuration JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create configuration from preset (alias for createPreset)
   */
  static createFromPreset(
    preset: 'conservative' | 'balanced' | 'aggressive' | 'fast' | 'comprehensive'
  ): ExportConfig {
    return ExportConfigManager.createPreset(preset);
  }

  /**
   * Create configuration for different export scenarios
   */
  static createPreset(
    preset: 'conservative' | 'balanced' | 'aggressive' | 'fast' | 'comprehensive'
  ): ExportConfig {
    const base = ExportConfigManager.createDefault();

    switch (preset) {
      case 'conservative':
        return {
          ...base,
          rateLimitDelay: 500,
          retryAttempts: 5,
          exportFormat: 'native',
        };

      case 'balanced':
        return {
          ...base,
          rateLimitDelay: 200,
          retryAttempts: 3,
          exportFormat: 'native',
        };

      case 'aggressive':
        return {
          ...base,
          rateLimitDelay: 800,
          retryAttempts: 2,
        };

      case 'fast':
        return {
          ...base,
          rateLimitDelay: 50,
          retryAttempts: 1,
          exportFormat: 'native',
        };

      case 'comprehensive':
        return {
          ...base,
          rateLimitDelay: 300,
          retryAttempts: 5,
          exportFormat: 'native',
          includeSharedDocuments: true,
        };

      default:
        throw new Error(`Unknown preset: ${preset}`);
    }
  }

  /**
   * Save configuration to file
   */
  static async saveConfigToFile(config: ExportConfig, filePath: string): Promise<void> {
    try {
      const configJson = ExportConfigManager.exportConfig(config);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, configJson, 'utf8');
    } catch (error) {
      throw new Error(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load configuration from file
   */
  static async loadConfigFromFile(filePath: string): Promise<ExportConfig> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      const configJson = fs.readFileSync(filePath, 'utf8');
      return ExportConfigManager.importConfig(configJson);
    } catch (error) {
      throw new Error(
        `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create configuration for different scenarios
   */
  static createForScenario(scenario: 'personal' | 'team' | 'archive' | 'migration'): ExportConfig {
    const base = ExportConfigManager.createDefault();

    switch (scenario) {
      case 'personal':
        return {
          ...base,
          includeSharedDocuments: false,
          exportFormat: 'native',
          rateLimitDelay: 100,
        };

      case 'team':
        return {
          ...base,
          includeSharedDocuments: true,
          exportFormat: 'native',
          rateLimitDelay: 200,
        };

      case 'archive':
        return {
          ...base,
          includeSharedDocuments: true,
          exportFormat: 'native',
          preserveFolderStructure: true,
          rateLimitDelay: 500,
          retryAttempts: 5,
        };

      case 'migration':
        return {
          ...base,
          includeSharedDocuments: true,
          exportFormat: 'native',
          rateLimitDelay: 300,
          retryAttempts: 3,
          preserveFolderStructure: true,
        };

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Estimate export time based on configuration and document count
   */
  static estimateExportTime(
    config: ExportConfig,
    documentCount: number
  ): {
    estimatedMinutes: number;
    estimatedSeconds: number;
    documentsPerMinute: number;
    factors: string[];
  } {
    // Base time per document (in seconds)
    let baseTimePerDoc = 2; // 2 seconds per document base
    const factors: string[] = [];

    // Adjust for export format
    if (config.exportFormat === 'markdown') {
      baseTimePerDoc *= 1.3; // Markdown conversion takes a bit longer
      factors.push('Converting to Markdown format');
    }

    // Adjust for rate limiting
    const rateLimitSeconds = config.rateLimitDelay / 1000;
    baseTimePerDoc += rateLimitSeconds;

    if (config.rateLimitDelay >= 500) {
      factors.push('Conservative rate limiting');
    }

    // Adjust for retry attempts (assume 10% failure rate)
    const failureRate = 0.1;
    const avgRetries = config.retryAttempts * failureRate;
    baseTimePerDoc += avgRetries * 3; // 3 seconds per retry

    if (config.retryAttempts >= 4) {
      factors.push('High retry attempts for reliability');
    }

    const totalSeconds = documentCount * baseTimePerDoc;
    const totalMinutes = totalSeconds / 60;
    const documentsPerMinute = 60 / baseTimePerDoc;

    return {
      estimatedMinutes: Math.ceil(totalMinutes),
      estimatedSeconds: Math.ceil(totalSeconds),
      documentsPerMinute: Math.round(documentsPerMinute * 10) / 10,
      factors,
    };
  }

  /**
   * Get recommended configuration based on document count
   */
  static getRecommendedConfig(documentCount: number): {
    config: ExportConfig;
    reasoning: string;
  } {
    const base = ExportConfigManager.createDefault();

    if (documentCount <= 50) {
      // Small export - can be more aggressive
      return {
        config: {
          ...base,
          rateLimitDelay: 50,
          retryAttempts: 1,
          exportFormat: 'native',
        },
        reasoning: 'Small document count - using fast preset for quick export',
      };
    } else if (documentCount <= 200) {
      // Medium export - balanced approach
      return {
        config: {
          ...base,
          rateLimitDelay: 200,
          retryAttempts: 3,
          exportFormat: 'native',
        },
        reasoning: 'Medium document count - using balanced preset for optimal performance',
      };
    } else if (documentCount <= 1000) {
      // Large export - more conservative
      return {
        config: {
          ...base,
          rateLimitDelay: 500,
          retryAttempts: 5,
          exportFormat: 'native',
        },
        reasoning: 'Large document count - using conservative preset for reliability',
      };
    } else {
      // Very large export - very conservative
      return {
        config: {
          ...base,
          rateLimitDelay: 300,
          retryAttempts: 5,
          exportFormat: 'native',
          maxDocuments: 1000,
        },
        reasoning:
          'Very large document count - using comprehensive preset with document limit. Limited to 1000 documents for initial export',
      };
    }
  }
}
