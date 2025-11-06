import { QuipAuthConfig } from './types';

/**
 * Create Quip configuration with personal access token
 */
export function createQuipConfig(
  personalAccessToken: string,
  domain: string = 'quip.com'
): QuipAuthConfig {
  const baseUrl = `https://platform.${domain}`;
  const tokenUrl = `https://${domain}/dev/token`;
  
  return {
    domain,
    baseUrl,
    tokenUrl,
    personalAccessToken
  };
}



/**
 * Load configuration from environment variables for export tool
 */
export function loadConfigFromEnv(): {
  quip: QuipAuthConfig | null;
} {
  const quipPersonalToken = process.env.QUIP_PERSONAL_ACCESS_TOKEN;
  const quipDomain = process.env.QUIP_DOMAIN || 'quip.com';

  let quipConfig: QuipAuthConfig | null = null;

  if (quipPersonalToken) {
    quipConfig = createQuipConfig(quipPersonalToken, quipDomain);
  }

  return {
    quip: quipConfig
  };
}

/**
 * Validate export tool configuration completeness
 */
export function validateExportConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const quipPersonalToken = process.env.QUIP_PERSONAL_ACCESS_TOKEN;
  const quipDomain = process.env.QUIP_DOMAIN;

  // Check for Quip authentication
  if (!quipPersonalToken) {
    errors.push('Quip authentication required: Set QUIP_PERSONAL_ACCESS_TOKEN');
  }

  // Validate domain format if provided
  if (quipDomain && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(quipDomain)) {
    errors.push('Invalid QUIP_DOMAIN format. Use format like "quip.com" or "quip-enterprise.com"');
  }

  // Validate export configuration
  const exportOutputDir = process.env.EXPORT_OUTPUT_DIRECTORY;
  if (exportOutputDir && exportOutputDir.trim().length === 0) {
    errors.push('EXPORT_OUTPUT_DIRECTORY cannot be empty if specified');
  }

  const exportFormat = process.env.EXPORT_FORMAT;
  if (exportFormat && !['docx', 'html', 'both'].includes(exportFormat)) {
    errors.push('EXPORT_FORMAT must be one of: docx, html, both');
  }

  const exportBatchSize = process.env.EXPORT_BATCH_SIZE;
  if (exportBatchSize) {
    const batchSize = parseInt(exportBatchSize, 10);
    if (isNaN(batchSize) || batchSize <= 0 || batchSize > 50) {
      errors.push('EXPORT_BATCH_SIZE must be a number between 1 and 50');
    }
  }

  const exportRateLimit = process.env.EXPORT_RATE_LIMIT_DELAY;
  if (exportRateLimit) {
    const rateLimit = parseInt(exportRateLimit, 10);
    if (isNaN(rateLimit) || rateLimit < 100) {
      errors.push('EXPORT_RATE_LIMIT_DELAY must be at least 100ms');
    }
  }

  const exportMaxDocs = process.env.EXPORT_MAX_DOCUMENTS;
  if (exportMaxDocs) {
    const maxDocs = parseInt(exportMaxDocs, 10);
    if (isNaN(maxDocs) || maxDocs <= 0) {
      errors.push('EXPORT_MAX_DOCUMENTS must be a positive number');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}