import { QuipService } from '../../../services/quip/quip-service';
import { AuthManager } from '../../../auth/auth-manager';
import { ConsoleLogger } from '../../../core/logger';
import { QuipDocument } from '../../../types';

// Mock all dependencies
jest.mock('../../../services/quip/api-client');
jest.mock('../../../services/quip/document-discovery');
jest.mock('../../../services/quip/document-exporter');
jest.mock('../../../auth/auth-manager');

describe('QuipService Integration', () => {
  let quipService: QuipService;
  let mockAuthManager: jest.Mocked<AuthManager>;
  let logger: ConsoleLogger;

  const mockDocument: QuipDocument = {
    id: 'doc-123',
    title: 'Test Document',
    type: 'DOCUMENT',
    created_usec: Date.now() * 1000,
    updated_usec: Date.now() * 1000,
    author_id: 'user-123',
    owning_company_id: 'company-123',
    link: 'https://quip.com/doc-123',
    secret_path: 'secret-path-123',
    is_template: false,
    is_deleted: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAuthManager = {
      getValidToken: jest.fn(),
    } as any;

    logger = new ConsoleLogger('ERROR');
    quipService = new QuipService(mockAuthManager, logger);
  });

  describe('Service Integration', () => {
    it('should integrate all Quip service components', () => {
      // Verify that the service has access to all components
      expect(quipService.getApiClient()).toBeDefined();
      expect(quipService.getDocumentDiscovery()).toBeDefined();
      expect(quipService.getDocumentExporter()).toBeDefined();
    });

    it('should provide high-level document listing', async () => {
      // Mock the discovery service
      const mockDiscovery = quipService.getDocumentDiscovery();
      (mockDiscovery.discoverDocuments as jest.Mock).mockResolvedValue({
        documents: [
          { document: mockDocument, folderPath: 'Test Folder', isShared: false },
        ],
        folders: [],
        totalCount: 1,
        filteredCount: 1,
      });

      const documents = await quipService.listDocuments();

      expect(documents).toHaveLength(1);
      expect(documents[0]).toEqual(mockDocument);
    });

    it('should provide document export functionality', async () => {
      // Mock the discovery and exporter services
      const mockDiscovery = quipService.getDocumentDiscovery();
      const mockExporter = quipService.getDocumentExporter();

      (mockDiscovery.getDocumentMetadata as jest.Mock).mockResolvedValue(mockDocument);
      (mockExporter.exportDocument as jest.Mock).mockResolvedValue({
        success: true,
        documentId: 'doc-123',
        title: 'Test Document',
        format: 'docx',
        content: Buffer.from('test content'),
        metadata: mockDocument,
      });
      (mockExporter.createDocumentExport as jest.Mock).mockReturnValue({
        documentId: 'doc-123',
        title: 'Test Document',
        format: 'docx',
        content: Buffer.from('test content'),
        metadata: mockDocument,
        folderPath: 'Documents',
      });

      const result = await quipService.exportDocument('doc-123', 'docx');

      expect(result.documentId).toBe('doc-123');
      expect(result.format).toBe('docx');
      expect(result.folderPath).toBe('Documents');
    });

    it('should handle export errors gracefully', async () => {
      const mockDiscovery = quipService.getDocumentDiscovery();
      const mockExporter = quipService.getDocumentExporter();

      (mockDiscovery.getDocumentMetadata as jest.Mock).mockResolvedValue(mockDocument);
      (mockExporter.exportDocument as jest.Mock).mockResolvedValue({
        success: false,
        documentId: 'doc-123',
        title: 'Test Document',
        format: 'docx',
        error: 'Export failed',
      });

      await expect(quipService.exportDocument('doc-123', 'docx')).rejects.toThrow('Export failed');
    });

    it('should test API connectivity', async () => {
      const mockApiClient = quipService.getApiClient();
      (mockApiClient.testConnection as jest.Mock).mockResolvedValue({
        success: true,
        data: true,
      });

      const result = await quipService.testConnection();

      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle document not found errors', async () => {
      const mockDiscovery = quipService.getDocumentDiscovery();
      (mockDiscovery.getDocumentMetadata as jest.Mock).mockResolvedValue(null);

      await expect(quipService.getDocument('nonexistent-doc')).rejects.toThrow('Document not found: nonexistent-doc');
    });

    it('should handle API connectivity failures', async () => {
      const mockApiClient = quipService.getApiClient();
      (mockApiClient.testConnection as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Connection failed',
      });

      const result = await quipService.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      const mockDiscovery = quipService.getDocumentDiscovery();
      (mockDiscovery.clearCache as jest.Mock).mockImplementation(() => {});

      quipService.clearCache();

      expect(mockDiscovery.clearCache).toHaveBeenCalled();
    });
  });
});