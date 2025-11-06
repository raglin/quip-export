// Authentication-specific types and interfaces

export interface QuipAuthConfig {
  domain: string; // e.g., 'quip.com', 'quip-enterprise.com'
  baseUrl: string; // e.g., 'https://platform.quip.com', 'https://platform.quip-enterprise.com'
  tokenUrl: string; // e.g., 'https://quip.com/dev/token', 'https://quip-enterprise.com/dev/token'
  personalAccessToken: string;
}

export interface AuthenticationResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface IAuthManager {
  authenticateQuip(): Promise<AuthenticationResult>;
  isAuthenticated(): boolean;
  logout(): Promise<void>;
}
