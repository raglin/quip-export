import {
  createQuipConfig,
  loadConfigFromEnv
} from '../../auth/config';

describe('Auth Configuration', () => {
  describe('createQuipConfig', () => {
    it('should create personal token config with default domain', () => {
      const config = createQuipConfig('test-token');

      expect(config).toEqual({
        domain: 'quip.com',
        baseUrl: 'https://platform.quip.com',
        tokenUrl: 'https://quip.com/dev/token',
        personalAccessToken: 'test-token'
      });
    });

    it('should create personal token config with custom domain', () => {
      const config = createQuipConfig('test-token', 'quip-enterprise.com');

      expect(config).toEqual({
        domain: 'quip-enterprise.com',
        baseUrl: 'https://platform.quip-enterprise.com',
        tokenUrl: 'https://quip-enterprise.com/dev/token',
        personalAccessToken: 'test-token'
      });
    });

    it('should handle enterprise domains correctly', () => {
      const config = createQuipConfig('token', 'company.quip.com');

      expect(config.baseUrl).toBe('https://platform.company.quip.com');
      expect(config.tokenUrl).toBe('https://company.quip.com/dev/token');
    });
  });



  describe('loadConfigFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should load personal token config from environment', () => {
      process.env.QUIP_PERSONAL_ACCESS_TOKEN = 'env-token';
      process.env.QUIP_DOMAIN = 'quip-test.com';

      const config = loadConfigFromEnv();

      expect(config.quip).toEqual({
        domain: 'quip-test.com',
        baseUrl: 'https://platform.quip-test.com',
        tokenUrl: 'https://quip-test.com/dev/token',
        personalAccessToken: 'env-token'
      });
    });





    it('should return null configs when environment variables are missing', () => {
      // Clear all relevant environment variables
      delete process.env.QUIP_PERSONAL_ACCESS_TOKEN;

      const config = loadConfigFromEnv();

      expect(config.quip).toBeNull();
    });

    it('should use default domain when QUIP_DOMAIN is not set', () => {
      process.env.QUIP_PERSONAL_ACCESS_TOKEN = 'token';
      delete process.env.QUIP_DOMAIN;

      const config = loadConfigFromEnv();

      expect(config.quip?.domain).toBe('quip.com');
    });


  });
});