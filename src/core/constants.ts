// Core constants and configuration defaults

export const DEFAULT_EXPORT_CONFIG = {
  outputDirectory: './quip-export',
  exportFormat: 'native' as const,
  maxDocuments: undefined as number | undefined,
  includeSharedDocuments: true,
  includeFolders: [] as string[],
  rateLimitDelay: 100,
  retryAttempts: 3,
  preserveFolderStructure: true,
  sanitizeFileNames: true,
  conflictResolution: 'number' as const,
};

// Legacy config for backward compatibility
export const DEFAULT_CONFIG = {
  BATCH_SIZE: 10,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  OUTPUT_FORMAT: 'native' as const,
  PRESERVE_FOLDER_STRUCTURE: true,
  INCLUDE_SHARED_DOCUMENTS: false,
  CONCURRENCY_LIMIT: 5,
  MAX_FILE_SIZE: 250 * 1024 * 1024, // 250MB
  TIMEOUT: 30000, // 30 seconds
};

export const API_ENDPOINTS = {
  QUIP: {
    BASE_URL: 'https://platform.quip.com/1',
    V2_BASE_URL: 'https://platform.quip.com/2',
    CURRENT_USER: '/users/current',
    FOLDERS: '/folders',
    THREADS: '/threads',
    EXPORT_DOCX: '/export/docx',
    EXPORT_HTML: '/html',
    EXPORT_XLSX: '/export/xlsx',
    SEARCH: '/threads/search',
  },
  MICROSOFT: {
    GRAPH_BASE_URL: 'https://graph.microsoft.com/v1.0',
    AUTH_URL: 'https://login.microsoftonline.com',
    DRIVE: '/me/drive',
    DRIVE_ROOT: '/me/drive/root',
    DRIVE_CHILDREN: '/me/drive/root/children',
  },
};

export const RATE_LIMITS = {
  QUIP: {
    REQUESTS_PER_MINUTE: 50,
    REQUESTS_PER_HOUR: 750,
  },
  MICROSOFT: {
    // Microsoft Graph uses adaptive throttling
    DEFAULT_DELAY: 1000,
    MAX_RETRY_DELAY: 60000,
  },
};

export const FILE_EXTENSIONS = {
  DOCUMENT: '.docx',
  SPREADSHEET: '.xlsx',
  PRESENTATION: '.pptx',
  HTML: '.html',

};

export const SUPPORTED_EXPORT_FORMATS = Object.freeze(['native', 'html', 'markdown'] as const);
export const SUPPORTED_DOCUMENT_FORMATS = Object.freeze(['native', 'html', 'markdown'] as const);

export const ERROR_CATEGORIES = {
  AUTH: 'auth',
  API: 'api',
  FILE: 'file',
  PERMISSION: 'permission',
  NETWORK: 'network',
  UNKNOWN: 'unknown',
} as const;

export const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
} as const;