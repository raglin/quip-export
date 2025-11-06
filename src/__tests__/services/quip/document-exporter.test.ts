import { DocumentExporter } from '../../../services/quip/document-exporter';
import { QuipApiClient } from '../../../services/quip/api-client';
import { ConsoleLogger } from '../../../core/logger';
import { QuipDocument } from '../../../types';

import { FormatValidator } from '../../../core/format-validator';

// Mock the API client
jest.mock('../../../services/quip/api-client');

describe('DocumentExporter', () => {
  let documentExporter: DocumentExporter;
  let mockApiClient: jest.Mocked<QuipApiClient>;
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
    
    mockApiClient = {
      exportDocumentDocx: jest.fn(),
      exportDocumentHtml: jest.fn(),
      exportSpreadsheetXlsx: jest.fn(),

    } as any;

    logger = new ConsoleLogger('ERROR'); // Suppress logs during tests
    documentExporter = new DocumentExporter(mockApiClient, logger);
  });

  describe('Format Determination', () => {
    it('should choose DOCX for DOCUMENT type', async () => {
      // Requirement 3.2: System SHALL preserve original format when possible
      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: true,
        data: Buffer.from('docx content'),
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'native',
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('docx');
      expect(mockApiClient.exportDocumentDocx).toHaveBeenCalledWith('doc-123');
    });

    it('should choose XLSX for SPREADSHEET type', async () => {
      // Requirement 3.2: System SHALL preserve original format when possible
      const spreadsheetDoc = { ...mockDocument, type: 'SPREADSHEET' as const };
      
      mockApiClient.exportSpreadsheetXlsx.mockResolvedValue({
        success: true,
        data: Buffer.from('xlsx content'),
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(spreadsheetDoc, {
        preferredFormat: 'native', // Should be overridden for spreadsheets
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('xlsx');
      expect(mockApiClient.exportSpreadsheetXlsx).toHaveBeenCalledWith('doc-123');
    });

    it('should choose HTML for CHAT type', async () => {
      // Requirement 3.2: System SHALL preserve original format when possible
      const chatDoc = { ...mockDocument, type: 'CHAT' as const };
      
      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: true,
        data: '<html>chat content</html>',
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(chatDoc, {
        preferredFormat: 'native', // Should be overridden for chat
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(mockApiClient.exportDocumentHtml).toHaveBeenCalledWith('secret-path-123');
    });

    it('should choose native format (DOCX) for DOCUMENT type when requested', async () => {
      // Requirement 2.1: System SHALL use native format for optimal compatibility
      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: true,
        data: Buffer.from('DOCX content'),
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'native',
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('docx'); // Should return actual format used
      expect(mockApiClient.exportDocumentDocx).toHaveBeenCalledWith('doc-123');
    });

    it('should choose native format (XLSX) for SPREADSHEET type when requested', async () => {
      // Requirement 2.4: System SHALL handle both documents and spreadsheets using Quip's API
      const spreadsheetDoc = { ...mockDocument, type: 'SPREADSHEET' as const };
      
      mockApiClient.exportSpreadsheetXlsx.mockResolvedValue({
        success: true,
        data: Buffer.from('XLSX spreadsheet content'),
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(spreadsheetDoc, {
        preferredFormat: 'native',
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('xlsx'); // Should return actual format used
      expect(mockApiClient.exportSpreadsheetXlsx).toHaveBeenCalledWith('doc-123');
    });

    it('should use HTML for CHAT type when native format requested', async () => {
      // Requirement 2.5: System SHALL handle CHAT documents appropriately
      const chatDoc = { ...mockDocument, type: 'CHAT' as const };
      
      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: true,
        data: '<html>HTML chat content</html>',
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(chatDoc, {
        preferredFormat: 'native',
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html'); // Should return actual format used
      expect(mockApiClient.exportDocumentHtml).toHaveBeenCalledWith('secret-path-123');
    });
  });

  describe('Fallback Mechanism', () => {
    it('should fallback to HTML when DOCX export fails', async () => {
      // Requirement 3.4: IF document export fails THEN system SHALL log error and continue
      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: false,
        error: 'DOCX export failed',
        statusCode: 500,
      });

      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: true,
        data: '<html>fallback content</html>',
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(mockApiClient.exportDocumentDocx).toHaveBeenCalled();
      expect(mockApiClient.exportDocumentHtml).toHaveBeenCalled();
    });

    it('should not fallback when fallbackToHtml is false', async () => {
      // Requirement 3.4: IF document export fails THEN system SHALL log error and continue
      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: false,
        error: 'DOCX export failed',
        statusCode: 500,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'native',
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DOCX export failed');
      expect(mockApiClient.exportDocumentDocx).toHaveBeenCalled();
      expect(mockApiClient.exportDocumentHtml).not.toHaveBeenCalled();
    });
  });

  describe('Batch Export', () => {
    it('should export multiple documents successfully', async () => {
      // Requirement 3.1: System SHALL download each document from Quip
      const documents = [
        { document: mockDocument, folderPath: 'Folder1', isShared: false },
        { document: { ...mockDocument, id: 'doc-456', title: 'Doc 2' }, folderPath: 'Folder2', isShared: true },
      ];

      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: true,
        data: Buffer.from('docx content'),
        statusCode: 200,
      });

      const progressCallback = jest.fn();
      const result = await documentExporter.exportDocuments(documents, {
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true,
      }, progressCallback);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);
      expect(result.totalErrors).toBe(0);
      expect(progressCallback).toHaveBeenCalledTimes(2);
    });

    it('should continue processing when individual exports fail', async () => {
      // Requirement 3.4: IF document export fails THEN system SHALL log error and continue
      const documents = [
        { document: mockDocument, folderPath: 'Folder1', isShared: false },
        { document: { ...mockDocument, id: 'doc-456', title: 'Doc 2' }, folderPath: 'Folder2', isShared: true },
        { document: { ...mockDocument, id: 'doc-789', title: 'Doc 3' }, folderPath: 'Folder3', isShared: false },
      ];

      mockApiClient.exportDocumentDocx
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('docx content 1'),
          statusCode: 200,
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Export failed for doc 2',
          statusCode: 500,
        })
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('docx content 3'),
          statusCode: 200,
        });

      // HTML fallback fails for the middle document
      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: false,
        error: 'HTML export also failed',
        statusCode: 500,
      });

      const result = await documentExporter.exportDocuments(documents, {
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true,
      });

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.totalProcessed).toBe(3);
      expect(result.totalErrors).toBe(1);
      expect(result.failed[0].documentId).toBe('doc-456');
    });
  });

  describe('File Utilities', () => {
    it('should generate correct file extensions', () => {
      expect(documentExporter.getFileExtension('native', 'DOCUMENT')).toBe('.docx');
      expect(documentExporter.getFileExtension('native', 'SPREADSHEET')).toBe('.xlsx');
      expect(documentExporter.getFileExtension('html')).toBe('.html');
      expect(documentExporter.getFileExtension('markdown')).toBe('.md');
    });

    it('should generate correct MIME types', () => {
      expect(documentExporter.getMimeType('native', 'DOCUMENT')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(documentExporter.getMimeType('native', 'SPREADSHEET')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(documentExporter.getMimeType('html')).toBe('text/html');
      expect(documentExporter.getMimeType('markdown')).toBe('text/markdown');
    });

    it('should sanitize filenames', () => {
      expect(documentExporter.sanitizeFilename('Test<>Document')).toBe('Test__Document');
      expect(documentExporter.sanitizeFilename('File/With\\Invalid:Characters')).toBe('File_With_Invalid_Characters');
      expect(documentExporter.sanitizeFilename('  Spaced  Document  ')).toBe('Spaced Document');
    });

    it('should generate proper filenames', () => {
      const filename = documentExporter.generateFilename(mockDocument, 'native');
      expect(filename).toBe('Test Document.docx');
    });

    it('should validate export formats for document types', () => {
      // DOCUMENT type supports native, html, and markdown
      expect(documentExporter.isValidExportFormat('DOCUMENT', 'native')).toBe(true);
      expect(documentExporter.isValidExportFormat('DOCUMENT', 'html')).toBe(true);
      expect(documentExporter.isValidExportFormat('DOCUMENT', 'markdown')).toBe(true);
      expect(documentExporter.isValidExportFormat('DOCUMENT', 'invalid')).toBe(false);
      
      // SPREADSHEET type supports native and html
      expect(documentExporter.isValidExportFormat('SPREADSHEET', 'native')).toBe(true);
      expect(documentExporter.isValidExportFormat('SPREADSHEET', 'html')).toBe(true);
      expect(documentExporter.isValidExportFormat('SPREADSHEET', 'markdown')).toBe(false);
      expect(documentExporter.isValidExportFormat('SPREADSHEET', 'invalid')).toBe(false);
      
      // CHAT type supports html and markdown (native format is HTML for CHAT)
      expect(documentExporter.isValidExportFormat('CHAT', 'html')).toBe(true);
      expect(documentExporter.isValidExportFormat('CHAT', 'markdown')).toBe(true);
      expect(documentExporter.isValidExportFormat('CHAT', 'native')).toBe(true); // Native for CHAT is HTML
      expect(documentExporter.isValidExportFormat('CHAT', 'invalid')).toBe(false);
    });
  });

  describe('Export Error Handling', () => {
    it('should handle native export API failures', async () => {
      // Requirement 2.3: System SHALL add proper error messages for unsupported document types
      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: false,
        error: 'DOCX generation failed on server',
        statusCode: 500,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'native',
        fallbackToHtml: false,
        includeMetadata: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DOCX generation failed on server');
      expect(result.format).toBe('docx');
    });

    it('should fallback to HTML when native export fails', async () => {
      // Requirement 2.5: System SHALL provide clear error messages and fallback options
      mockApiClient.exportDocumentDocx.mockResolvedValue({
        success: false,
        error: 'DOCX export failed',
        statusCode: 500,
      });

      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: true,
        data: '<html>fallback content</html>',
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(mockApiClient.exportDocumentDocx).toHaveBeenCalled();
      expect(mockApiClient.exportDocumentHtml).toHaveBeenCalled();
    });

    it('should handle native export for CHAT document types', async () => {
      // Requirement 2.5: System SHALL provide clear error messages for unsupported document types
      const chatDoc = { ...mockDocument, type: 'CHAT' as const };

      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: true,
        data: '<html>chat content</html>',
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(chatDoc, {
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true,
      });

      // Should use HTML since native format for CHAT is HTML
      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(mockApiClient.exportDocumentHtml).toHaveBeenCalled();
    });
  });

  describe('DocumentExport Creation', () => {
    it('should create DocumentExport from successful result', () => {
      // Requirement 3.5: System SHALL maintain original folder structure
      const exportResult = {
        success: true,
        documentId: 'doc-123',
        title: 'Test Document',
        format: 'native',
        content: Buffer.from('test content'),
        metadata: mockDocument,
      };

      const documentExport = documentExporter.createDocumentExport(exportResult, 'Test Folder');

      expect(documentExport).not.toBeNull();
      expect(documentExport!.documentId).toBe('doc-123');
      expect(documentExport!.title).toBe('Test Document');
      expect(documentExport!.format).toBe('native');
      expect(documentExport!.folderPath).toBe('Test Folder');
      expect(documentExport!.content).toEqual(Buffer.from('test content'));
      expect(documentExport!.metadata).toEqual(mockDocument);
    });

    it('should return null for failed export result', () => {
      const exportResult = {
        success: false,
        documentId: 'doc-123',
        title: 'Test Document',
        format: 'native',
        error: 'Export failed',
      };

      const documentExport = documentExporter.createDocumentExport(exportResult, 'Test Folder');

      expect(documentExport).toBeNull();
    });
  });

  // Multi-format export functionality has been removed - only single format exports are supported

  describe('Format Validation and Dependency Management', () => {
    it('should validate export options and provide format capabilities', async () => {
      // Requirement 6.3: System SHALL validate format-specific options
      const validation = await documentExporter.validateExportOptions({
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true
      }, ['DOCUMENT']);

      expect(validation.valid).toBe(true);
      expect(validation.capabilities).toHaveLength(3); // All supported formats
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect format-document type incompatibilities', async () => {
      // Requirement 6.4: System SHALL validate format selections against document types
      // Test with markdown format for SPREADSHEET type (not supported)
      const validation = await documentExporter.validateExportOptions({
        preferredFormat: 'markdown', // Markdown format not compatible with SPREADSHEET
        fallbackToHtml: true,
        includeMetadata: true
      }, ['SPREADSHEET']);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => 
        error.includes('not compatible with document type \'SPREADSHEET\'')
      )).toBe(true);
    });

    it('should provide warnings for suboptimal format choices', async () => {
      // Requirement 6.4: System SHALL provide warnings for suboptimal format choices
      const validation = await documentExporter.validateExportOptions({
        preferredFormat: 'html', // HTML is supported but not recommended for DOCUMENT
        fallbackToHtml: true,
        includeMetadata: true
      }, ['DOCUMENT']);

      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(warning => 
        warning.includes('HTML export may not preserve all formatting')
      )).toBe(true);
    });

    it('should check format availability and dependencies', async () => {
      const capabilities = await documentExporter.getFormatCapabilities();
      
      expect(capabilities).toHaveLength(3);
      
      // Native formats should be available
      const nativeFormats = ['native', 'html', 'native', 'native'];
      for (const format of nativeFormats) {
        const capability = capabilities.find(c => c.format === format);
        expect(capability?.available).toBe(true);
      }
      
      // Markdown may or may not be available depending on dependencies
      const markdownCapability = capabilities.find(c => c.format === 'markdown');
      expect(markdownCapability).toBeDefined();
      expect(markdownCapability?.dependencies.length).toBeGreaterThan(0);
    });

    it('should provide dependency installation instructions', () => {
      const instructions = documentExporter.getDependencyInstructions('markdown');
      
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0]).toContain('npm install');
    });

    it('should handle graceful degradation when formats are unavailable', async () => {
      // Mock format validation to simulate unavailable markdown
      const mockValidator = new FormatValidator();
      jest.spyOn(mockValidator, 'validateFormatSelection').mockResolvedValue({
        valid: false,
        capabilities: [{
          format: 'markdown',
          available: false,
          dependencies: [{ name: 'turndown', required: true, available: false }],
          documentTypes: ['DOCUMENT'],
          error: 'Missing dependencies'
        }],
        errors: ['Format \'markdown\' is not available: Missing dependencies'],
        warnings: []
      });

      jest.spyOn(mockValidator, 'getGracefulDegradationOptions').mockReturnValue({
        'markdown': ['html']
      });

      // Replace the validator in the exporter
      (documentExporter as any).formatValidator = mockValidator;

      // Setup HTML export mock
      mockApiClient.exportDocumentHtml.mockResolvedValue({
        success: true,
        data: '<html>fallback content</html>',
        statusCode: 200,
      });

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'markdown',
        fallbackToHtml: true,
        includeMetadata: true
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html'); // Fell back to HTML
    });

    it('should fail validation when no formats are available', async () => {
      // Mock all formats as unavailable
      const mockValidator = new FormatValidator();
      jest.spyOn(mockValidator, 'validateFormatSelection').mockResolvedValue({
        valid: false,
        capabilities: [{
          format: 'markdown',
          available: false,
          dependencies: [{ name: 'turndown', required: true, available: false }],
          documentTypes: ['DOCUMENT'],
          error: 'Missing dependencies'
        }],
        errors: ['No selected formats are currently available'],
        warnings: []
      });

      jest.spyOn(mockValidator, 'getGracefulDegradationOptions').mockReturnValue({});

      // Replace the validator in the exporter
      (documentExporter as any).formatValidator = mockValidator;

      const result = await documentExporter.exportDocument(mockDocument, {
        preferredFormat: 'markdown',
        fallbackToHtml: false, // No fallback
        includeMetadata: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No selected formats are currently available');
    });

    it('should validate format compatibility for different document types', async () => {
      // Test SPREADSHEET compatibility
      const spreadsheetValidation = await documentExporter.validateExportOptions({
        preferredFormat: 'native',
        fallbackToHtml: true,
        includeMetadata: true
      }, ['SPREADSHEET']);

      expect(spreadsheetValidation.valid).toBe(true);

      // Test CHAT compatibility (only test HTML since markdown may not be available)
      const chatValidation = await documentExporter.validateExportOptions({
        preferredFormat: 'html',
        fallbackToHtml: true,
        includeMetadata: true
      }, ['CHAT']);

      expect(chatValidation.valid).toBe(true);

      // Test CHAT with native format (should be valid since native for CHAT is HTML)
      const chatNativeValidation = await documentExporter.validateExportOptions({
        preferredFormat: 'native', // Supported for CHAT (native = HTML for CHAT)
        fallbackToHtml: true,
        includeMetadata: true
      }, ['CHAT']);

      expect(chatNativeValidation.valid).toBe(true);
    });

    it('should handle mixed document types validation', async () => {
      // Test validation with multiple document types
      const validation = await documentExporter.validateExportOptions({
        preferredFormat: 'html', // HTML works for all types
        fallbackToHtml: true,
        includeMetadata: true
      }, ['DOCUMENT', 'SPREADSHEET', 'CHAT']);

      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0); // Should have warnings for each type
    });

    it('should check individual format availability', async () => {
      const docxAvailable = await documentExporter.isFormatAvailable('native');
      expect(docxAvailable).toBe(true);

      const htmlAvailable = await documentExporter.isFormatAvailable('html');
      expect(htmlAvailable).toBe(true);

      const nativeAvailable = await documentExporter.isFormatAvailable('native');
      expect(nativeAvailable).toBe(true);

      // Markdown availability depends on dependencies
      const markdownAvailable = await documentExporter.isFormatAvailable('markdown');
      expect(typeof markdownAvailable).toBe('boolean');
    });
  });
});