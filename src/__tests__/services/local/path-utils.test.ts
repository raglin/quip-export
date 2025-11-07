import { PathUtils } from '../../../services/local/path-utils';

describe('PathUtils', () => {
  describe('sanitizeFileName', () => {
    it('should sanitize invalid characters', () => {
      const result = PathUtils.sanitizeFileName('test<>:|?*file.docx');
      
      expect(result.sanitized).toBe('test______file.docx');
      expect(result.changed).toBe(true);
      expect(result.originalUnsafeChars).toEqual(['<', '>', ':', '|', '?', '*']);
    });

    it('should handle Windows reserved names', () => {
      const result = PathUtils.sanitizeFileName('CON.txt');
      
      if (process.platform === 'win32') {
        expect(result.sanitized).toBe('_CON.txt');
        expect(result.changed).toBe(true);
      } else {
        expect(result.sanitized).toBe('CON.txt');
        expect(result.changed).toBe(false);
      }
    });

    it('should remove leading and trailing dots and spaces', () => {
      const result = PathUtils.sanitizeFileName('  ...test file...  ');
      
      expect(result.sanitized).toBe('test file');
      expect(result.changed).toBe(true);
    });

    it('should handle empty or whitespace-only names', () => {
      const result = PathUtils.sanitizeFileName('   ');
      
      expect(result.sanitized).toBe('untitled');
      expect(result.changed).toBe(true);
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.docx';
      const result = PathUtils.sanitizeFileName(longName);
      
      expect(result.sanitized.length).toBeLessThanOrEqual(255);
      expect(result.sanitized.endsWith('.docx')).toBe(true);
      expect(result.changed).toBe(true);
    });

    it('should not change valid filenames', () => {
      const result = PathUtils.sanitizeFileName('valid_file-name.docx');
      
      expect(result.sanitized).toBe('valid_file-name.docx');
      expect(result.changed).toBe(false);
      expect(result.originalUnsafeChars).toBeUndefined();
    });
  });

  describe('createSafeRelativePath', () => {
    it('should create safe relative paths from Quip folder paths', () => {
      const result = PathUtils.createSafeRelativePath('Private/Projects/Important');
      
      expect(result).toBe(`Private${require('path').sep}Projects${require('path').sep}Important`);
    });

    it('should handle root or empty paths', () => {
      expect(PathUtils.createSafeRelativePath('')).toBe('Root');
      expect(PathUtils.createSafeRelativePath('/')).toBe('Root');
      expect(PathUtils.createSafeRelativePath('//')).toBe('Root');
    });

    it('should sanitize unsafe characters in path segments', () => {
      const result = PathUtils.createSafeRelativePath('Private/Projects<>:|?*/Important');
      
      // Characters are replaced: < > : | ? * / → _ _ - _ _ _ -
      // After collapsing consecutive separators: Projects-
      expect(result).toBe(`Private${require('path').sep}Projects-${require('path').sep}Important`);
    });

    it('should handle multiple slashes', () => {
      const result = PathUtils.createSafeRelativePath('Private//Projects///Important');
      
      expect(result).toBe(`Private${require('path').sep}Projects${require('path').sep}Important`);
    });
  });

  describe('getFileExtension', () => {
    it('should return correct extension for spreadsheets', () => {
      const result = PathUtils.getFileExtension('SPREADSHEET', 'docx');
      
      expect(result).toBe('.xlsx');
    });

    it('should return correct extension for documents based on format', () => {
      expect(PathUtils.getFileExtension('DOCUMENT', 'docx')).toBe('.docx');
      expect(PathUtils.getFileExtension('DOCUMENT', 'html')).toBe('.html');
      expect(PathUtils.getFileExtension('CHAT', 'docx')).toBe('.docx');
    });

    it('should default to docx for unknown formats', () => {
      const result = PathUtils.getFileExtension('DOCUMENT', 'unknown' as any);
      
      expect(result).toBe('.docx');
    });
  });

  describe('createUniqueFileName', () => {
    it('should create numbered unique filename', () => {
      const result = PathUtils.createUniqueFileName('/tmp', 'test.docx', 'number');
      
      expect(result).toBe('test_1.docx');
    });

    it('should create timestamped unique filename', () => {
      const result = PathUtils.createUniqueFileName('/tmp', 'test.docx', 'timestamp');
      
      expect(result).toMatch(/^test_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.docx$/);
    });

    it('should preserve file extension', () => {
      const result = PathUtils.createUniqueFileName('/tmp', 'document.xlsx', 'number');
      
      expect(result).toBe('document_1.xlsx');
    });

    it('should handle files without extension', () => {
      const result = PathUtils.createUniqueFileName('/tmp', 'README', 'number');
      
      expect(result).toBe('README_1');
    });
  });

  describe('isValidPath', () => {
    it('should validate normal paths', () => {
      expect(PathUtils.isValidPath('/valid/path/file.txt')).toBe(true);
      expect(PathUtils.isValidPath('relative/path/file.txt')).toBe(true);
    });

    it('should reject paths with null bytes', () => {
      expect(PathUtils.isValidPath('invalid\0path')).toBe(false);
    });

    it('should reject extremely long paths', () => {
      const longPath = '/very/long/path/' + 'a'.repeat(5000) + '/file.txt';
      expect(PathUtils.isValidPath(longPath)).toBe(false);
    });
  });

  describe('ensurePathLength', () => {
    it('should return path unchanged if within limits', () => {
      const normalPath = '/normal/path/file.txt';
      const result = PathUtils.ensurePathLength(normalPath);
      
      expect(result).toBe(normalPath);
    });

    it('should truncate very long paths', () => {
      const longPath = '/very/long/path/' + 'a'.repeat(1000) + '.txt';
      const result = PathUtils.ensurePathLength(longPath);
      
      // On Unix systems with high limits, the path might not be truncated
      const maxLength = process.platform === 'win32' ? 260 : 4096;
      expect(result.length).toBeLessThanOrEqual(maxLength);
      expect(result.endsWith('.txt')).toBe(true);
    });

    it('should use hash for extremely long paths on Windows', () => {
      // Only test this on Windows or simulate Windows behavior
      if (process.platform === 'win32') {
        const extremelyLongPath = '/path/' + 'a'.repeat(5000) + '.txt';
        const result = PathUtils.ensurePathLength(extremelyLongPath);
        
        expect(result).toMatch(/file_[a-f0-9]{8}\.txt$/);
      } else {
        // On Unix systems, just verify the path is within limits
        const extremelyLongPath = '/path/' + 'a'.repeat(5000) + '.txt';
        const result = PathUtils.ensurePathLength(extremelyLongPath);
        
        expect(result.length).toBeLessThanOrEqual(4096);
      }
    });
  });

  describe('getFileExtensionForFormat', () => {
    it('should return correct extensions for all supported formats', () => {
      expect(PathUtils.getFileExtensionForFormat('docx')).toBe('.docx');
      expect(PathUtils.getFileExtensionForFormat('xlsx')).toBe('.xlsx');
      expect(PathUtils.getFileExtensionForFormat('html')).toBe('.html');
      expect(PathUtils.getFileExtensionForFormat('pdf')).toBe('.pdf');
      expect(PathUtils.getFileExtensionForFormat('markdown')).toBe('.md');
      expect(PathUtils.getFileExtensionForFormat('md')).toBe('.md');
    });

    it('should handle case insensitive format names', () => {
      expect(PathUtils.getFileExtensionForFormat('DOCX')).toBe('.docx');
      expect(PathUtils.getFileExtensionForFormat('PDF')).toBe('.pdf');
      expect(PathUtils.getFileExtensionForFormat('MARKDOWN')).toBe('.md');
    });

    it('should default to .txt for unknown formats', () => {
      expect(PathUtils.getFileExtensionForFormat('unknown')).toBe('.txt');
      expect(PathUtils.getFileExtensionForFormat('')).toBe('.txt');
    });

    it('should resolve native format for documents to .docx', () => {
      expect(PathUtils.getFileExtensionForFormat('native', 'DOCUMENT')).toBe('.docx');
      expect(PathUtils.getFileExtensionForFormat('native', 'document')).toBe('.docx');
    });

    it('should resolve native format for spreadsheets to .xlsx', () => {
      expect(PathUtils.getFileExtensionForFormat('native', 'SPREADSHEET')).toBe('.xlsx');
      expect(PathUtils.getFileExtensionForFormat('native', 'spreadsheet')).toBe('.xlsx');
    });

    it('should resolve native format for chat documents to .html', () => {
      expect(PathUtils.getFileExtensionForFormat('native', 'CHAT')).toBe('.html');
      expect(PathUtils.getFileExtensionForFormat('native', 'chat')).toBe('.html');
    });

    it('should fallback to .html for native format when document type is unknown', () => {
      expect(PathUtils.getFileExtensionForFormat('native', 'UNKNOWN')).toBe('.html');
      expect(PathUtils.getFileExtensionForFormat('native', 'invalid')).toBe('.html');
    });

    it('should fallback to .html for native format when document type is not provided', () => {
      expect(PathUtils.getFileExtensionForFormat('native')).toBe('.html');
      expect(PathUtils.getFileExtensionForFormat('native', undefined)).toBe('.html');
    });

    it('should handle native format case insensitively', () => {
      expect(PathUtils.getFileExtensionForFormat('NATIVE', 'DOCUMENT')).toBe('.docx');
      expect(PathUtils.getFileExtensionForFormat('Native', 'SPREADSHEET')).toBe('.xlsx');
    });
  });

  describe('sanitizeFileNameEnhanced', () => {
    it('should sanitize invalid characters with format context', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test<>:|?*file', 'pdf');
      
      // Colons become hyphens, other reserved chars become underscores, then consecutive separators collapse
      expect(result.sanitized).toBe('test-file.pdf');
      expect(result.changed).toBe(true);
      expect(result.originalUnsafeChars).toEqual(expect.arrayContaining(['<', '>', ':', '|', '?', '*']));
      expect(result.originalUnsafeChars?.length).toBe(6);
    });

    it('should handle multiple consecutive underscores', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test___multiple___underscores', 'markdown');
      
      expect(result.sanitized).toBe('test_multiple_underscores.md');
      expect(result.changed).toBe(true);
    });

    it('should remove trailing underscores before extension', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test_file_.docx', 'docx');
      
      expect(result.sanitized).toBe('test_file.docx');
      expect(result.changed).toBe(true);
    });

    it('should add format extension when missing', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('document', 'pdf');
      
      expect(result.sanitized).toBe('document.pdf');
      expect(result.changed).toBe(true);
    });

    it('should handle empty filename with format', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('', 'markdown');
      
      expect(result.sanitized).toBe('untitled.md');
      expect(result.changed).toBe(true);
    });

    it('should preserve existing correct extension', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('valid_file.pdf', 'pdf');
      
      expect(result.sanitized).toBe('valid_file.pdf');
      expect(result.changed).toBe(false);
    });

    it('should truncate long filenames while preserving extension', () => {
      const longName = 'a'.repeat(300);
      const result = PathUtils.sanitizeFileNameEnhanced(longName, 'docx');
      
      expect(result.sanitized.length).toBeLessThanOrEqual(255);
      expect(result.sanitized.endsWith('.docx')).toBe(true);
      expect(result.changed).toBe(true);
    });

    it('should handle native format with document type for documents', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test_document', 'native', 'DOCUMENT');
      
      expect(result.sanitized).toBe('test_document.docx');
      expect(result.changed).toBe(true);
    });

    it('should handle native format with document type for spreadsheets', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test_spreadsheet', 'native', 'SPREADSHEET');
      
      expect(result.sanitized).toBe('test_spreadsheet.xlsx');
      expect(result.changed).toBe(true);
    });

    it('should handle native format with document type for chat documents', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test_chat', 'native', 'CHAT');
      
      expect(result.sanitized).toBe('test_chat.html');
      expect(result.changed).toBe(true);
    });

    it('should fallback to .html for native format without document type', () => {
      const result = PathUtils.sanitizeFileNameEnhanced('test_file', 'native');
      
      expect(result.sanitized).toBe('test_file.html');
      expect(result.changed).toBe(true);
    });
  });

  describe('generateUniqueFileName', () => {
    it('should generate unique filename with correct format extension', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test', 'pdf', 'number');
      
      expect(result).toBe('test.pdf');
    });

    it('should correct wrong extension for format', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test.docx', 'markdown', 'number');
      
      expect(result).toBe('test.md');
    });

    it('should handle timestamp strategy with format', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test', 'pdf', 'timestamp');
      
      expect(result).toMatch(/^test_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.pdf$/);
    });

    it('should sanitize filename before processing', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test<>file', 'markdown', 'number');
      
      expect(result).toBe('test_file.md');
    });

    it('should handle files with multiple dots', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test.backup.old', 'pdf', 'number');
      
      expect(result).toBe('test.backup.old.pdf');
    });

    it('should handle native format with document type for documents', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test_document', 'native', 'number', 'DOCUMENT');
      
      expect(result).toBe('test_document.docx');
    });

    it('should handle native format with document type for spreadsheets', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test_spreadsheet', 'native', 'number', 'SPREADSHEET');
      
      expect(result).toBe('test_spreadsheet.xlsx');
    });

    it('should handle native format without document type (fallback to .html)', () => {
      const result = PathUtils.generateUniqueFileName('/tmp', 'test_file', 'native', 'number');
      
      expect(result).toBe('test_file.html');
    });
  });
});