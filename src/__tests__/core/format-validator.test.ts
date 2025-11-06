/**
 * Tests for format validation and dependency management
 */

import { FormatValidator } from '../../core/format-validator';

// Mock modules for testing
jest.mock('turndown', () => {
  return jest.fn().mockImplementation(() => ({
    turndown: jest.fn().mockReturnValue('# Test\nContent')
  }));
}, { virtual: true });

jest.mock('cheerio', () => ({
  load: jest.fn().mockReturnValue({
    text: jest.fn().mockReturnValue('Test content')
  })
}), { virtual: true });

describe('FormatValidator', () => {
  let validator: FormatValidator;

  beforeEach(() => {
    validator = new FormatValidator();
  });

  describe('checkFormatDependencies', () => {
    it('should return empty dependencies for native formats', async () => {
      const docxDeps = await validator.checkFormatDependencies('docx');
      expect(docxDeps).toEqual([]);

      const htmlDeps = await validator.checkFormatDependencies('html');
      expect(htmlDeps).toEqual([]);

      const pdfDeps = await validator.checkFormatDependencies('pdf');
      expect(pdfDeps).toEqual([]);
    });

    it('should check markdown dependencies', async () => {
      const markdownDeps = await validator.checkFormatDependencies('markdown');
      
      expect(markdownDeps).toHaveLength(2);
      expect(markdownDeps.find(d => d.name === 'turndown')).toBeDefined();
      expect(markdownDeps.find(d => d.name === 'cheerio')).toBeDefined();
      
      // Dependencies should be marked as required
      markdownDeps.forEach(dep => {
        expect(dep.required).toBe(true);
        expect(dep.installCommand).toContain('npm install');
      });
    });

    it('should handle unknown formats gracefully', async () => {
      const unknownDeps = await validator.checkFormatDependencies('unknown');
      expect(unknownDeps).toEqual([]);
    });
  });

  describe('getFormatCapabilities', () => {
    it('should return capabilities for all supported formats', async () => {
      const capabilities = await validator.getFormatCapabilities();
      
      expect(capabilities).toHaveLength(3); // native, html, markdown
      
      const formats = capabilities.map(c => c.format);
      expect(formats).toContain('native');
      expect(formats).toContain('html');
      expect(formats).toContain('markdown');
    });

    it('should mark native formats as available', async () => {
      const capabilities = await validator.getFormatCapabilities();
      
      const nativeFormats = ['native', 'html'];
      for (const format of nativeFormats) {
        const capability = capabilities.find(c => c.format === format);
        expect(capability).toBeDefined();
        expect(capability!.available).toBe(true);
        expect(capability!.dependencies).toEqual([]);
      }
    });

    it('should include document type support information', async () => {
      const capabilities = await validator.getFormatCapabilities();
      
      const nativeCapability = capabilities.find(c => c.format === 'native');
      expect(nativeCapability!.documentTypes).toContain('DOCUMENT');
      expect(nativeCapability!.documentTypes).toContain('SPREADSHEET');

      const htmlCapability = capabilities.find(c => c.format === 'html');
      expect(htmlCapability!.documentTypes).toContain('DOCUMENT');
      expect(htmlCapability!.documentTypes).toContain('SPREADSHEET');
      expect(htmlCapability!.documentTypes).toContain('CHAT');
    });
  });

  describe('validateFormatSelection', () => {
    it('should validate supported formats', async () => {
      const result = await validator.validateFormatSelection(['native', 'html', 'markdown']);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported formats', async () => {
      const result = await validator.validateFormatSelection(['invalid', 'unknown']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => 
        error.includes('Unsupported formats: invalid, unknown')
      )).toBe(true);
    });

    it('should validate document type compatibility', async () => {
      // Test DOCUMENT compatibility
      const documentResult = await validator.validateFormatSelection(
        ['native', 'html', 'markdown'], 
        ['DOCUMENT']
      );
      expect(documentResult.valid).toBe(true);

      // Test SPREADSHEET compatibility
      const spreadsheetResult = await validator.validateFormatSelection(
        ['native', 'html'], 
        ['SPREADSHEET']
      );
      expect(spreadsheetResult.valid).toBe(true);

      // Test incompatible combination - markdown not supported for SPREADSHEET
      const incompatibleResult = await validator.validateFormatSelection(
        ['markdown'], 
        ['SPREADSHEET']
      );
      expect(incompatibleResult.valid).toBe(false);
      expect(incompatibleResult.errors.some(error => 
        error.includes('not compatible with document type \'SPREADSHEET\'')
      )).toBe(true);
    });

    it('should provide warnings for suboptimal format choices', async () => {
      const result = await validator.validateFormatSelection(
        ['html'], 
        ['DOCUMENT']
      );
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(warning => 
        warning.includes('HTML export may not preserve all formatting')
      )).toBe(true);
    });

    it('should suggest recommended formats', async () => {
      const result = await validator.validateFormatSelection(
        ['html'], 
        ['DOCUMENT']
      );
      
      expect(result.warnings.some(warning => 
        warning.includes('consider using recommended formats: native')
      )).toBe(true);
    });

    it('should handle multiple document types', async () => {
      const result = await validator.validateFormatSelection(
        ['html'], 
        ['DOCUMENT', 'SPREADSHEET', 'CHAT']
      );
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should fail when no formats are available', async () => {
      // Mock all formats as unavailable
      const mockValidator = new FormatValidator();
      jest.spyOn(mockValidator, 'getFormatCapabilities').mockResolvedValue([
        {
          format: 'markdown',
          available: false,
          dependencies: [{ name: 'turndown', required: true, available: false }],
          documentTypes: ['DOCUMENT'],
          error: 'Missing dependencies'
        }
      ]);

      const result = await mockValidator.validateFormatSelection(['markdown']);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => 
        error.includes('No selected formats are currently available')
      )).toBe(true);
    });
  });

  describe('getDependencyInstructions', () => {
    it('should return installation instructions for markdown', () => {
      const instructions = validator.getDependencyInstructions('markdown');
      
      expect(instructions).toHaveLength(2);
      expect(instructions[0]).toContain('Install turndown');
      expect(instructions[1]).toContain('Install cheerio');
      expect(instructions[0]).toContain('npm install');
      expect(instructions[1]).toContain('npm install');
    });

    it('should return empty instructions for native formats', () => {
      expect(validator.getDependencyInstructions('docx')).toEqual([]);
      expect(validator.getDependencyInstructions('html')).toEqual([]);
      expect(validator.getDependencyInstructions('pdf')).toEqual([]);
    });

    it('should handle unknown formats', () => {
      expect(validator.getDependencyInstructions('unknown')).toEqual([]);
    });
  });

  describe('getGracefulDegradationOptions', () => {
    it('should provide fallback options for markdown', () => {
      const alternatives = validator.getGracefulDegradationOptions(['markdown']);
      
      expect(alternatives.markdown).toContain('html');
    });

    it('should provide fallback options for native', () => {
      const alternatives = validator.getGracefulDegradationOptions(['native']);
      
      expect(alternatives.native).toContain('html');
    });

    it('should provide fallback options for markdown', () => {
      const alternatives = validator.getGracefulDegradationOptions(['markdown']);
      
      expect(alternatives.markdown).toContain('html');
    });

    it('should provide fallback options for known unavailable formats', () => {
      // Test that native format can fallback to html
      const nativeAlternatives = validator.getGracefulDegradationOptions(['native']);
      expect(nativeAlternatives.native).toContain('html');

      // Test that markdown can fallback to html  
      const markdownAlternatives = validator.getGracefulDegradationOptions(['markdown']);
      expect(markdownAlternatives.markdown).toContain('html');
    });

    it('should handle multiple unavailable formats', () => {
      const alternatives = validator.getGracefulDegradationOptions(
        ['markdown', 'native']
      );
      
      expect(alternatives.markdown).toBeDefined();
      expect(alternatives.native).toBeDefined();
      expect(alternatives.markdown).toContain('html');
      expect(alternatives.native).toContain('html');
    });

    it('should return empty alternatives for formats without fallbacks', () => {
      const alternatives = validator.getGracefulDegradationOptions(['unknown']);
      
      expect(alternatives.unknown).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty format arrays', async () => {
      const result = await validator.validateFormatSelection([]);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.capabilities).toHaveLength(3);
    });

    it('should handle undefined document types', async () => {
      const result = await validator.validateFormatSelection(['native'], undefined);
      
      expect(result.valid).toBe(true);
    });

    it('should handle empty document types array', async () => {
      const result = await validator.validateFormatSelection(['native'], []);
      
      expect(result.valid).toBe(true);
    });

    it('should handle unknown document types', async () => {
      const result = await validator.validateFormatSelection(['native'], ['UNKNOWN']);
      
      expect(result.valid).toBe(true);
      // Should not crash, just ignore unknown document types
    });
  });
});