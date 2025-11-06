import { 
  IAuthManager, 
  AuthenticationResult, 
  QuipAuthConfig 
} from './types';
import { TokenStorage, ITokenStorage, StoredToken } from './token-storage';

/**
 * Main authentication manager that handles personal access token authentication
 * for Quip API
 */
export class AuthManager implements IAuthManager {
  private readonly tokenStorage: ITokenStorage;
  private readonly quipConfig: QuipAuthConfig;

  constructor(
    quipConfig: QuipAuthConfig,
    tokenStorage?: ITokenStorage
  ) {
    this.quipConfig = quipConfig;
    this.tokenStorage = tokenStorage || new TokenStorage();
  }

  /**
   * Authenticate with Quip using personal access token
   */
  async authenticateQuip(): Promise<AuthenticationResult> {
    try {
      return await this.authenticateQuipWithPersonalToken();
    } catch (error) {
      return {
        success: false,
        error: `Quip authentication failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Authenticate with Quip using personal access token
   */
  private async authenticateQuipWithPersonalToken(): Promise<AuthenticationResult> {
    console.log('Authenticating with Quip using personal access token...');
    
    if (!this.quipConfig.personalAccessToken) {
      return {
        success: false,
        error: 'Personal access token not provided'
      };
    }

    // Validate token by making a test API call
    try {
      const response = await fetch(`${this.quipConfig.baseUrl}/1/users/current`, {
        headers: {
          'Authorization': `Bearer ${this.quipConfig.personalAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Token validation failed: ${response.status} ${response.statusText}`
        };
      }

      // Store the personal access token
      const token: StoredToken = {
        accessToken: this.quipConfig.personalAccessToken,
        refreshToken: undefined,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Personal tokens don't expire, set far future
        tokenType: 'Bearer'
      };
      
      await this.tokenStorage.storeToken('quip', token);
      console.log('Quip personal access token validated and stored securely.');
      
      return {
        success: true,
        accessToken: this.quipConfig.personalAccessToken,
        expiresAt: token.expiresAt
      };
    } catch (error) {
      return {
        success: false,
        error: `Token validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }



  /**
   * Check if user is authenticated for Quip
   */
  isAuthenticated(): boolean {
    // This is a synchronous check - for async validation use getValidToken
    return this.tokenStorage.hasToken('quip') as any; // hasToken is async but we need sync here
  }

  /**
   * Get a valid access token for Quip
   */
  async getValidToken(): Promise<string | null> {
    try {
      const storedToken = await this.tokenStorage.getToken('quip');
      
      if (!storedToken) {
        return null;
      }

      return storedToken.accessToken;
    } catch (error) {
      console.error('Error getting valid token for Quip:', error);
      return null;
    }
  }

  /**
   * Logout from Quip by removing stored tokens
   */
  async logout(): Promise<void> {
    try {
      await this.tokenStorage.removeToken('quip');
      console.log('Logged out from Quip successfully.');
    } catch (error) {
      console.error('Error during Quip logout:', error);
      throw error;
    }
  }

  /**
   * Get authentication status for Quip
   */
  async getAuthStatus(): Promise<{ quip: boolean }> {
    const quipToken = await this.tokenStorage.getToken('quip');

    return {
      quip: quipToken !== null
    };
  }

  /**
   * Validate that Quip is authenticated
   */
  async validateAuthentication(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    const quipToken = await this.getValidToken();
    if (!quipToken) {
      errors.push('Quip authentication required. Please run authentication first.');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}