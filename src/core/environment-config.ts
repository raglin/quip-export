// Environment configuration loader and validator for export tool

import { ExportConfig } from './export-types';
import { QuipAuthConfig } from '../auth/types';
import { ExportConfigManager } from './export-config-manager';
import { loadConfigFromEnv, validateExportConfig } from '../auth/config';

export interface EnvironmentConfig {
  auth: {
    quip: QuipAuthConfig | null;
  };
  export: ExportConfig;
  logging: {
    level: string;
    filePath: string;
  };
}

import { ConfigValidationResult } from '../types';

export interface EnvironmentConfigValidationResult extends ConfigValidationResult {
  warnings: string[];
}

/**
 * Load complete configuration from environment variables
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const authConfig = loadConfigFromEnv();
  const exportConfig = ExportConfigManager.createFromEnv();

  return {
    auth: {
      quip: authConfig.quip,
    },
    export: exportConfig,
    logging: {
      level: process.env.LOG_LEVEL || 'INFO',
      filePath: process.env.LOG_FILE_PATH || './logs',
    },
  };
}

/**
 * Validate complete environment configuration
 */
export async function validateEnvironmentConfig(
  config?: EnvironmentConfig
): Promise<EnvironmentConfigValidationResult> {
  const envConfig = config || loadEnvironmentConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate authentication configuration
  const authValidation = validateExportConfig();
  if (!authValidation.isValid) {
    errors.push(...authValidation.errors);
  }

  // Validate export configuration
  const exportConfigManager = new ExportConfigManager();
  const exportValidation = await exportConfigManager.validateConfig(envConfig.export);
  if (!exportValidation.isValid) {
    errors.push(...exportValidation.errors);
  }

  // Check for Quip authentication
  if (!envConfig.auth.quip) {
    errors.push('Quip authentication configuration is missing or invalid');
  }

  // Validate logging configuration
  if (!['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(envConfig.logging.level.toUpperCase())) {
    warnings.push(`Invalid log level "${envConfig.logging.level}", using INFO as default`);
  }

  // Check for recommended settings - no OAuth warnings needed since OAuth is removed

  // Batch size validation removed - handled by batch processor

  if (envConfig.export.rateLimitDelay < 1000) {
    warnings.push(
      'Rate limit delay below 1000ms may cause API throttling. Consider using 1200ms or higher.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get configuration summary for display
 */
export function getConfigurationSummary(config?: EnvironmentConfig): Record<string, unknown> {
  const envConfig = config || loadEnvironmentConfig();

  return {
    Authentication: {
      'Quip Method': 'Personal Access Token',
      'Quip Domain': envConfig.auth.quip?.domain || 'Not configured',
      'Token Available': envConfig.auth.quip?.personalAccessToken ? 'Yes' : 'No',
    },
    'Export Settings': ExportConfigManager.getConfigSummary(envConfig.export),
    Logging: {
      Level: envConfig.logging.level,
      'File Path': envConfig.logging.filePath,
    },
  };
}

/**
 * Create environment configuration with overrides
 */
export function createEnvironmentConfig(overrides: {
  auth?: Partial<{ quip: QuipAuthConfig | null }>;
  export?: Partial<ExportConfig>;
  logging?: Partial<{ level: string; filePath: string }>;
}): EnvironmentConfig {
  const baseConfig = loadEnvironmentConfig();

  return {
    auth: {
      quip: overrides.auth?.quip !== undefined ? overrides.auth.quip : baseConfig.auth.quip,
    },
    export: {
      ...baseConfig.export,
      ...overrides.export,
    },
    logging: {
      ...baseConfig.logging,
      ...overrides.logging,
    },
  };
}

/**
 * Check if configuration is ready for export
 */
export function isConfigurationReady(config?: EnvironmentConfig): boolean {
  const envConfig = config || loadEnvironmentConfig();

  // Must have Quip authentication
  if (!envConfig.auth.quip) {
    return false;
  }

  // Must have valid output directory
  if (!envConfig.export.outputDirectory || envConfig.export.outputDirectory.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Get missing configuration requirements
 */
export function getMissingRequirements(config?: EnvironmentConfig): string[] {
  const envConfig = config || loadEnvironmentConfig();
  const missing: string[] = [];

  if (!envConfig.auth.quip) {
    missing.push(
      'Quip authentication (QUIP_PERSONAL_ACCESS_TOKEN or QUIP_CLIENT_ID/QUIP_CLIENT_SECRET)'
    );
  }

  if (!envConfig.export.outputDirectory || envConfig.export.outputDirectory.trim().length === 0) {
    missing.push('Export output directory (EXPORT_OUTPUT_DIRECTORY)');
  }

  return missing;
}
