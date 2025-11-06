import { DocumentDiscovery, DocumentFilter, DocumentWithPath } from '../../../services/quip/document-discovery';
import { QuipApiClient } from '../../../services/quip/api-client';
import { ConsoleLogger } from '../../../core/logger';
import { QuipDocument } from '../../../types';

// Mock the QuipApiClient
jest.mock('../../../services/quip/api-client');

describe('DocumentDiscovery Limit Optimization', () => {
  let documentDiscovery: DocumentDiscovery;
  let mockApiClient: jest.Mocked<QuipApiClient>;
  let mockLogger: ConsoleLogger;

  beforeEach(() => {
    mockLogger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    mockApiClient = new QuipApiClient({} as any, mockLogger) as jest.Mocked<QuipApiClient>;
    documentDiscovery = new DocumentDiscovery(mockApiClient, mockLogger);
  });

  describe('applyFilters with maxDocuments', () => {
    const createMockDocumentWithPath = (id: string, title: string, type: 'DOCUMENT' | 'SPREADSHEET' | 'CHAT' = 'DOCUMENT'): DocumentWithPath => ({
      document: {
        id,
        title,
        type,
        created_usec: Date.now() * 1000,
        updated_usec: Date.now() * 1000,
        link: `https://quip.com/${id}`,
        is_template: false,
        is_deleted: false,
        author_id: 'user1'
      } as QuipDocument,
      folderPath: 'Documents',
      isShared: false
    });

    it('should apply maxDocuments limit correctly', () => {
      const documents = [
        createMockDocumentWithPath('doc1', 'Document 1'),
        createMockDocumentWithPath('doc2', 'Document 2'),
        createMockDocumentWithPath('doc3', 'Document 3'),
        createMockDocumentWithPath('doc4', 'Document 4'),
        createMockDocumentWithPath('doc5', 'Document 5')
      ];

      const filter: DocumentFilter = {
        maxDocuments: 3
      };

      // Access the private method using bracket notation for testing
      const result = (documentDiscovery as any).applyFilters(documents, filter);

      expect(result).toHaveLength(3);
      expect(result[0].document.id).toBe('doc1');
      expect(result[1].document.id).toBe('doc2');
      expect(result[2].document.id).toBe('doc3');
    });

    it('should not limit when maxDocuments is not set', () => {
      const documents = [
        createMockDocumentWithPath('doc1', 'Document 1'),
        createMockDocumentWithPath('doc2', 'Document 2'),
        createMockDocumentWithPath('doc3', 'Document 3')
      ];

      const filter: DocumentFilter = {};

      const result = (documentDiscovery as any).applyFilters(documents, filter);

      expect(result).toHaveLength(3);
    });

    it('should not limit when maxDocuments is 0 or negative', () => {
      const documents = [
        createMockDocumentWithPath('doc1', 'Document 1'),
        createMockDocumentWithPath('doc2', 'Document 2')
      ];

      const filterZero: DocumentFilter = { maxDocuments: 0 };
      const filterNegative: DocumentFilter = { maxDocuments: -5 };

      const resultZero = (documentDiscovery as any).applyFilters(documents, filterZero);
      const resultNegative = (documentDiscovery as any).applyFilters(documents, filterNegative);

      expect(resultZero).toHaveLength(2);
      expect(resultNegative).toHaveLength(2);
    });

    it('should return all documents when limit exceeds document count', () => {
      const documents = [
        createMockDocumentWithPath('doc1', 'Document 1'),
        createMockDocumentWithPath('doc2', 'Document 2')
      ];

      const filter: DocumentFilter = {
        maxDocuments: 10
      };

      const result = (documentDiscovery as any).applyFilters(documents, filter);

      expect(result).toHaveLength(2);
    });

    it('should apply other filters before limiting', () => {
      const documents = [
        createMockDocumentWithPath('doc1', 'Document 1', 'DOCUMENT'),
        createMockDocumentWithPath('doc2', 'Spreadsheet 1', 'SPREADSHEET'),
        createMockDocumentWithPath('doc3', 'Document 2', 'DOCUMENT'),
        createMockDocumentWithPath('doc4', 'Spreadsheet 2', 'SPREADSHEET'),
        createMockDocumentWithPath('doc5', 'Document 3', 'DOCUMENT')
      ];

      const filter: DocumentFilter = {
        types: ['DOCUMENT'],
        maxDocuments: 2
      };

      const result = (documentDiscovery as any).applyFilters(documents, filter);

      expect(result).toHaveLength(2);
      expect(result[0].document.type).toBe('DOCUMENT');
      expect(result[1].document.type).toBe('DOCUMENT');
      expect(result[0].document.id).toBe('doc1');
      expect(result[1].document.id).toBe('doc3');
    });

    it('should handle empty document array with limit', () => {
      const documents: DocumentWithPath[] = [];
      const filter: DocumentFilter = {
        maxDocuments: 5
      };

      const result = (documentDiscovery as any).applyFilters(documents, filter);

      expect(result).toHaveLength(0);
    });
  });
});