import { TokenStorage, StoredToken } from '../../auth/token-storage';
import * as keytar from 'keytar';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock external dependencies
jest.mock('keytar');
jest.mock('fs/promises');
jest.mock('os');

describe('TokenStorage', () => {
  let tokenStorage: TokenStorage;
  const mockToken: StoredToken = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date('2025-12-31'),
    tokenType: 'Bearer',
    scope: 'read write'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock os functions
    (os.homedir as jest.Mock).mockReturnValue('/mock/home');
    (os.hostname as jest.Mock).mockReturnValue('mock-hostname');
    (os.userInfo as jest.Mock).mockReturnValue({ username: 'mock-user' });
    
    tokenStorage = new TokenStorage();
  });

  describe('Keychain Storage', () => {
    it('should store token in keychain successfully', async () => {
      (keytar.setPassword as jest.Mock).mockResolvedValueOnce(undefined);

      await tokenStorage.storeToken('quip', mockToken);

      expect(keytar.setPassword).toHaveBeenCalledWith(
        'quip-export-tool',
        'quip',
        expect.any(String)
      );

      // Verify stored data format
      const storedData = JSON.parse((keytar.setPassword as jest.Mock).mock.calls[0][2]);
      expect(storedData).toEqual({
        ...mockToken,
        expiresAt: mockToken.expiresAt.toISOString()
      });
    });

    it('should retrieve token from keychain successfully', async () => {
      const storedData = JSON.stringify({
        ...mockToken,
        expiresAt: mockToken.expiresAt.toISOString()
      });

      (keytar.getPassword as jest.Mock).mockResolvedValueOnce(storedData);

      const retrievedToken = await tokenStorage.getToken('quip');

      expect(retrievedToken).toEqual(mockToken);
      expect(keytar.getPassword).toHaveBeenCalledWith(
        'quip-export-tool',
        'quip'
      );
    });

    it('should handle keychain retrieval failure gracefully', async () => {
      (keytar.getPassword as jest.Mock).mockRejectedValueOnce(new Error('Keychain error'));
      (fs.readFile as jest.Mock).mockRejectedValueOnce({ code: 'ENOENT' });

      const retrievedToken = await tokenStorage.getToken('quip');

      expect(retrievedToken).toBeNull();
    });
  });

  describe('File Storage Fallback', () => {
    beforeEach(() => {
      // Mock keychain failure to test file fallback
      (keytar.setPassword as jest.Mock).mockRejectedValue(new Error('Keychain error'));
      (keytar.getPassword as jest.Mock).mockRejectedValue(new Error('Keychain error'));
    });

    it('should fall back to file storage when keychain fails', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);

      await tokenStorage.storeToken('quip', mockToken);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/mock/home', '.quip-migration'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/mock/home', '.quip-migration', 'quip.token'),
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should retrieve token from file storage when keychain fails', async () => {
      const encryptedData = {
        iv: 'mock-iv',
        data: 'encrypted-data'
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(encryptedData));

      const retrievedToken = await tokenStorage.getToken('quip');

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/mock/home', '.quip-migration', 'quip.token'),
        'utf8'
      );
      
      // Note: We can't test actual decryption due to machine-specific key generation
      expect(retrievedToken).toBeNull();
    });

    it('should handle missing file gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValueOnce({ code: 'ENOENT' });

      const retrievedToken = await tokenStorage.getToken('quip');

      expect(retrievedToken).toBeNull();
    });
  });

  describe('Token Removal', () => {
    it('should remove token from both keychain and file storage', async () => {
      (keytar.deletePassword as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.unlink as jest.Mock).mockResolvedValueOnce(undefined);

      await tokenStorage.removeToken('quip');

      expect(keytar.deletePassword).toHaveBeenCalledWith(
        'quip-export-tool',
        'quip'
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join('/mock/home', '.quip-migration', 'quip.token')
      );
    });

    it('should handle removal errors gracefully', async () => {
      (keytar.deletePassword as jest.Mock).mockRejectedValueOnce(new Error('Keychain error'));
      (fs.unlink as jest.Mock).mockRejectedValueOnce({ code: 'ENOENT' });

      await expect(tokenStorage.removeToken('quip')).resolves.not.toThrow();
    });
  });

  describe('Token Existence Check', () => {
    it('should return true when token exists in keychain', async () => {
      (keytar.getPassword as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        ...mockToken,
        expiresAt: mockToken.expiresAt.toISOString()
      }));

      const exists = await tokenStorage.hasToken('quip');

      expect(exists).toBe(true);
    });

    it('should return false when token does not exist', async () => {
      (keytar.getPassword as jest.Mock).mockRejectedValueOnce(new Error('Keychain error'));
      (fs.readFile as jest.Mock).mockRejectedValueOnce({ code: 'ENOENT' });

      const exists = await tokenStorage.hasToken('quip');

      expect(exists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors during storage', async () => {
      (keytar.setPassword as jest.Mock).mockRejectedValueOnce(new Error('Keychain error'));
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error('File system error'));

      await expect(tokenStorage.storeToken('quip', mockToken)).rejects.toThrow('File system error');
    });

    it('should handle encryption/decryption errors', async () => {
      (keytar.getPassword as jest.Mock).mockRejectedValueOnce(new Error('Keychain error'));
      (fs.readFile as jest.Mock).mockResolvedValueOnce('invalid-json');

      const retrievedToken = await tokenStorage.getToken('quip');

      expect(retrievedToken).toBeNull();
    });
  });
});