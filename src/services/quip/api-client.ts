import { AuthManager } from '../../auth/auth-manager';
import { QuipDocument, ApiResponse, Logger } from '../../types';
import { QuipListResponse } from './types';
import { QuipAuthConfig } from '../../auth/types';

/**
 * Rate limiter for Quip API calls
 * Quip limits: 50 requests per minute per user, 750 requests per hour per user
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute = 50;
  private readonly maxRequestsPerHour = 750;

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Clean old requests (older than 1 hour)
    this.requests = this.requests.filter(time => now - time < 60 * 60 * 1000);
    
    // Check hourly limit
    if (this.requests.length >= this.maxRequestsPerHour) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = (oldestRequest + 60 * 60 * 1000) - now;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }
    
    // Check per-minute limit
    const recentRequests = this.requests.filter(time => now - time < 60 * 1000);
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      const oldestRecentRequest = Math.min(...recentRequests);
      const waitTime = (oldestRecentRequest + 60 * 1000) - now;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }
    
    this.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * HTTP client for Quip API with authentication, rate limiting, and retry logic
 * Supports personal access token authentication with configurable domains
 */
export class QuipApiClient {
  private readonly baseUrl: string;
  private readonly authManager: AuthManager;
  private readonly authConfig?: QuipAuthConfig;
  private readonly rateLimiter = new RateLimiter();
  private readonly logger: Logger;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // Base delay in ms

  constructor(authManager: AuthManager, logger: Logger, authConfig?: QuipAuthConfig, baseUrl?: string) {
    this.authManager = authManager;
    this.logger = logger;
    this.authConfig = authConfig;
    
    // Determine base URL from auth config or fallback to parameter or default
    if (authConfig?.baseUrl) {
      this.baseUrl = authConfig.baseUrl;
    } else if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      this.baseUrl = 'https://platform.quip.com';
    }
    
    this.logger.debug(`QuipApiClient initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Make authenticated HTTP request to Quip API with retry logic
   * Supports personal access token authentication
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    await this.rateLimiter.waitIfNeeded();

    const token = await this.getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'No valid Quip authentication token available',
        statusCode: 401
      };
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'QuipToOneDriveMigrationTool/1.0',
      ...options.headers
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Making request to ${url} (attempt ${attempt + 1})`);

        const response = await fetch(url, {
          ...options,
          headers
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.getRetryDelay(attempt);
          
          this.logger.warn(`Rate limited, waiting ${delay}ms before retry`);
          await this.sleep(delay);
          continue;
        }

        // Handle authentication errors
        if (response.status === 401) {
          this.logger.warn('Authentication failed - invalid personal access token');
          
          // Personal access tokens don't expire, so return auth error
          return {
            success: false,
            error: 'Authentication failed - check your personal access token',
            statusCode: 401
          };
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorText = await response.text();
          const error = `HTTP ${response.status}: ${errorText}`;
          
          // Don't retry client errors (4xx) except 429 and 401
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error,
              statusCode: response.status
            };
          }
          
          // Retry server errors (5xx)
          lastError = new Error(error);
          await this.sleep(this.getRetryDelay(attempt));
          continue;
        }

        // Success - parse response
        const data = await response.json() as T;
        this.logger.debug(`Request successful: ${url}`);
        
        return {
          success: true,
          data,
          statusCode: response.status
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Request failed (attempt ${attempt + 1}): ${lastError.message}`);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.getRetryDelay(attempt));
        }
      }
    }

    return {
      success: false,
      error: `Request failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
      statusCode: 500
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(attempt: number): number {
    return this.retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get authentication token for personal access token authentication
   */
  private async getAuthToken(): Promise<string | null> {
    // If we have auth config with personal access token, use it directly
    if (this.authConfig?.personalAccessToken) {
      return this.authConfig.personalAccessToken;
    }
    
    // Get token from auth manager (stored personal token)
    return await this.authManager.getValidToken();
  }

  /**
   * Validate authentication token using domain-specific /1/users/current endpoint
   */
  async validateToken(): Promise<ApiResponse<any>> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'No authentication token available',
          statusCode: 401
        };
      }

      // Make direct request to avoid infinite recursion with makeRequest
      const url = `${this.baseUrl}/1/users/current`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'QuipToOneDriveMigrationTool/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Token validation failed: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: response.status
        };
      }

      const userData = await response.json() as any;
      this.logger.debug(`Token validation successful for user: ${userData.name || userData.id}`);
      
      return {
        success: true,
        data: userData,
        statusCode: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: `Token validation error: ${error instanceof Error ? error.message : String(error)}`,
        statusCode: 500
      };
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.makeRequest('/1/users/current');
  }

  /**
   * Get folder contents and metadata
   */
  async getFolderContents(folderId: string): Promise<ApiResponse<QuipListResponse>> {
    return this.makeRequest(`/1/folders/${folderId}`);
  }

  /**
   * Get document metadata using V2 API
   */
  async getDocumentMetadata(threadIdOrSecretPath: string): Promise<ApiResponse<QuipDocument>> {
    return this.makeRequest(`/2/threads/${threadIdOrSecretPath}`);
  }

  /**
   * Export document as DOCX (primary format)
   */
  async exportDocumentDocx(threadId: string): Promise<ApiResponse<Buffer>> {
    await this.rateLimiter.waitIfNeeded();

    const token = await this.getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'No valid authentication token available',
        statusCode: 401
      };
    }

    const url = `${this.baseUrl}/1/threads/${threadId}/export/docx`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'User-Agent': 'QuipToOneDriveMigrationTool/1.0'
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Exporting DOCX from ${url} (attempt ${attempt + 1})`);

        const response = await fetch(url, { headers });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.getRetryDelay(attempt);
          
          this.logger.warn(`Rate limited, waiting ${delay}ms before retry`);
          await this.sleep(delay);
          continue;
        }

        // Handle authentication errors
        if (response.status === 401) {
          this.logger.warn('Authentication failed during DOCX export');
          
          return {
            success: false,
            error: 'Personal access token is invalid or expired. Please generate a new token.',
            statusCode: 401
          };
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorText = await response.text();
          const error = `HTTP ${response.status}: ${errorText}`;
          
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error,
              statusCode: response.status
            };
          }
          
          lastError = new Error(error);
          await this.sleep(this.getRetryDelay(attempt));
          continue;
        }

        // Success - get binary data
        const buffer = Buffer.from(await response.arrayBuffer());
        this.logger.debug(`DOCX export successful: ${url}, size: ${buffer.length} bytes`);
        
        return {
          success: true,
          data: buffer,
          statusCode: response.status
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`DOCX export failed (attempt ${attempt + 1}): ${lastError.message}`);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.getRetryDelay(attempt));
        }
      }
    }

    return {
      success: false,
      error: `DOCX export failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
      statusCode: 500
    };
  }

  /**
   * Export document as HTML (fallback format)
   */
  async exportDocumentHtml(threadIdOrSecretPath: string): Promise<ApiResponse<string>> {
    const response = await this.makeRequest<any>(`/2/threads/${threadIdOrSecretPath}/html`);
    
    if (response.success && response.data && response.data.html) {
      return {
        success: true,
        data: response.data.html,
        statusCode: response.statusCode
      };
    }
    
    return {
      success: false,
      error: 'HTML export did not return expected format',
      statusCode: response.statusCode || 500
    };
  }

  /**
   * Export spreadsheet as XLSX
   */
  async exportSpreadsheetXlsx(threadId: string): Promise<ApiResponse<Buffer>> {
    await this.rateLimiter.waitIfNeeded();

    const token = await this.getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'No valid authentication token',
        statusCode: 401
      };
    }

    const url = `${this.baseUrl}/1/threads/${threadId}/export/xlsx`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'User-Agent': 'QuipToOneDriveMigrationTool/1.0'
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Exporting XLSX from ${url} (attempt ${attempt + 1})`);

        const response = await fetch(url, { headers });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.getRetryDelay(attempt);
          
          this.logger.warn(`Rate limited, waiting ${delay}ms before retry`);
          await this.sleep(delay);
          continue;
        }

        // Handle authentication errors
        if (response.status === 401) {
          this.logger.warn('Authentication failed during XLSX export');
          
          return {
            success: false,
            error: 'Personal access token is invalid or expired. Please generate a new token.',
            statusCode: 401
          };
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorText = await response.text();
          const error = `HTTP ${response.status}: ${errorText}`;
          
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error,
              statusCode: response.status
            };
          }
          
          lastError = new Error(error);
          await this.sleep(this.getRetryDelay(attempt));
          continue;
        }

        // Success - get binary data
        const buffer = Buffer.from(await response.arrayBuffer());
        this.logger.debug(`XLSX export successful: ${url}, size: ${buffer.length} bytes`);
        
        return {
          success: true,
          data: buffer,
          statusCode: response.status
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`XLSX export failed (attempt ${attempt + 1}): ${lastError.message}`);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.getRetryDelay(attempt));
        }
      }
    }

    return {
      success: false,
      error: `XLSX export failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
      statusCode: 500
    };
  }

  /**
   * Search for documents
   */
  async searchDocuments(query: string, count: number = 100): Promise<ApiResponse<QuipListResponse>> {
    const params = new URLSearchParams({
      query,
      count: count.toString()
    });
    
    return this.makeRequest(`/1/threads/search?${params}`);
  }

  /**
   * Get user's recent documents
   */
  async getRecentDocuments(count: number = 100): Promise<ApiResponse<QuipListResponse>> {
    const params = new URLSearchParams({
      count: count.toString()
    });
    
    return this.makeRequest(`/1/threads/recent?${params}`);
  }



  /**
   * Test API connectivity and authentication
   */
  async testConnection(): Promise<ApiResponse<boolean>> {
    const userResponse = await this.getCurrentUser();
    
    if (userResponse.success) {
      return {
        success: true,
        data: true,
        statusCode: userResponse.statusCode
      };
    }
    
    return {
      success: false,
      error: `Connection test failed: ${userResponse.error}`,
      statusCode: userResponse.statusCode
    };
  }
}