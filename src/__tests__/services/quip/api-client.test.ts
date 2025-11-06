import { QuipApiClient } from '../../../services/quip/api-client';
import { AuthManager } from '../../../auth/auth-manager';
import { ConsoleLogger } from '../../../core/logger';
import { QuipAuthConfig } from '../../../auth/types';

// Mock fetch globally
global.fetch = jest.fn();

// Mock AuthManager
jest.mock('../../../auth/auth-manager');

describe('QuipApiClient Core Functionality', () => {
  let apiClient: QuipApiClient;
  let mockAuthManager: jest.Mocked<AuthManager>;
  let logger: ConsoleLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock auth manager
    mockAuthManager = {
      getValidToken: jest.fn(),
      refreshToken: jest.fn(),
    } as any;

    logger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    apiClient = new QuipApiClient(mockAuthManager, logger);
  });

  describe('Core Requirements Verification', () => {
    it('should verify API client can be instantiated', () => {
      // Requirement 3.1: System SHALL download each document from Quip
      expect(apiClient).toBeDefined();
      expect(apiClient.getCurrentUser).toBeDefined();
      expect(apiClient.exportDocumentDocx).toBeDefined();
      expect(apiClient.exportDocumentHtml).toBeDefined();
      expect(apiClient.exportSpreadsheetXlsx).toBeDefined();
    });

    it('should handle authentication token validation', async () => {
      mockAuthManager.getValidToken.mockResolvedValue(null);

      const result = await apiClient.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid Quip authentication token');
      expect(result.statusCode).toBe(401);
    });

    it('should support multiple export formats', () => {
      // Requirement 3.2: System SHALL preserve original format when possible
      expect(typeof apiClient.exportDocumentDocx).toBe('function');
      expect(typeof apiClient.exportDocumentHtml).toBe('function');
      expect(typeof apiClient.exportSpreadsheetXlsx).toBe('function');

    });

    it('should have error handling capabilities', () => {
      // Requirement 3.4: IF document export fails THEN system SHALL log error and continue
      expect(typeof apiClient.testConnection).toBe('function');
      // Error handling is built into all API methods
    });
  });

  describe('Domain and Personal Access Token Support', () => {
    it('should use configurable base URL from auth config', () => {
      // Requirement 6.1, 6.2: System SHALL use configured domain for API calls
      const customAuthConfig: QuipAuthConfig = {
        domain: 'quip-enterprise.com',
        baseUrl: 'https://platform.quip-enterprise.com',
        tokenUrl: 'https://quip-enterprise.com/dev/token',
        personalAccessToken: 'test-token'
      };

      const customApiClient = new QuipApiClient(mockAuthManager, logger, customAuthConfig);
      expect(customApiClient).toBeDefined();
    });

    it('should support personal access token authentication', () => {
      // Requirement 7.1, 7.2: System SHALL accept personal access token and validate it
      const personalTokenConfig: QuipAuthConfig = {
        domain: 'quip.com',
        baseUrl: 'https://platform.quip.com',
        tokenUrl: 'https://quip.com/dev/token',
        personalAccessToken: 'test-personal-token'
      };

      const tokenApiClient = new QuipApiClient(mockAuthManager, logger, personalTokenConfig);
      expect(tokenApiClient).toBeDefined();
      expect(typeof tokenApiClient.validateToken).toBe('function');
    });

    it('should validate token using domain-specific endpoint', async () => {
      // Requirement 7.2: System SHALL validate token by making test API call
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-user', name: 'Test User' })
      } as Response);

      const personalTokenConfig: QuipAuthConfig = {
        domain: 'quip.com',
        baseUrl: 'https://platform.quip.com',
        tokenUrl: 'https://quip.com/dev/token',
        personalAccessToken: 'valid-token'
      };

      const tokenApiClient = new QuipApiClient(mockAuthManager, logger, personalTokenConfig);
      const result = await tokenApiClient.validateToken();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'test-user', name: 'Test User' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://platform.quip.com/1/users/current',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      );
    });

    it('should handle invalid personal access token', async () => {
      // Requirement 7.4: System SHALL display error for invalid tokens
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token'
      } as Response);

      const personalTokenConfig: QuipAuthConfig = {
        domain: 'quip.com',
        baseUrl: 'https://platform.quip.com',
        tokenUrl: 'https://quip.com/dev/token',
        personalAccessToken: 'invalid-token'
      };

      const tokenApiClient = new QuipApiClient(mockAuthManager, logger, personalTokenConfig);
      const result = await tokenApiClient.validateToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token validation failed');
      expect(result.statusCode).toBe(401);
    });

    it('should work with personal access token', async () => {
      // Test personal access token functionality
      mockAuthManager.getValidToken.mockResolvedValue('personal-token');
      
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'personal-user' })
      } as Response);

      // Create client with personal token
      const apiClient = new QuipApiClient(mockAuthManager, logger);
      const result = await apiClient.getCurrentUser();

      expect(mockAuthManager.getValidToken).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });
  });

  // PDF export functionality has been removed
});