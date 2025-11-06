import { AuthManager } from '../../auth/auth-manager';
import { createQuipConfig } from '../../auth/config';
import { TokenStorage } from '../../auth/token-storage';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock keytar to avoid system keychain dependencies in tests
jest.mock('keytar', () => ({
  setPassword: jest.fn(),
  getPassword: jest.fn(),
  deletePassword: jest.fn()
}));

describe('Personal Access Token Authentication', () => {
  let authManager: AuthManager;
  let mockTokenStorage: jest.Mocked<TokenStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock token storage
    mockTokenStorage = {
      storeToken: jest.fn(),
      getToken: jest.fn(),
      removeToken: jest.fn(),
      hasToken: jest.fn()
    } as any;

    // Create auth manager with personal token config
    const quipConfig = createQuipConfig('test-token-123', 'quip-enterprise.com');
    
    authManager = new AuthManager(quipConfig, mockTokenStorage);
  });

  describe('Personal Access Token Authentication', () => {
    it('should successfully authenticate with valid personal access token', async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user123', name: 'Test User' })
      });

      const result = await authManager.authenticateQuip();

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-token-123');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify API call was made to correct domain
      expect(global.fetch).toHaveBeenCalledWith(
        'https://platform.quip-enterprise.com/1/users/current',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify token was stored
      expect(mockTokenStorage.storeToken).toHaveBeenCalledWith(
        'quip',
        expect.objectContaining({
          accessToken: 'test-token-123',
          refreshToken: undefined,
          tokenType: 'Bearer'
        })
      );
    });

    it('should fail authentication with invalid personal access token', async () => {
      // Mock failed API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await authManager.authenticateQuip();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token validation failed: 401 Unauthorized');
      expect(mockTokenStorage.storeToken).not.toHaveBeenCalled();
    });

    it('should handle network errors during token validation', async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await authManager.authenticateQuip();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token validation failed: Network error');
      expect(mockTokenStorage.storeToken).not.toHaveBeenCalled();
    });

    it('should fail when no personal access token is provided', async () => {
      // Create config without token
      const quipConfig = createQuipConfig('', 'quip.com');
      
      const authManagerNoToken = new AuthManager(quipConfig, mockTokenStorage);

      const result = await authManagerNoToken.authenticateQuip();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Personal access token not provided');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Domain Configuration', () => {
    it('should use correct API URL for custom domain', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user123' })
      });

      await authManager.authenticateQuip();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://platform.quip-enterprise.com/1/users/current',
        expect.any(Object)
      );
    });

    it('should use default domain when not specified', async () => {
      const quipConfig = createQuipConfig('test-token', 'quip.com');
      
      const defaultAuthManager = new AuthManager(quipConfig, mockTokenStorage);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user123' })
      });

      await defaultAuthManager.authenticateQuip();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://platform.quip.com/1/users/current',
        expect.any(Object)
      );
    });
  });

  describe('Configuration Creation', () => {
    it('should create correct configuration for personal token', () => {
      const config = createQuipConfig('my-token', 'quip-enterprise.com');

      expect(config).toEqual({
        domain: 'quip-enterprise.com',
        baseUrl: 'https://platform.quip-enterprise.com',
        tokenUrl: 'https://quip-enterprise.com/dev/token',
        personalAccessToken: 'my-token'
      });
    });

    it('should create correct configuration with default domain', () => {
      const config = createQuipConfig('my-token');

      expect(config).toEqual({
        domain: 'quip.com',
        baseUrl: 'https://platform.quip.com',
        tokenUrl: 'https://quip.com/dev/token',
        personalAccessToken: 'my-token'
      });
    });
  });
});