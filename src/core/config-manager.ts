// Legacy migration configuration management - use ExportConfigManager for new export functionality

import { MigrationConfig } from '../types';
import { IConfigValidator } from './interfaces';
import { DEFAULT_CONFIG, SUPPORTED_DOCUMENT_FORMATS } from './constants';

export class ConfigManager implements IConfigValidator {
  /**
   * Create a default migration configuration
   */
  static createDefault(): MigrationConfig {
    return {
      batchSize: DEFAULT_CONFIG.BATCH_SIZE,
      retryAttempts: DEFAULT_CONFIG.RETRY_ATTEMPTS,
      retryDelay: DEFAULT_CONFIG.RETRY_DELAY,
      outputFormat: DEFAULT_CONFIG.OUTPUT_FORMAT,
      preserveFolderStructure: DEFAULT_CONFIG.PRESERVE_FOLDER_STRUCTURE,
      includeSharedDocuments: DEFAULT_CONFIG.INCLUDE_SHARED_DOCUMENTS,
    };
  }

  /**
   * Merge user configuration with defaults
   */
  static mergeWithDefaults(userConfig: Partial<MigrationConfig>): MigrationConfig {
    const defaultConfig = ConfigManager.createDefault();
    return {
      ...defaultConfig,
      ...userConfig,
    };
  }

  /**
   * Validate migration configuration
   */
  async validateConfig(config: MigrationConfig): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate batch size
    if (config.batchSize <= 0 || config.batchSize > 100) {
      errors.push('Batch size must be between 1 and 100');
    }

    // Validate retry attempts
    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      errors.push('Retry attempts must be between 0 and 10');
    }

    // Validate retry delay
    if (config.retryDelay < 100 || config.retryDelay > 60000) {
      errors.push('Retry delay must be between 100ms and 60 seconds');
    }

    // Validate output format
    if (!SUPPORTED_DOCUMENT_FORMATS.includes(config.outputFormat)) {
      errors.push(`Output format must be one of: ${SUPPORTED_DOCUMENT_FORMATS.join(', ')}`);
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
   * Migrate old output format values to new format values
   */
  static migrateOutputFormat(format: string): 'native' | 'html' | 'markdown' {
    switch (format) {
      case 'docx':
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
  static sanitizeConfig(config: MigrationConfig): MigrationConfig {
    return {
      ...config,
      batchSize: Math.max(1, Math.min(100, Math.floor(config.batchSize))),
      retryAttempts: Math.max(0, Math.min(10, Math.floor(config.retryAttempts))),
      retryDelay: Math.max(100, Math.min(60000, Math.floor(config.retryDelay))),

      outputFormat: this.migrateOutputFormat(config.outputFormat),
    };
  }

  /**
   * Get configuration summary for display
   */
  static getConfigSummary(config: MigrationConfig): Record<string, string | number | boolean> {
    return {
      'Batch Size': config.batchSize,
      'Retry Attempts': config.retryAttempts,
      'Retry Delay (ms)': config.retryDelay,
      'Output Format': config.outputFormat,
      'Preserve Folder Structure': config.preserveFolderStructure,

      'Include Shared Documents': config.includeSharedDocuments,
    };
  }

  /**
   * Export configuration to JSON string
   */
  static exportConfig(config: MigrationConfig): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  static importConfig(configJson: string): MigrationConfig {
    try {
      const parsed = JSON.parse(configJson) as Partial<MigrationConfig>;
      return ConfigManager.mergeWithDefaults(parsed);
    } catch (error) {
      throw new Error(
        `Invalid configuration JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create configuration for different migration scenarios
   */
  static createPreset(preset: 'conservative' | 'balanced' | 'aggressive'): MigrationConfig {
    const base = ConfigManager.createDefault();

    switch (preset) {
      case 'conservative':
        return {
          ...base,
          batchSize: 5,
          retryAttempts: 5,
          retryDelay: 2000,
        };

      case 'balanced':
        return {
          ...base,
          batchSize: 10,
          retryAttempts: 3,
          retryDelay: 1000,
        };

      case 'aggressive':
        return {
          ...base,
          batchSize: 20,
          retryAttempts: 2,
          retryDelay: 500,
        };

      default:
        return base;
    }
  }
}
