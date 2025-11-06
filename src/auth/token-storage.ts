import * as keytar from 'keytar';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'node:crypto';
import * as os from 'os';

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string;
}

export interface ITokenStorage {
  storeToken(service: string, token: StoredToken): Promise<void>;
  getToken(service: string): Promise<StoredToken | null>;
  removeToken(service: string): Promise<void>;
  hasToken(service: string): Promise<boolean>;
}

/**
 * Secure token storage using system keychain (preferred) with encrypted file fallback
 */
export class TokenStorage implements ITokenStorage {
  private readonly serviceName = 'quip-export-tool';
  private readonly fallbackDir: string;

  constructor() {
    this.fallbackDir = path.join(os.homedir(), '.quip-migration');
  }

  /**
   * Store token securely using keychain or encrypted file fallback
   */
  async storeToken(service: string, token: StoredToken): Promise<void> {
    const tokenData = JSON.stringify({
      ...token,
      expiresAt: token.expiresAt.toISOString(),
    });

    try {
      // Try keychain first (most secure)
      await keytar.setPassword(this.serviceName, service, tokenData);
    } catch (error) {
      console.warn(`Keychain storage failed, using encrypted file fallback: ${error}`);
      await this.storeTokenToFile(service, tokenData);
    }
  }

  /**
   * Retrieve token from keychain or encrypted file
   */
  async getToken(service: string): Promise<StoredToken | null> {
    try {
      // Try keychain first
      const tokenData = await keytar.getPassword(this.serviceName, service);
      if (tokenData) {
        return this.parseTokenData(tokenData);
      }
    } catch (error) {
      console.warn(`Keychain retrieval failed, trying file fallback: ${error}`);
    }

    // Fallback to encrypted file
    try {
      const tokenData = await this.getTokenFromFile(service);
      if (tokenData) {
        return this.parseTokenData(tokenData);
      }
    } catch (error) {
      console.warn(`File retrieval failed: ${error}`);
    }

    return null;
  }

  /**
   * Remove token from both keychain and file storage
   */
  async removeToken(service: string): Promise<void> {
    try {
      await keytar.deletePassword(this.serviceName, service);
    } catch (error) {
      // Ignore keychain errors during removal
    }

    try {
      await this.removeTokenFromFile(service);
    } catch (error) {
      // Ignore file errors during removal
    }
  }

  /**
   * Check if token exists in either storage
   */
  async hasToken(service: string): Promise<boolean> {
    const token = await this.getToken(service);
    return token !== null;
  }

  /**
   * Store token to encrypted file as fallback
   */
  private async storeTokenToFile(service: string, tokenData: string): Promise<void> {
    await fs.mkdir(this.fallbackDir, { recursive: true });

    const key = Buffer.from(this.getEncryptionKey(), 'hex').subarray(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(tokenData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedData = {
      iv: iv.toString('hex'),
      data: encrypted,
    };

    const filePath = path.join(this.fallbackDir, `${service}.token`);
    await fs.writeFile(filePath, JSON.stringify(encryptedData), { mode: 0o600 });
  }

  /**
   * Retrieve token from encrypted file
   */
  private async getTokenFromFile(service: string): Promise<string | null> {
    const filePath = path.join(this.fallbackDir, `${service}.token`);

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const encryptedData = JSON.parse(fileContent);

      const key = Buffer.from(this.getEncryptionKey(), 'hex').subarray(0, 32);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Remove token file
   */
  private async removeTokenFromFile(service: string): Promise<void> {
    const filePath = path.join(this.fallbackDir, `${service}.token`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Generate encryption key based on machine-specific data
   */
  private getEncryptionKey(): string {
    const machineId = os.hostname() + os.userInfo().username;
    return crypto.createHash('sha256').update(machineId).digest('hex');
  }

  /**
   * Parse stored token data and convert date strings back to Date objects
   */
  private parseTokenData(tokenData: string): StoredToken {
    const parsed = JSON.parse(tokenData);
    return {
      ...parsed,
      expiresAt: new Date(parsed.expiresAt),
    };
  }
}
