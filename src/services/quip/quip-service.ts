import { AuthManager } from '../../auth/auth-manager';
import { QuipDocument, DocumentExport, Logger } from '../../types';
import { QuipAuthConfig } from '../../auth/types';
import { IQuipService } from './types';
import { QuipApiClient } from './api-client';
import { DocumentDiscovery, DocumentFilter, DocumentWithPath, DiscoveryResult } from './document-discovery';
import { DocumentExporter, ExportOptions, BatchExportResult } from './document-exporter';

/**
 * Main Quip service that integrates API client, document discovery, and export functionality
 */
export class QuipService implements IQuipService {
  private readonly apiClient: QuipApiClient;
  private readonly documentDiscovery: DocumentDiscovery;
  private readonly documentExporter: DocumentExporter;
  private readonly logger: Logger; // Used for logging in service methods

  constructor(authManager: AuthManager, logger: Logger, authConfig?: QuipAuthConfig, baseUrl?: string) {
    this.logger = logger;
    this.apiClient = new QuipApiClient(authManager, logger, authConfig, baseUrl);
    this.documentDiscovery = new DocumentDiscovery(this.apiClient, logger);
    this.documentExporter = new DocumentExporter(this.apiClient, logger);
    
    // Log service initialization
    const effectiveBaseUrl = authConfig?.baseUrl || baseUrl || 'https://platform.quip.com';
    this.logger.debug(`QuipService initialized with base URL: ${effectiveBaseUrl}`);
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<any> {
    const response = await this.apiClient.getCurrentUser();
    if (!response.success) {
      throw new Error(`Failed to get current user: ${response.error}`);
    }
    return response.data;
  }

  /**
   * List all accessible documents with optional filtering
   */
  async listDocuments(filter?: DocumentFilter): Promise<QuipDocument[]> {
    const discovery = await this.documentDiscovery.discoverDocuments(filter);
    return discovery.documents.map(d => d.document);
  }

  /**
   * Get detailed document discovery results with folder structure
   */
  async discoverDocuments(filter?: DocumentFilter): Promise<DiscoveryResult> {
    return this.documentDiscovery.discoverDocuments(filter);
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<QuipDocument> {
    const document = await this.documentDiscovery.getDocumentMetadata(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }
    return document;
  }

  /**
   * Export a single document
   */
  async exportDocument(documentId: string, format: 'docx' | 'html' = 'docx'): Promise<DocumentExport> {
    const document = await this.getDocument(documentId);
    
    // Map old format types to new format types
    let preferredFormat: 'native' | 'html' | 'markdown';
    switch (format) {
      case 'docx':
        preferredFormat = 'native';
        break;
      case 'html':
        preferredFormat = 'html';
        break;
      default:
        preferredFormat = 'native';
    }
    
    const exportOptions: ExportOptions = {
      preferredFormat,
      fallbackToHtml: true,
      includeMetadata: true
    };

    const result = await this.documentExporter.exportDocument(document, exportOptions);
    
    if (!result.success) {
      throw new Error(`Export failed: ${result.error}`);
    }

    const documentExport = this.documentExporter.createDocumentExport(result, 'Documents');
    if (!documentExport) {
      throw new Error('Failed to create document export');
    }

    return documentExport;
  }

  /**
   * Export multiple documents
   */
  async exportDocuments(
    documents: DocumentWithPath[],
    options?: ExportOptions,
    onProgress?: (current: number, total: number, currentDocument: string) => void
  ): Promise<BatchExportResult> {
    return this.documentExporter.exportDocuments(documents, options, onProgress);
  }

  /**
   * Get folder contents
   */
  async getFolderContents(folderId: string): Promise<any> {
    const response = await this.apiClient.getFolderContents(folderId);
    if (!response.success) {
      throw new Error(`Failed to get folder contents: ${response.error}`);
    }
    return response.data;
  }

  /**
   * Search for documents
   */
  async searchDocuments(query: string, filter?: DocumentFilter): Promise<DocumentWithPath[]> {
    return this.documentDiscovery.searchDocuments(query, filter);
  }

  /**
   * Get documents from a specific folder
   */
  async getDocumentsFromFolder(folderId: string, recursive: boolean = true): Promise<DocumentWithPath[]> {
    return this.documentDiscovery.getDocumentsFromFolder(folderId, recursive);
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    const response = await this.apiClient.testConnection();
    return response.success;
  }

  /**
   * Validate authentication token using domain-specific endpoint
   */
  async validateToken(): Promise<{ success: boolean; error?: string; userData?: any }> {
    const response = await this.apiClient.validateToken();
    
    if (response.success) {
      return {
        success: true,
        userData: response.data
      };
    } else {
      return {
        success: false,
        error: response.error
      };
    }
  }

  /**
   * Clear internal caches
   */
  clearCache(): void {
    this.documentDiscovery.clearCache();
  }

  /**
   * Get API client for advanced operations
   */
  getApiClient(): QuipApiClient {
    return this.apiClient;
  }

  /**
   * Get document discovery service for advanced operations
   */
  getDocumentDiscovery(): DocumentDiscovery {
    return this.documentDiscovery;
  }

  /**
   * Get document exporter for advanced operations
   */
  getDocumentExporter(): DocumentExporter {
    return this.documentExporter;
  }
}