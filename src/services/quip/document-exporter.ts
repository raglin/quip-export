import { QuipApiClient } from './api-client';
import { QuipDocument, DocumentExport, Logger } from '../../types';
import { DocumentWithPath } from './document-discovery';
import { FormatConverterRegistry } from './format-converters';
import { FormatValidator, FormatValidationResult } from '../../core/format-validator';

export interface ExportOptions {
  preferredFormat?: 'native' | 'html' | 'markdown';
  fallbackToHtml: boolean;
  includeMetadata: boolean;
  outputDirectory?: string;
  formatSpecificOptions?: {
    markdown?: MarkdownOptions;
  };
}

export interface MarkdownOptions {
  imageHandling: 'inline' | 'separate' | 'skip';
  preserveComments: boolean;
  frontMatter: boolean;
}

export interface ExportResult {
  success: boolean;
  documentId: string;
  title: string;
  format: string;
  filePath?: string;
  content?: Buffer;
  error?: string;
  metadata?: QuipDocument;
}

export interface BatchExportResult {
  successful: ExportResult[];
  failed: ExportResult[];
  totalProcessed: number;
  totalErrors: number;
}





/**
 * Document export service for downloading Quip documents in various formats
 */
export class DocumentExporter {
  private readonly apiClient: QuipApiClient;
  private readonly logger: Logger;
  private readonly formatConverters: FormatConverterRegistry;

  private readonly formatValidator: FormatValidator;

  constructor(apiClient: QuipApiClient, logger: Logger, formatConverters?: FormatConverterRegistry) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.formatConverters = formatConverters || new FormatConverterRegistry();
    this.formatValidator = new FormatValidator();
  }

  /**
   * Validate format selection and document type compatibility
   */
  async validateExportOptions(
    options: ExportOptions, 
    documentTypes?: string[]
  ): Promise<FormatValidationResult> {
    const format = options.preferredFormat || 'native';
    return await this.formatValidator.validateFormatSelection(
      [format],
      documentTypes
    );
  }

  /**
   * Get format capabilities for all supported formats
   */
  async getFormatCapabilities() {
    return await this.formatValidator.getFormatCapabilities();
  }

  /**
   * Check if a specific format is available
   */
  async isFormatAvailable(format: string): Promise<boolean> {
    const capabilities = await this.formatValidator.getFormatCapabilities();
    const capability = capabilities.find(c => c.format === format);
    return capability ? capability.available : false;
  }

  /**
   * Get dependency installation instructions for a format
   */
  getDependencyInstructions(format: string): string[] {
    return this.formatValidator.getDependencyInstructions(format);
  }



  /**
   * Export a single document
   */
  async exportDocument(
    document: QuipDocument, 
    options: ExportOptions = { preferredFormat: 'native', fallbackToHtml: true, includeMetadata: true }
  ): Promise<ExportResult> {
    const preferredFormat = options.preferredFormat || 'native';
    
    this.logger.info(`Exporting document: ${document.title} (${document.id}) in format: ${preferredFormat}`);

    try {
      // Validate format compatibility first
      const validation = await this.validateExportOptions(options, [document.type]);
      if (!validation.valid) {
        // Check if graceful degradation is possible
        const unavailableFormats = validation.capabilities
          .filter(cap => !cap.available)
          .map(cap => cap.format);
        
        const degradationOptions = this.formatValidator.getGracefulDegradationOptions(unavailableFormats);
        
        // If fallback is enabled and degradation options exist, try fallback
        if (options.fallbackToHtml && degradationOptions[preferredFormat]?.includes('html')) {
          this.logger.warn(`Format ${preferredFormat} not available for ${document.title}, attempting graceful degradation to HTML`);
          // Continue with HTML export
        } else {
          return {
            success: false,
            documentId: document.id,
            title: document.title,
            format: preferredFormat,
            error: validation.errors.join('; ')
          };
        }
      }

      // Determine the best export format based on document type and preferences
      const exportFormat = this.determineExportFormat(document, preferredFormat);
      
      // Attempt to export in the determined format
      let exportResult = await this.exportInFormat(document, exportFormat, options.formatSpecificOptions);

      // If export failed and fallback is enabled, try fallback format
      if (!exportResult.success && options.fallbackToHtml && exportFormat !== 'html') {
        // Use HTML as fallback
        const fallbackFormat: 'docx' | 'html' | 'xlsx' | 'markdown' = 'html';
        this.logger.warn(`${exportFormat.toUpperCase()} export failed for ${document.title}, falling back to ${fallbackFormat.toUpperCase()}`);
        exportResult = await this.exportInFormat(document, fallbackFormat);
      }

      if (exportResult.success) {
        this.logger.info(`Successfully exported ${document.title} as ${exportResult.format.toUpperCase()}`);
        
        return {
          success: true,
          documentId: document.id,
          title: document.title,
          format: exportResult.format, // Return actual format used
          content: exportResult.content,
          metadata: options.includeMetadata ? document : undefined
        };
      } else {
        this.logger.error(`Failed to export ${document.title}: ${exportResult.error}`);
        
        return {
          success: false,
          documentId: document.id,
          title: document.title,
          format: exportFormat, // Return attempted format
          error: exportResult.error
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Export error for ${document.title}`, { error: errorMessage });
      
      return {
        success: false,
        documentId: document.id,
        title: document.title,
        format: preferredFormat || 'unknown',
        error: errorMessage
      };
    }
  }

  /**
   * Export multiple documents in batch
   */
  async exportDocuments(
    documents: DocumentWithPath[],
    options: ExportOptions = { preferredFormat: 'native', fallbackToHtml: true, includeMetadata: true },
    onProgress?: (current: number, total: number, currentDocument: string) => void
  ): Promise<BatchExportResult> {
    this.logger.info(`Starting batch export of ${documents.length} documents`);

    const successful: ExportResult[] = [];
    const failed: ExportResult[] = [];
    let processed = 0;

    for (const { document, folderPath } of documents) {
      try {
        if (onProgress) {
          onProgress(processed, documents.length, document.title);
        }

        const result = await this.exportDocument(document, options);
        
        if (result.success) {
          // Add folder path information to successful exports
          successful.push({
            ...result,
            metadata: result.metadata ? {
              ...result.metadata,
              // Store folder path in a custom property for later use
              folderPath
            } as any : undefined
          });
        } else {
          failed.push(result);
        }

        processed++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Batch export error for ${document.title}`, { error: errorMessage });
        
        failed.push({
          success: false,
          documentId: document.id,
          title: document.title,
          format: options.preferredFormat || 'unknown',
          error: errorMessage
        });
        
        processed++;
      }

      // Add small delay between exports to be respectful to the API
      await this.sleep(100);
    }

    const result: BatchExportResult = {
      successful,
      failed,
      totalProcessed: processed,
      totalErrors: failed.length
    };

    this.logger.info(`Batch export complete: ${successful.length} successful, ${failed.length} failed`);
    return result;
  }



  /**
   * Create DocumentExport object from export result
   */
  createDocumentExport(result: ExportResult, folderPath: string): DocumentExport | null {
    if (!result.success || !result.content || !result.metadata) {
      return null;
    }

    return {
      documentId: result.documentId,
      title: result.title,
      format: result.format,
      content: result.content,
      metadata: result.metadata,
      folderPath
    };
  }

  /**
   * Determine the best export format for a document
   */
  private determineExportFormat(document: QuipDocument, preferredFormat: string): 'docx' | 'html' | 'xlsx' | 'markdown' {
    switch (document.type) {
      case 'DOCUMENT':
        // Documents support DOCX, HTML, and Markdown
        if (['docx', 'html', 'markdown'].includes(preferredFormat)) {
          return preferredFormat as 'docx' | 'html' | 'markdown';
        }
        return 'docx'; // Default for documents
      
      case 'SPREADSHEET':
        // Spreadsheets support XLSX and HTML
        if (preferredFormat === 'xlsx' || preferredFormat === 'html') {
          return preferredFormat as 'xlsx' | 'html';
        }
        return 'xlsx'; // Default for spreadsheets
      
      case 'CHAT':
        // Chat documents only support HTML and Markdown
        if (preferredFormat === 'markdown') {
          return 'markdown';
        }

        return 'html';
      
      default:
        return 'html';
    }
  }

  /**
   * Determine the native export format for a document type
   */
  private determineNativeFormat(documentType: string): 'docx' | 'html' | 'xlsx' | 'markdown' {
    switch (documentType.toUpperCase()) {
      case 'DOCUMENT':
        return 'docx';
      case 'SPREADSHEET':
        return 'xlsx';
      default:
        return 'html';
    }
  }

  /**
   * Export document in specific format
   */
  private async exportInFormat(
    document: QuipDocument, 
    format: 'docx' | 'html' | 'xlsx' | 'markdown',
    formatOptions?: { markdown?: MarkdownOptions }
  ): Promise<{ success: boolean; format: string; content?: Buffer; error?: string }> {
    try {
      switch (format) {
        case 'docx':
          return await this.exportAsDocx(document);
        
        case 'xlsx':
          return await this.exportAsXlsx(document);
        
        case 'html':
          return await this.exportAsHtml(document);
        

        
        case 'markdown':
          return await this.exportAsMarkdown(document, formatOptions?.markdown);
        
        default:
          return {
            success: false,
            format,
            error: `Unsupported export format: ${format}`
          };
      }
    } catch (error) {
      return {
        success: false,
        format,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Export document as DOCX
   */
  private async exportAsDocx(document: QuipDocument): Promise<{ success: boolean; format: string; content?: Buffer; error?: string }> {
    if (document.type !== 'DOCUMENT') {
      return {
        success: false,
        format: 'docx',
        error: `DOCX export not supported for document type: ${document.type}`
      };
    }

    const response = await this.apiClient.exportDocumentDocx(document.id);
    
    if (response.success && response.data) {
      return {
        success: true,
        format: 'docx',
        content: response.data
      };
    }

    return {
      success: false,
      format: 'docx',
      error: response.error || 'DOCX export failed'
    };
  }

  /**
   * Export document as XLSX
   */
  private async exportAsXlsx(document: QuipDocument): Promise<{ success: boolean; format: string; content?: Buffer; error?: string }> {
    if (document.type !== 'SPREADSHEET') {
      return {
        success: false,
        format: 'xlsx',
        error: `XLSX export not supported for document type: ${document.type}`
      };
    }

    const response = await this.apiClient.exportSpreadsheetXlsx(document.id);
    
    if (response.success && response.data) {
      return {
        success: true,
        format: 'xlsx',
        content: response.data
      };
    }

    return {
      success: false,
      format: 'xlsx',
      error: response.error || 'XLSX export failed'
    };
  }

  /**
   * Export document as HTML
   */
  private async exportAsHtml(document: QuipDocument): Promise<{ success: boolean; format: string; content?: Buffer; error?: string }> {
    // Use secret_path for HTML export as it works with V2 API
    const identifier = document.secret_path || document.id;
    const response = await this.apiClient.exportDocumentHtml(identifier);
    
    if (response.success && response.data) {
      return {
        success: true,
        format: 'html',
        content: Buffer.from(response.data, 'utf-8')
      };
    }

    return {
      success: false,
      format: 'html',
      error: response.error || 'HTML export failed'
    };
  }



  /**
   * Export document as Markdown (converted from HTML)
   */
  private async exportAsMarkdown(document: QuipDocument, options?: MarkdownOptions): Promise<{ success: boolean; format: string; content?: Buffer; error?: string }> {
    // First get HTML content
    const htmlResult = await this.exportAsHtml(document);
    
    if (!htmlResult.success || !htmlResult.content) {
      return {
        success: false,
        format: 'markdown',
        error: `Failed to get HTML for markdown conversion: ${htmlResult.error}`
      };
    }

    // Use format converter to convert HTML to Markdown
    try {
      const conversionResult = await this.formatConverters.convert(
        document.type,
        'markdown',
        htmlResult.content.toString('utf-8'),
        options
      );

      if (conversionResult.success && conversionResult.content) {
        return {
          success: true,
          format: 'markdown',
          content: conversionResult.content
        };
      } else {
        return {
          success: false,
          format: 'markdown',
          error: conversionResult.error || 'Markdown conversion failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        format: 'markdown',
        error: error instanceof Error ? error.message : 'Markdown conversion error'
      };
    }
  }

  /**
   * Get file extension for export format
   */
  getFileExtension(format: string, documentType?: string): string {
    switch (format.toLowerCase()) {
      case 'native':
        // For native format, determine extension based on document type
        if (documentType) {
          const nativeFormat = this.determineNativeFormat(documentType);
          return this.getFileExtension(nativeFormat);
        }
        return '.txt'; // Fallback if no document type provided
      case 'docx':
        return '.docx';
      case 'xlsx':
        return '.xlsx';
      case 'html':
        return '.html';

      case 'markdown':
        return '.md';
      default:
        return '.txt';
    }
  }

  /**
   * Get MIME type for export format
   */
  getMimeType(format: string, documentType?: string): string {
    switch (format.toLowerCase()) {
      case 'native':
        // For native format, determine MIME type based on document type
        if (documentType) {
          const nativeFormat = this.determineNativeFormat(documentType);
          return this.getMimeType(nativeFormat);
        }
        return 'text/plain'; // Fallback if no document type provided
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'html':
        return 'text/html';

      case 'markdown':
        return 'text/markdown';
      default:
        return 'text/plain';
    }
  }

  /**
   * Sanitize filename for file system
   */
  sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters for file systems
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Generate filename for exported document
   */
  generateFilename(document: QuipDocument, format: string): string {
    const sanitizedTitle = this.sanitizeFilename(document.title);
    const extension = this.getFileExtension(format, document.type);
    return `${sanitizedTitle}${extension}`;
  }

  /**
   * Validate export format for document type
   */
  isValidExportFormat(documentType: string, format: string): boolean {
    switch (documentType.toUpperCase()) {
      case 'DOCUMENT':
        return ['native', 'html', 'markdown'].includes(format.toLowerCase());
      case 'SPREADSHEET':
        return ['native', 'html'].includes(format.toLowerCase());
      case 'CHAT':
        return ['native', 'html', 'markdown'].includes(format.toLowerCase());
      default:
        return ['html'].includes(format.toLowerCase());
    }
  }



  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}