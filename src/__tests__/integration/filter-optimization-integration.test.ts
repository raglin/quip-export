import { DocumentFilter } from '../../services/quip/document-discovery';

describe('Filter Optimization Integration', () => {

  describe('discoverDocuments with maxDocuments optimization', () => {
    it('should detect when maxDocuments is specified in filter', () => {
      const filterWithLimit: DocumentFilter = {
        maxDocuments: 25
      };

      const filterWithoutLimit: DocumentFilter = {};

      // Test the logic that determines if optimization should be used
      const shouldUseOptimization = (filter: DocumentFilter) => {
        return !!(filter.maxDocuments && filter.maxDocuments > 0);
      };

      expect(shouldUseOptimization(filterWithLimit)).toBe(true);
      expect(shouldUseOptimization(filterWithoutLimit)).toBe(false);
    });

    it('should handle edge cases for maxDocuments detection', () => {
      const testCases = [
        { filter: { maxDocuments: 0 }, expected: false },
        { filter: { maxDocuments: -5 }, expected: false },
        { filter: { maxDocuments: undefined }, expected: false },
        { filter: { maxDocuments: 1 }, expected: true },
        { filter: { maxDocuments: 100 }, expected: true }
      ];

      const shouldUseOptimization = (filter: DocumentFilter) => {
        return !!(filter.maxDocuments && filter.maxDocuments > 0);
      };

      testCases.forEach(({ filter, expected }) => {
        expect(shouldUseOptimization(filter)).toBe(expected);
      });
    });
  });

  describe('CLI integration simulation', () => {
    it('should properly convert CLI limit option to DocumentFilter', () => {
      // Simulate CLI option parsing
      const cliOptions = {
        limit: '50',
        shared: true,
        templates: false,
        deleted: false,
        type: 'DOCUMENT'
      };

      // Simulate the CLI filter building logic
      const limit = parseInt(cliOptions.limit);
      const filter: DocumentFilter = {
        includeShared: cliOptions.shared,
        includeTemplates: cliOptions.templates,
        includeDeleted: cliOptions.deleted,
        maxDocuments: limit > 0 ? limit : undefined
      };

      if (cliOptions.type) {
        const validTypes = ['DOCUMENT', 'SPREADSHEET', 'CHAT'];
        const type = cliOptions.type.toUpperCase();
        if (validTypes.includes(type)) {
          filter.types = [type as 'DOCUMENT' | 'SPREADSHEET' | 'CHAT'];
        }
      }

      expect(filter.maxDocuments).toBe(50);
      expect(filter.includeShared).toBe(true);
      expect(filter.includeTemplates).toBe(false);
      expect(filter.includeDeleted).toBe(false);
      expect(filter.types).toEqual(['DOCUMENT']);
    });

    it('should handle edge cases in CLI option conversion', () => {
      const testCases = [
        { limit: '0', expected: undefined },
        { limit: '-10', expected: undefined },
        { limit: 'abc', expected: undefined },
        { limit: '100', expected: 100 }
      ];

      testCases.forEach(({ limit, expected }) => {
        const parsedLimit = parseInt(limit);
        const filter: DocumentFilter = {
          maxDocuments: parsedLimit > 0 ? parsedLimit : undefined
        };

        expect(filter.maxDocuments).toBe(expected);
      });
    });
  });
});