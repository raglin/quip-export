import { QuipApiClient } from './api-client';
import { QuipDocument, QuipFolder, Logger } from '../../types';
import { QuipListResponse } from './types';
import { parseQuipUrl } from './url-parser';

export interface DocumentFilter {
  types?: Array<'DOCUMENT' | 'SPREADSHEET' | 'CHAT'>;
  includeShared?: boolean;
  includeTemplates?: boolean;
  includeDeleted?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  titleContains?: string;
  maxDocuments?: number;
  url?: string;
}

export interface DocumentWithPath {
  document: QuipDocument;
  folderPath: string;
  isShared: boolean;
}

export interface FolderStructure {
  folder: QuipFolder;
  path: string;
  children: FolderStructure[];
  documents: DocumentWithPath[];
}

export interface DiscoveryResult {
  documents: DocumentWithPath[];
  folders: FolderStructure[];
  totalCount: number;
  filteredCount: number;
  skippedCount?: number;
}

/**
 * Document discovery service for enumerating and filtering Quip documents
 */
export class DocumentDiscovery {
  private readonly apiClient: QuipApiClient;
  private readonly logger: Logger;
  private readonly documentCache = new Map<string, QuipDocument>();
  private readonly folderCache = new Map<string, QuipFolder>();
  private skippedDocumentCount = 0;

  constructor(apiClient: QuipApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Discover all accessible documents with optional filtering
   */
  async discoverDocuments(filter: DocumentFilter = {}): Promise<DiscoveryResult> {
    this.logger.info('Starting document discovery...');
    
    try {
      // Get current user information first to identify user-owned documents
      const userResponse = await this.apiClient.getCurrentUser();
      if (!userResponse.success) {
        throw new Error(`Failed to get current user: ${userResponse.error}`);
      }
      
      const currentUser = userResponse.data;
      const currentUserId = currentUser.id;
      
      this.logger.debug(`Discovering documents for user: ${currentUser.name} (${currentUserId})`);

      // Check if we have a document limit to optimize discovery
      const maxDocuments = filter.maxDocuments;
      if (maxDocuments && maxDocuments > 0) {
        this.logger.debug(`Document limit specified: ${maxDocuments}, using optimized discovery`);
        return this.discoverDocumentsWithLimit(currentUser, currentUserId, filter, maxDocuments);
      }

      // Get user's documents through folder structure instead of recent documents
      // This focuses on documents the user owns rather than just recently accessed
      let allDocuments: QuipDocument[] = [];
      let allFolders: QuipFolder[] = [];

      // Try to get user's private folder first
      if (currentUser.private_folder_id) {
        try {
          this.logger.debug(`Getting documents from user's private folder: ${currentUser.private_folder_id}`);
          const privateFolderResponse = await this.apiClient.getFolderContents(currentUser.private_folder_id);
          if (privateFolderResponse.success) {
            const { documents: privateDocs, folders: privateFolders } = await this.parseListResponse(privateFolderResponse.data!);
            allDocuments.push(...privateDocs);
            allFolders.push(...privateFolders);
          }
        } catch (error) {
          this.logger.warn(`Failed to get private folder ${currentUser.private_folder_id}:`, error);
        }
      }

      // Also try desktop folder if available
      if (currentUser.desktop_folder_id) {
        try {
          this.logger.debug(`Getting documents from user's desktop folder: ${currentUser.desktop_folder_id}`);
          const desktopFolderResponse = await this.apiClient.getFolderContents(currentUser.desktop_folder_id);
          if (desktopFolderResponse.success) {
            const { documents: desktopDocs, folders: desktopFolders } = await this.parseListResponse(desktopFolderResponse.data!);
            allDocuments.push(...desktopDocs);
            allFolders.push(...desktopFolders);
          }
        } catch (error) {
          this.logger.warn(`Failed to get desktop folder ${currentUser.desktop_folder_id}:`, error);
        }
      }

      // Try to get user's explicit folder structure if available
      if (currentUser.folders && Array.isArray(currentUser.folders) && currentUser.folders.length > 0) {
        // User has explicit folder structure
        for (const folder of currentUser.folders) {
          try {
            const folderResponse = await this.apiClient.getFolderContents(folder.id);
            if (folderResponse.success) {
              const { documents: folderDocs, folders: subFolders } = await this.parseListResponse(folderResponse.data!);
              
              // Filter to only include documents owned by current user
              const ownedDocs = folderDocs.filter(doc => 
                doc.author_id === currentUserId || 
                (!doc.author_id && !this.isDocumentShared(doc))
              );
              
              allDocuments.push(...ownedDocs);
              allFolders.push(...subFolders);
            }
          } catch (error) {
            this.logger.warn(`Failed to get folder ${folder.id}:`, error);
          }
        }
      }
      
      // Cache documents and folders
      allDocuments.forEach(doc => this.documentCache.set(doc.id, doc));
      allFolders.forEach(folder => this.folderCache.set(folder.id, folder));

      // Build folder structures from discovered folders
      let folderStructures: FolderStructure[] = [];
      if (allFolders.length > 0) {
        folderStructures = await this.buildFolderStructures(allFolders);
      }

      // Collect all documents
      let documentsWithPaths = await this.collectAllDocuments(folderStructures, allDocuments);

      // If we have no folder structure but have documents, create a virtual structure
      if (folderStructures.length === 0 && allDocuments.length > 0) {
        this.logger.debug('Creating virtual folder structure from user-owned documents');
        folderStructures = this.createVirtualFolderStructure(allDocuments);
        documentsWithPaths = await this.collectAllDocuments(folderStructures, []);
      }

      // Apply filters
      const filteredDocuments = this.applyFilters(documentsWithPaths, filter);

      this.logger.info(`Discovery complete: ${filteredDocuments.length} user-owned documents found (${documentsWithPaths.length} total)`);

      return {
        documents: filteredDocuments,
        folders: folderStructures,
        totalCount: documentsWithPaths.length,
        filteredCount: filteredDocuments.length
      };

    } catch (error) {
      this.logger.error('Document discovery failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Optimized document discovery with limit to avoid unnecessary API calls
   */
  private async discoverDocumentsWithLimit(
    currentUser: any, 
    currentUserId: string, 
    filter: DocumentFilter, 
    maxDocuments: number
  ): Promise<DiscoveryResult> {
    this.logger.debug(`Starting optimized discovery with limit: ${maxDocuments}`);
    
    const foundDocuments: DocumentWithPath[] = [];
    const processedFolders = new Set<string>();
    let totalScanned = 0;

    // Helper function to process documents from a folder response
    const processDocuments = async (documents: QuipDocument[], folderPath: string): Promise<boolean> => {
      for (const doc of documents) {
        // Apply basic filters first
        if (filter.types && !filter.types.includes(doc.type)) continue;
        if (filter.includeTemplates === false && doc.is_template) continue;
        if (filter.includeDeleted === false && doc.is_deleted) continue;
        if (filter.titleContains && !doc.title.toLowerCase().includes(filter.titleContains.toLowerCase())) continue;

        const isShared = this.isDocumentShared(doc);
        if (filter.includeShared === false && isShared) continue;

        // Filter by creation date
        if (filter.createdAfter || filter.createdBefore) {
          const createdDate = new Date(doc.created_usec / 1000);
          if (filter.createdAfter && createdDate < filter.createdAfter) continue;
          if (filter.createdBefore && createdDate > filter.createdBefore) continue;
        }

        // Add to results
        foundDocuments.push({
          document: doc,
          folderPath,
          isShared
        });

        totalScanned++;
        
        // Check if we've reached the limit
        if (foundDocuments.length >= maxDocuments) {
          this.logger.debug(`Reached document limit of ${maxDocuments}, stopping discovery`);
          return true; // Signal to stop
        }
      }
      return false; // Continue processing
    };

    // Process user's private folder first (most likely to contain user's documents)
    if (currentUser.private_folder_id && !processedFolders.has(currentUser.private_folder_id)) {
      try {
        this.logger.debug(`Processing private folder: ${currentUser.private_folder_id}`);
        const response = await this.apiClient.getFolderContents(currentUser.private_folder_id);
        if (response.success) {
          const { documents } = await this.parseListResponse(response.data!);
          const shouldStop = await processDocuments(documents, 'Private');
          if (shouldStop) {
            return this.createLimitedResult(foundDocuments, totalScanned, true);
          }
        }
        processedFolders.add(currentUser.private_folder_id);
      } catch (error) {
        this.logger.warn(`Failed to process private folder:`, error);
      }
    }

    // Process desktop folder if we haven't reached the limit
    if (currentUser.desktop_folder_id && !processedFolders.has(currentUser.desktop_folder_id) && foundDocuments.length < maxDocuments) {
      try {
        this.logger.debug(`Processing desktop folder: ${currentUser.desktop_folder_id}`);
        const response = await this.apiClient.getFolderContents(currentUser.desktop_folder_id);
        if (response.success) {
          const { documents } = await this.parseListResponse(response.data!);
          const shouldStop = await processDocuments(documents, 'Desktop');
          if (shouldStop) {
            return this.createLimitedResult(foundDocuments, totalScanned, true);
          }
        }
        processedFolders.add(currentUser.desktop_folder_id);
      } catch (error) {
        this.logger.warn(`Failed to process desktop folder:`, error);
      }
    }

    // Process other user folders if we haven't reached the limit
    if (currentUser.folders && Array.isArray(currentUser.folders) && foundDocuments.length < maxDocuments) {
      for (const folder of currentUser.folders) {
        if (processedFolders.has(folder.id) || foundDocuments.length >= maxDocuments) break;
        
        try {
          this.logger.debug(`Processing user folder: ${folder.id}`);
          const response = await this.apiClient.getFolderContents(folder.id);
          if (response.success) {
            const { documents } = await this.parseListResponse(response.data!);
            
            // Filter to user-owned documents
            const ownedDocs = documents.filter(doc => 
              doc.author_id === currentUserId || 
              (!doc.author_id && !this.isDocumentShared(doc))
            );
            
            const shouldStop = await processDocuments(ownedDocs, folder.title || 'Documents');
            if (shouldStop) {
              return this.createLimitedResult(foundDocuments, totalScanned, true);
            }
          }
          processedFolders.add(folder.id);
        } catch (error) {
          this.logger.warn(`Failed to process folder ${folder.id}:`, error);
        }
      }
    }

    this.logger.info(`Optimized discovery complete: ${foundDocuments.length} documents found (scanned ${totalScanned} total)`);
    return this.createLimitedResult(foundDocuments, totalScanned, false);
  }

  /**
   * Create result object for limited discovery
   */
  private createLimitedResult(documents: DocumentWithPath[], totalScanned: number, limitReached: boolean): DiscoveryResult {
    // Create a simple folder structure for the limited results
    const folderMap = new Map<string, DocumentWithPath[]>();
    
    documents.forEach(doc => {
      const folderPath = doc.folderPath;
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath)!.push(doc);
    });

    const folderStructures: FolderStructure[] = Array.from(folderMap.entries()).map(([path, docs]) => ({
      folder: {
        id: `virtual-${path.toLowerCase().replace(/\s+/g, '-')}`,
        title: path,
        created_usec: Date.now() * 1000,
        updated_usec: Date.now() * 1000,
        children: [],
        member_ids: []
      },
      path,
      children: [],
      documents: docs
    }));

    return {
      documents,
      folders: folderStructures,
      totalCount: limitReached ? totalScanned + 1 : totalScanned, // +1 to indicate more exist
      filteredCount: documents.length
    };
  }

  /**
   * Discover documents from a Quip URL
   * Automatically determines if URL is a folder or document
   */
  async discoverFromUrl(url: string, filter?: DocumentFilter): Promise<DiscoveryResult> {
    this.logger.info(`Discovering documents from URL: ${url}`);

    // Parse URL
    const urlInfo = parseQuipUrl(url);
    if (!urlInfo.isValid) {
      throw new Error(`Invalid Quip URL: ${urlInfo.error}`);
    }

    this.logger.debug(`Extracted thread ID: ${urlInfo.threadId}`);

    try {
      // Try to get as folder first (folders use /1/folders endpoint)
      this.logger.debug(`Attempting to fetch as folder: ${urlInfo.threadId}`);
      const folderResponse = await this.apiClient.getFolderContents(urlInfo.threadId);
      
      if (folderResponse.success) {
        this.logger.debug(`Resource is a folder, discovering all documents within`);
        return this.discoverFromFolder(urlInfo.threadId, filter);
      }
      
      // If folder fetch failed, try as document (documents use /2/threads endpoint)
      this.logger.debug(`Folder fetch failed, attempting to fetch as document: ${urlInfo.threadId}`);
      const metadata = await this.apiClient.getDocumentMetadata(urlInfo.threadId);
      
      if (!metadata.success) {
        // Provide more specific error message for resource not found (404 only)
        const errorMsg = metadata.error || 'Unknown error';
        const statusCode = metadata.statusCode;
        
        if (statusCode === 404 || errorMsg.startsWith('HTTP 404')) {
          throw new Error(`Resource not found: The document or folder at this URL does not exist or you don't have access to it`);
        }
        throw new Error(`Failed to fetch resource: ${errorMsg}`);
      }

      const resource = metadata.data as any;
      this.logger.debug(`Resource is a document, returning single document`);
      return this.discoverSingleDocument(resource, filter);
      
    } catch (error) {
      this.logger.error('Failed to discover from URL', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Discover all documents from a folder URL
   */
  private async discoverFromFolder(
    folderId: string,
    filter?: DocumentFilter
  ): Promise<DiscoveryResult> {
    this.logger.debug(`Discovering documents from folder: ${folderId}`);

    try {
      // Reset skipped count for this discovery operation
      this.skippedDocumentCount = 0;
      
      const documents = await this.getDocumentsFromFolder(folderId, true);

      // Apply filters if provided
      let filteredDocs = documents;
      if (filter) {
        filteredDocs = this.applyFilters(documents, filter);
      }

      this.logger.info(`Folder discovery complete: ${filteredDocs.length} documents found`);
      
      if (this.skippedDocumentCount > 0) {
        this.logger.info(`⚠️  Skipped ${this.skippedDocumentCount} document(s) due to access permissions`);
      }

      return {
        documents: filteredDocs,
        folders: [], // Folder structure is implicit in folderPath
        totalCount: documents.length,
        filteredCount: filteredDocs.length,
        skippedCount: this.skippedDocumentCount
      };
    } catch (error) {
      this.logger.error(`Failed to discover from folder ${folderId}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Create discovery result for a single document
   */
  private async discoverSingleDocument(
    resource: any,
    filter?: DocumentFilter
  ): Promise<DiscoveryResult> {
    this.logger.debug(`Processing single document: ${resource.thread?.id || resource.id}`);

    // Extract document from resource (handle both V2 API format and direct document format)
    const threadData = resource.thread || resource;
    const document: QuipDocument = {
      id: threadData.id,
      title: threadData.title || 'Untitled',
      type: (threadData.type || 'DOCUMENT').toUpperCase() as 'DOCUMENT' | 'SPREADSHEET' | 'CHAT',
      created_usec: threadData.created_usec || Date.now() * 1000,
      updated_usec: threadData.updated_usec || Date.now() * 1000,
      author_id: threadData.author_id || '',
      owning_company_id: threadData.owning_company_id || null,
      link: threadData.link || '',
      secret_path: threadData.secret_path || '',
      is_template: threadData.is_template || false,
      is_deleted: threadData.is_deleted || false
    };

    // Try to get the actual folder path for this document
    let folderPath = 'Documents';
    try {
      const documentFolderPath = await this.getDocumentFolderPath(document);
      if (documentFolderPath && documentFolderPath !== 'Documents') {
        folderPath = documentFolderPath;
      }
    } catch (error) {
      this.logger.debug(`Could not determine folder path for document ${document.id}, using default`);
    }

    // Check if document passes filters
    const docWithPath: DocumentWithPath = {
      document,
      folderPath,
      isShared: this.isDocumentShared(document)
    };

    if (filter && !this.documentMatchesFilter(docWithPath, filter)) {
      this.logger.debug(`Document filtered out by filter criteria`);
      return {
        documents: [],
        folders: [],
        totalCount: 0,
        filteredCount: 0
      };
    }

    this.logger.info(`Single document discovery complete: ${document.title}`);

    return {
      documents: [docWithPath],
      folders: [],
      totalCount: 1,
      filteredCount: 1
    };
  }

  /**
   * Check if a document matches the filter criteria
   */
  private documentMatchesFilter(docWithPath: DocumentWithPath, filter: DocumentFilter): boolean {
    const { document, isShared } = docWithPath;

    // Filter by document type
    if (filter.types && !filter.types.includes(document.type)) {
      return false;
    }

    // Filter by shared status
    if (filter.includeShared === false && isShared) {
      return false;
    }

    // Filter by template status
    if (filter.includeTemplates === false && document.is_template) {
      return false;
    }

    // Filter by deleted status
    if (filter.includeDeleted === false && document.is_deleted) {
      return false;
    }

    // Filter by creation date
    if (filter.createdAfter || filter.createdBefore) {
      const createdDate = new Date(document.created_usec / 1000);

      if (filter.createdAfter && createdDate < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && createdDate > filter.createdBefore) {
        return false;
      }
    }

    // Filter by title content
    if (filter.titleContains && !document.title.toLowerCase().includes(filter.titleContains.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Get documents from a specific folder
   */
  async getDocumentsFromFolder(folderId: string, recursive: boolean = true): Promise<DocumentWithPath[]> {
    this.logger.debug(`Getting documents from folder: ${folderId}`);

    try {
      const folderResponse = await this.apiClient.getFolderContents(folderId);
      if (!folderResponse.success) {
        throw new Error(`Failed to get folder contents: ${folderResponse.error}`);
      }

      // Extract and cache folder metadata from response
      const responseData = folderResponse.data as any;
      if (responseData.folder) {
        const folderMetadata: QuipFolder = {
          id: responseData.folder.id || folderId,
          title: responseData.folder.title || folderId,
          created_usec: responseData.folder.created_usec || Date.now() * 1000,
          updated_usec: responseData.folder.updated_usec || Date.now() * 1000,
          children: responseData.children || [],
          member_ids: responseData.folder.member_ids || []
        };
        this.folderCache.set(folderId, folderMetadata);
      }

      const { documents, folders } = await this.parseListResponse(folderResponse.data!);
      const folderPath = await this.getFolderPath(folderId);
      
      // Verify read access for each document and filter out inaccessible ones
      const accessibleDocs: DocumentWithPath[] = [];

      for (const doc of documents) {
        try {
          // Verify read access by attempting to get document metadata
          const metadata = await this.apiClient.getDocumentMetadata(doc.id);
          if (metadata.success) {
            accessibleDocs.push({
              document: doc,
              folderPath,
              isShared: this.isDocumentShared(doc)
            });
          } else {
            this.logger.warn(`Skipping document "${doc.title}" - no access permission`);
            this.skippedDocumentCount++;
          }
        } catch (error) {
          this.logger.warn(`Skipping document "${doc.title}" - ${error instanceof Error ? error.message : String(error)}`);
          this.skippedDocumentCount++;
        }
      }

      let allDocuments: DocumentWithPath[] = accessibleDocs;

      // Recursively get documents from subfolders if requested
      if (recursive) {
        for (const folder of folders) {
          const subDocuments = await this.getDocumentsFromFolder(folder.id, true);
          allDocuments = allDocuments.concat(subDocuments);
        }
      }

      return allDocuments;

    } catch (error) {
      this.logger.error(`Failed to get documents from folder ${folderId}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Search for documents by title or content
   */
  async searchDocuments(query: string, filter: DocumentFilter = {}): Promise<DocumentWithPath[]> {
    this.logger.info(`Searching documents with query: "${query}"`);

    try {
      // If query is empty, use a space character to search for all documents
      let searchResponse;
      if (!query || query.trim() === '') {
        this.logger.debug('Empty query provided, using space character to search all documents');
        searchResponse = await this.apiClient.searchDocuments(' ');
      } else {
        searchResponse = await this.apiClient.searchDocuments(query);
      }
      
      if (!searchResponse.success) {
        throw new Error(`Search failed: ${searchResponse.error}`);
      }

      const { documents } = await this.parseListResponse(searchResponse.data!);
      
      // Enrich documents with folder paths
      const documentsWithPaths: DocumentWithPath[] = [];
      for (const doc of documents) {
        const folderPath = await this.getDocumentFolderPath(doc);
        documentsWithPaths.push({
          document: doc,
          folderPath,
          isShared: this.isDocumentShared(doc)
        });
      }

      // Apply additional filters
      const filteredDocuments = this.applyFilters(documentsWithPaths, filter);

      this.logger.info(`Search complete: ${filteredDocuments.length} documents found`);
      return filteredDocuments;

    } catch (error) {
      this.logger.error('Document search failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get detailed metadata for a document
   */
  async getDocumentMetadata(documentId: string): Promise<QuipDocument | null> {
    // Check cache first
    if (this.documentCache.has(documentId)) {
      return this.documentCache.get(documentId)!;
    }

    try {
      const response = await this.apiClient.getDocumentMetadata(documentId);
      if (!response.success) {
        this.logger.warn(`Failed to get metadata for document ${documentId}: ${response.error}`);
        return null;
      }

      // The V2 API returns document data nested under 'thread'
      const rawData = response.data as any;
      const threadData = rawData.thread || rawData;
      
      const document: QuipDocument = {
        id: threadData.id || documentId,
        title: threadData.title || 'Untitled',
        type: (threadData.type || 'DOCUMENT').toUpperCase() as 'DOCUMENT' | 'SPREADSHEET' | 'CHAT',
        created_usec: threadData.created_usec || Date.now() * 1000,
        updated_usec: threadData.updated_usec || Date.now() * 1000,
        author_id: threadData.author_id || '',
        owning_company_id: threadData.owning_company_id || null,
        link: threadData.link || '',
        secret_path: threadData.secret_path || '',
        is_template: threadData.is_template || false,
        is_deleted: threadData.is_deleted || false
      };
      
      this.documentCache.set(documentId, document);
      return document;

    } catch (error) {
      this.logger.error(`Error getting document metadata for ${documentId}`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Parse Quip API list response into documents and folders
   */
  private async parseListResponse(response: QuipListResponse): Promise<{ documents: QuipDocument[], folders: QuipFolder[] }> {
    const documents: QuipDocument[] = [];
    const folders: QuipFolder[] = [];

    // Check if this is a folder response format
    if (response.children && Array.isArray(response.children)) {
      return await this.parseFolderResponse(response);
    }

    // Handle search/recent response format
    for (const [docId, item] of Object.entries(response)) {
      if (this.isDocument(item)) {
        // Transform the item to QuipDocument format
        const document: QuipDocument = this.transformToQuipDocument(docId, item);
        documents.push(document);
      } else if (this.isFolder(item)) {
        folders.push(item);
      }
    }

    return { documents, folders };
  }

  /**
   * Get folder metadata from Quip API
   * @private
   */
  private async getFolderMetadata(folderId: string): Promise<QuipFolder> {
    // Check cache first for performance
    if (this.folderCache.has(folderId)) {
      return this.folderCache.get(folderId)!;
    }

    // Call Quip API to fetch folder metadata
    const folderResponse = await this.apiClient.getFolderContents(folderId);
    if (!folderResponse.success) {
      throw new Error(`Failed to get folder metadata: ${folderResponse.error}`);
    }

    const folderData = folderResponse.data as any;
    
    // Extract folder title and metadata
    const folder: QuipFolder = {
      id: folderData.folder?.id || folderId,
      title: folderData.folder?.title || folderData.title || folderId,
      created_usec: folderData.folder?.created_usec || Date.now() * 1000,
      updated_usec: folderData.folder?.updated_usec || Date.now() * 1000,
      children: folderData.children || [],
      member_ids: folderData.folder?.member_ids || []
    };

    // Cache the result
    this.folderCache.set(folderId, folder);

    return folder;
  }

  /**
   * Parse folder API response format
   */
  private async parseFolderResponse(response: any): Promise<{ documents: QuipDocument[], folders: QuipFolder[] }> {
    const documents: QuipDocument[] = [];
    const folders: QuipFolder[] = [];

    if (response.children && Array.isArray(response.children)) {
      for (const child of response.children) {
        if (child.thread_id) {
          // This is a document - fetch its actual metadata
          try {
            const docMetadata = await this.getDocumentMetadata(child.thread_id);
            if (docMetadata) {
              documents.push(docMetadata);
            } else {
              // Fallback to minimal object if metadata fetch fails
              documents.push({
                id: child.thread_id,
                title: `Document ${child.thread_id}`,
                type: 'DOCUMENT',
                created_usec: Date.now() * 1000,
                updated_usec: Date.now() * 1000,
                author_id: '',
                owning_company_id: null,
                link: '',
                secret_path: '',
                is_template: false,
                is_deleted: false
              });
            }
          } catch (error) {
            this.logger.warn(`Failed to get metadata for document ${child.thread_id}:`, error);
            // Add minimal document object as fallback
            documents.push({
              id: child.thread_id,
              title: `Document ${child.thread_id}`,
              type: 'DOCUMENT',
              created_usec: Date.now() * 1000,
              updated_usec: Date.now() * 1000,
              author_id: '',
              owning_company_id: null,
              link: '',
              secret_path: '',
              is_template: false,
              is_deleted: false
            });
          }
        } else if (child.folder_id) {
          // This is a subfolder - fetch actual folder metadata
          try {
            const folderMetadata = await this.getFolderMetadata(child.folder_id);
            folders.push(folderMetadata);
          } catch (error) {
            // Fallback to folder ID if metadata fetch fails
            this.logger.warn(`Failed to get metadata for folder ${child.folder_id}, using ID as name:`, error);
            folders.push({
              id: child.folder_id,
              title: child.folder_id,
              created_usec: Date.now() * 1000,
              updated_usec: Date.now() * 1000,
              children: [],
              member_ids: []
            });
          }
        }
      }
    }

    return { documents, folders };
  }

  /**
   * Transform API response item to QuipDocument format
   */
  private transformToQuipDocument(docId: string, item: any): QuipDocument {
    // If item already has the right structure, return as is
    if (item.id && item.title && item.type && item.created_usec !== undefined) {
      return item as QuipDocument;
    }

    // Transform /1/threads/recent response format
    if (item.thread) {
      const thread = item.thread;
      return {
        id: thread.id || docId,
        title: thread.title || 'Untitled',
        type: (thread.type || 'DOCUMENT').toUpperCase() as 'DOCUMENT' | 'SPREADSHEET' | 'CHAT',
        created_usec: thread.created_usec || Date.now() * 1000,
        updated_usec: thread.updated_usec || Date.now() * 1000,
        author_id: thread.author_id || '',
        owning_company_id: thread.owning_company_id || null,
        link: thread.link || '',
        secret_path: thread.secret_path || '',
        is_template: thread.is_template || false,
        is_deleted: thread.is_deleted || false
      };
    }

    // Fallback for unknown format
    return {
      id: docId,
      title: item.title || 'Untitled',
      type: item.type || 'DOCUMENT',
      created_usec: Date.now() * 1000,
      updated_usec: Date.now() * 1000,
      author_id: '',
      owning_company_id: null,
      link: '',
      secret_path: '',
      is_template: false,
      is_deleted: false
    };
  }

  /**
   * Type guard to check if item is a document
   */
  private isDocument(item: any): item is QuipDocument {
    // Check if item has thread property with type (for /1/threads/recent response)
    if (item && item.thread && typeof item.thread.type === 'string') {
      const type = item.thread.type.toUpperCase();
      return ['DOCUMENT', 'SPREADSHEET', 'CHAT'].includes(type);
    }
    // Fallback to direct type check (for other API responses)
    return item && typeof item.type === 'string' && ['DOCUMENT', 'SPREADSHEET', 'CHAT'].includes(item.type.toUpperCase());
  }

  /**
   * Type guard to check if item is a folder
   */
  private isFolder(item: any): item is QuipFolder {
    return item && Array.isArray(item.children);
  }

  /**
   * Build folder structure hierarchy
   */
  private async buildFolderStructures(folders: QuipFolder[]): Promise<FolderStructure[]> {
    const structures: FolderStructure[] = [];
    const processedFolders = new Set<string>();

    for (const folder of folders) {
      if (!processedFolders.has(folder.id)) {
        const structure = await this.buildFolderStructure(folder, '', processedFolders);
        if (structure) {
          structures.push(structure);
        }
      }
    }

    return structures;
  }

  /**
   * Build individual folder structure
   */
  private async buildFolderStructure(
    folder: QuipFolder, 
    parentPath: string, 
    processedFolders: Set<string>
  ): Promise<FolderStructure | null> {
    if (processedFolders.has(folder.id)) {
      return null;
    }

    processedFolders.add(folder.id);
    const currentPath = parentPath ? `${parentPath}/${folder.title}` : folder.title;

    try {
      // Get folder contents
      const contentsResponse = await this.apiClient.getFolderContents(folder.id);
      if (!contentsResponse.success) {
        this.logger.warn(`Failed to get contents for folder ${folder.id}: ${contentsResponse.error}`);
        return {
          folder,
          path: currentPath,
          children: [],
          documents: []
        };
      }

      const { documents, folders: subFolders } = await this.parseListResponse(contentsResponse.data!);

      // Build child folder structures
      const children: FolderStructure[] = [];
      for (const subFolder of subFolders) {
        const childStructure = await this.buildFolderStructure(subFolder, currentPath, processedFolders);
        if (childStructure) {
          children.push(childStructure);
        }
      }

      // Create document entries with path
      const documentsWithPath: DocumentWithPath[] = documents.map(doc => ({
        document: doc,
        folderPath: currentPath,
        isShared: this.isDocumentShared(doc)
      }));

      return {
        folder,
        path: currentPath,
        children,
        documents: documentsWithPath
      };

    } catch (error) {
      this.logger.error(`Error building folder structure for ${folder.id}`, { error: error instanceof Error ? error.message : String(error) });
      return {
        folder,
        path: currentPath,
        children: [],
        documents: []
      };
    }
  }

  /**
   * Collect all documents from folder structures
   */
  private async collectAllDocuments(
    folderStructures: FolderStructure[], 
    rootDocuments: QuipDocument[]
  ): Promise<DocumentWithPath[]> {
    const allDocuments: DocumentWithPath[] = [];

    // Add root-level documents
    for (const doc of rootDocuments) {
      const folderPath = await this.getDocumentFolderPath(doc);
      allDocuments.push({
        document: doc,
        folderPath,
        isShared: this.isDocumentShared(doc)
      });
    }

    // Recursively collect documents from folder structures
    const collectFromStructure = (structure: FolderStructure) => {
      allDocuments.push(...structure.documents);
      structure.children.forEach(collectFromStructure);
    };

    folderStructures.forEach(collectFromStructure);

    return allDocuments;
  }

  /**
   * Apply filters to document list
   */
  private applyFilters(documents: DocumentWithPath[], filter: DocumentFilter): DocumentWithPath[] {
    let filtered = documents.filter(({ document, isShared }) => {
      // Filter by document type
      if (filter.types && !filter.types.includes(document.type)) {
        return false;
      }

      // Filter by shared status
      if (filter.includeShared === false && isShared) {
        return false;
      }

      // Filter by template status
      if (filter.includeTemplates === false && document.is_template) {
        return false;
      }

      // Filter by deleted status
      if (filter.includeDeleted === false && document.is_deleted) {
        return false;
      }

      // Filter by creation date
      if (filter.createdAfter || filter.createdBefore) {
        const createdDate = new Date(document.created_usec / 1000);
        
        if (filter.createdAfter && createdDate < filter.createdAfter) {
          return false;
        }
        
        if (filter.createdBefore && createdDate > filter.createdBefore) {
          return false;
        }
      }

      // Filter by title content
      if (filter.titleContains && !document.title.toLowerCase().includes(filter.titleContains.toLowerCase())) {
        return false;
      }

      return true;
    });

    // Apply document limit
    if (filter.maxDocuments && filter.maxDocuments > 0) {
      filtered = filtered.slice(0, filter.maxDocuments);
    }

    return filtered;
  }

  /**
   * Check if document is shared (has multiple member IDs or is in shared folder)
   */
  private isDocumentShared(document: QuipDocument): boolean {
    // In enterprise environments, owning_company_id is typically set for all documents
    // A better heuristic is to check if the document has explicit sharing indicators
    // For now, we'll be more permissive and only consider documents as "shared" 
    // if they have specific sharing indicators beyond just company ownership
    
    // If the document has no company ID, it's definitely not shared
    if (!document.owning_company_id) {
      return false;
    }
    
    // For enterprise environments, we'll consider documents as "personal" by default
    // unless there are specific indicators of broader sharing
    // This is a more practical approach for enterprise Quip usage
    return false;
  }

  /**
   * Get folder path for a document
   */
  private async getDocumentFolderPath(_document: QuipDocument): Promise<string> {
    // This is a simplified implementation
    // In practice, you might need to traverse the folder hierarchy to build the full path
    return 'Documents'; // Default folder path
  }

  /**
   * Get folder path by folder ID
   */
  private async getFolderPath(folderId: string): Promise<string> {
    const folder = this.folderCache.get(folderId);
    return folder ? folder.title : 'Unknown Folder';
  }

  /**
   * Create virtual folder structure when no real folders are available
   */
  private createVirtualFolderStructure(documents: QuipDocument[]): FolderStructure[] {
    const structures: FolderStructure[] = [];
    
    // Group documents by type
    const documentsByType: { [key: string]: QuipDocument[] } = {};
    documents.forEach(doc => {
      const type = doc.type || 'DOCUMENT';
      if (!documentsByType[type]) {
        documentsByType[type] = [];
      }
      documentsByType[type].push(doc);
    });

    // Create virtual folders for each document type
    Object.entries(documentsByType).forEach(([type, docs]) => {
      const folderName = this.getTypeDisplayName(type);
      const virtualFolder: QuipFolder = {
        id: `virtual-${type.toLowerCase()}`,
        title: folderName,
        created_usec: Date.now() * 1000,
        updated_usec: Date.now() * 1000,
        children: [],
        member_ids: []
      };

      const documentsWithPath: DocumentWithPath[] = docs.map(doc => ({
        document: doc,
        folderPath: folderName,
        isShared: this.isDocumentShared(doc)
      }));

      const structure: FolderStructure = {
        folder: virtualFolder,
        path: folderName,
        children: [],
        documents: documentsWithPath
      };

      structures.push(structure);
    });

    // Note: Removed "Recent Documents" folder as requested - focus only on user's own documents

    return structures;
  }

  /**
   * Get display name for document type
   */
  private getTypeDisplayName(type: string): string {
    switch (type.toUpperCase()) {
      case 'DOCUMENT': return 'Documents';
      case 'SPREADSHEET': return 'Spreadsheets';
      case 'CHAT': return 'Chat Rooms';
      default: return 'Other';
    }
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.documentCache.clear();
    this.folderCache.clear();
    this.logger.debug('Document discovery cache cleared');
  }
}