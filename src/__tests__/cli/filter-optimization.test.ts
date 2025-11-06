import { DocumentFilter } from '../../services/quip/document-discovery';

describe('CLI Filter Optimization', () => {
  describe('Limit parameter handling', () => {
    it('should pass limit to DocumentFilter.maxDocuments', () => {
      // Simulate CLI option parsing
      const options = { limit: '25' };
      const limit = parseInt(options.limit);
      
      // Build filter as done in CLI
      const filter: DocumentFilter = {
        includeShared: undefined,
        includeTemplates: undefined,
        includeDeleted: undefined,
        maxDocuments: limit > 0 ? limit : undefined
      };

      expect(filter.maxDocuments).toBe(25);
    });

    it('should not set maxDocuments for invalid limits', () => {
      const testCases = [
        { limit: '0' },
        { limit: '-5' },
        { limit: 'invalid' }
      ];

      testCases.forEach(({ limit }) => {
        const parsedLimit = parseInt(limit);
        const filter: DocumentFilter = {
          includeShared: undefined,
          includeTemplates: undefined,
          includeDeleted: undefined,
          maxDocuments: parsedLimit > 0 ? parsedLimit : undefined
        };

        expect(filter.maxDocuments).toBeUndefined();
      });
    });

    it('should handle large limit values', () => {
      const options = { limit: '1000' };
      const limit = parseInt(options.limit);
      
      const filter: DocumentFilter = {
        includeShared: undefined,
        includeTemplates: undefined,
        includeDeleted: undefined,
        maxDocuments: limit > 0 ? limit : undefined
      };

      expect(filter.maxDocuments).toBe(1000);
    });
  });

  describe('Discovery message generation', () => {
    it('should show optimized message when limit is set', () => {
      const filter = { maxDocuments: 50 };
      
      const discoveryMessage = filter.maxDocuments 
        ? `🔍 Discovering up to ${filter.maxDocuments} documents...`
        : '🔍 Discovering all accessible documents...';

      expect(discoveryMessage).toBe('🔍 Discovering up to 50 documents...');
    });

    it('should show default message when no limit is set', () => {
      const filter = { maxDocuments: undefined };
      
      const discoveryMessage = filter.maxDocuments 
        ? `🔍 Discovering up to ${filter.maxDocuments} documents...`
        : '🔍 Discovering all accessible documents...';

      expect(discoveryMessage).toBe('🔍 Discovering all accessible documents...');
    });
  });

  describe('Search message generation', () => {
    it('should show limit in search message when set', () => {
      const query = 'test query';
      const filter = { maxDocuments: 25 };
      
      const searchMessage = filter.maxDocuments 
        ? `🔍 Searching for: "${query}" (limit: ${filter.maxDocuments})`
        : `🔍 Searching for: "${query}"`;

      expect(searchMessage).toBe('🔍 Searching for: "test query" (limit: 25)');
    });

    it('should show default search message when no limit is set', () => {
      const query = 'test query';
      const filter = { maxDocuments: undefined };
      
      const searchMessage = filter.maxDocuments 
        ? `🔍 Searching for: "${query}" (limit: ${filter.maxDocuments})`
        : `🔍 Searching for: "${query}"`;

      expect(searchMessage).toBe('🔍 Searching for: "test query"');
    });
  });
});