// Test constants and configuration defaults

import {
  DEFAULT_CONFIG,
  API_ENDPOINTS,
  RATE_LIMITS,
  SUPPORTED_EXPORT_FORMATS,
} from '../core/constants';

describe('Constants', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have valid default configuration values', () => {
      expect(DEFAULT_CONFIG.BATCH_SIZE).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.RETRY_ATTEMPTS).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.RETRY_DELAY).toBeGreaterThan(0);
      expect(['native', 'html', 'markdown']).toContain(DEFAULT_CONFIG.OUTPUT_FORMAT);
      expect(typeof DEFAULT_CONFIG.PRESERVE_FOLDER_STRUCTURE).toBe('boolean');
      expect(typeof DEFAULT_CONFIG.INCLUDE_SHARED_DOCUMENTS).toBe('boolean');
    });

    it('should have reasonable limits', () => {
      expect(DEFAULT_CONFIG.CONCURRENCY_LIMIT).toBeLessThanOrEqual(10);
      expect(DEFAULT_CONFIG.MAX_FILE_SIZE).toBeGreaterThan(1024 * 1024); // At least 1MB
      expect(DEFAULT_CONFIG.TIMEOUT).toBeGreaterThan(1000); // At least 1 second
    });
  });

  describe('API_ENDPOINTS', () => {
    it('should have valid Quip endpoints', () => {
      expect(API_ENDPOINTS.QUIP.BASE_URL).toMatch(/^https:\/\//);
      expect(API_ENDPOINTS.QUIP.V2_BASE_URL).toMatch(/^https:\/\//);
      expect(API_ENDPOINTS.QUIP.CURRENT_USER).toMatch(/^\/users/);
    });

    it('should have valid Microsoft endpoints', () => {
      expect(API_ENDPOINTS.MICROSOFT.GRAPH_BASE_URL).toMatch(/^https:\/\/graph\.microsoft\.com/);
      expect(API_ENDPOINTS.MICROSOFT.AUTH_URL).toMatch(/^https:\/\/login\.microsoftonline\.com/);
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have reasonable Quip rate limits', () => {
      expect(RATE_LIMITS.QUIP.REQUESTS_PER_MINUTE).toBeGreaterThan(0);
      expect(RATE_LIMITS.QUIP.REQUESTS_PER_HOUR).toBeGreaterThan(
        RATE_LIMITS.QUIP.REQUESTS_PER_MINUTE
      );
    });

    it('should have reasonable Microsoft rate limits', () => {
      expect(RATE_LIMITS.MICROSOFT.DEFAULT_DELAY).toBeGreaterThan(0);
      expect(RATE_LIMITS.MICROSOFT.MAX_RETRY_DELAY).toBeGreaterThan(
        RATE_LIMITS.MICROSOFT.DEFAULT_DELAY
      );
    });
  });

  describe('SUPPORTED_EXPORT_FORMATS', () => {
    it('should include common document formats', () => {
      expect(SUPPORTED_EXPORT_FORMATS).toContain('native');
      expect(SUPPORTED_EXPORT_FORMATS).toContain('html');
      expect(SUPPORTED_EXPORT_FORMATS).toContain('markdown');
    });

    it('should be a readonly array', () => {
      expect(() => {
        // @ts-expect-error - should not be able to modify readonly array
        SUPPORTED_EXPORT_FORMATS.push('txt');
      }).toThrow();
    });
  });
});
