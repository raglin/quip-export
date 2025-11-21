# Design Document

## Overview

This design implements URL-based export functionality for the Quip export tool. Users can provide Quip URLs directly from their web browser to export specific documents or entire folders. The feature extends existing CLI commands (`list`, `export preview`, `export start`) with optional URL parameters, maintaining a consistent interface while adding powerful new capabilities.

The implementation parses Quip URLs to extract thread IDs, determines whether the URL points to a document or folder, and then uses existing export infrastructure to process the resources. This approach minimizes code duplication and ensures consistent behavior across all export methods.

## Architecture

### URL Processing Flow

```
User provides URL
  → URL Parser extracts thread ID
  → API call to get resource metadata
  → Determine resource type (document vs folder)
  → If folder: discover all accessible documents
  → If document: prepare single document for export
  → Use existing export pipeline
  → Display results
```

### Component Integration

The URL-based export integrates with existing components:

1. **CLI Commands** - Extended to accept optional `--url` parameter
2. **QuipApiClient** - Already has methods to fetch by thread ID
3. **DocumentDiscovery** - Extended with URL-specific discovery methods
4. **ExportOrchestrator** - Uses existing export logic with filtered document list

## Components and Interfaces

### URL Parser Utility

A new utility module for parsing Quip URLs:

```typescript
/**
 * Parse a Quip URL and extract the thread ID
 * Supports formats:
 * - https://quip.com/ThreadID/optional-title
 * - https://quip.com/ThreadID
 * - https://quip-amazon.com/ThreadID/optional-title
 * - https://custom-domain.com/ThreadID
 */
interface QuipUrlInfo {
  threadId: string;
  domain: string;
  isValid: boolean;
  error?: string;
}

function parseQuipUrl(url: string): QuipUrlInfo {
  try {
    const urlObj = new URL(url);
    
    // Extract path segments
    const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
    
    if (pathSegments.length === 0) {
      return {
        threadId: '',
        domain: urlObj.hostname,
        isValid: false,
        error: 'URL does not contain a thread ID'
      };
    }
    
    // First path segment is the thread ID
    const threadId = pathSegments[0];
    
    // Validate thread ID format (alphanumeric, typically 12 characters)
    if (!/^[a-zA-Z0-9]{8,}$/.test(threadId)) {
      return {
        threadId: '',
        domain: urlObj.hostname,
        isValid: false,
        error: 'Invalid thread ID format'
      };
    }
    
    return {
      threadId,
      domain: urlObj.hostname,
      isValid: true
    };
  } catch (error) {
    return {
      threadId: '',
      domain: '',
      isValid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Validate that a URL is a Quip URL
 */
function isQuipUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if domain contains 'quip'
    return urlObj.hostname.includes('quip');
  } catch {
    return false;
  }
}
```

### DocumentDiscovery Extension

Extend the `DocumentDiscovery` class with URL-specific methods:

```typescript
/**
 * Discover documents from a Quip URL
 * Automatically determines if URL is a folder or document
 */
async discoverFromUrl(url: string, filter?: DocumentFilter): Promise<DiscoveryResult> {
  // Parse URL
  const urlInfo = parseQuipUrl(url);
  if (!urlInfo.isValid) {
    throw new Error(`Invalid Quip URL: ${urlInfo.error}`);
  }
  
  // Get resource metadata
  const metadata = await this.apiClient.getDocumentMetadata(urlInfo.threadId);
  if (!metadata.success) {
    throw new Error(`Failed to fetch resource: ${metadata.error}`);
  }
  
  const resource = metadata.data;
  
  // Check if it's a folder or document
  if (resource.type === 'FOLDER' || this.isFolderThread(resource)) {
    // It's a folder - discover all documents within
    return this.discoverFromFolder(urlInfo.threadId, filter);
  } else {
    // It's a document - return single document
    return this.discoverSingleDocument(resource, filter);
  }
}

/**
 * Discover all documents from a folder URL
 */
private async discoverFromFolder(
  folderId: string, 
  filter?: DocumentFilter
): Promise<DiscoveryResult> {
  const documents = await this.getDocumentsFromFolder(folderId, true);
  
  // Apply filters if provided
  let filteredDocs = documents;
  if (filter) {
    filteredDocs = this.applyFilters(documents, filter);
  }
  
  return {
    documents: filteredDocs,
    totalCount: filteredDocs.length,
    folders: [], // Folder structure is implicit in folderPath
    discoveryTime: Date.now()
  };
}

/**
 * Create discovery result for a single document
 */
private async discoverSingleDocument(
  document: QuipDocument,
  filter?: DocumentFilter
): Promise<DiscoveryResult> {
  // Check if document passes filters
  if (filter && !this.documentMatchesFilter(document, filter)) {
    return {
      documents: [],
      totalCount: 0,
      folders: [],
      discoveryTime: Date.now()
    };
  }
  
  const docWithPath: DocumentWithPath = {
    document,
    folderPath: 'Documents',
    isShared: false
  };
  
  return {
    documents: [docWithPath],
    totalCount: 1,
    folders: [],
    discoveryTime: Date.now()
  };
}

/**
 * Determine if a thread is a folder
 */
private isFolderThread(resource: any): boolean {
  // Folders have specific characteristics in Quip API
  return resource.thread && resource.thread.type === 'FOLDER';
}
```

### CLI Command Extensions

Update CLI commands to accept URL parameter:

```typescript
// List command
program
  .command('list')
  .description('List available Quip documents')
  .option('--url <url>', 'List documents from a specific Quip URL')
  .option('--format <format>', 'Output format (table, json, csv)', 'table')
  .option('--limit <number>', 'Limit number of results', '50')
  .option('-v, --verbose', 'Show detailed document information')
  .action(async (options) => {
    // ... existing auth checks ...
    
    let documents: any[];
    
    if (options.url) {
      // URL-based listing
      console.log(`📋 Listing documents from URL: ${options.url}\n`);
      
      const discovery = await quipService.discoverFromUrl(options.url, filter);
      documents = discovery.documents;
      
      console.log(`Found ${documents.length} document(s) from URL\n`);
    } else {
      // Existing full listing logic
      const discovery = await quipService.discoverDocuments(filter);
      documents = discovery.documents;
    }
    
    // ... existing display logic ...
  });

// Export preview command
exportCommand
  .command('preview')
  .description('Preview what documents will be exported')
  .option('--url <url>', 'Preview export from a specific Quip URL')
  .option('-c, --config <file>', 'Use specific configuration file')
  .option('--limit <number>', 'Limit preview to N documents', '20')
  .action(async (options) => {
    // ... existing auth and config checks ...
    
    let documentsToExport: any[];
    let sourceDescription: string;
    
    if (options.url) {
      // URL-based preview
      console.log(`🔍 Previewing export from URL: ${options.url}\n`);
      
      const discovery = await quipService.discoverFromUrl(options.url, {
        includeShared: exportSettings.includeSharedDocuments,
        includeTemplates: false,
        includeDeleted: false
      });
      
      documentsToExport = discovery.documents;
      sourceDescription = `URL: ${options.url}`;
    } else {
      // Existing full preview logic
      const discovery = await quipService.discoverDocuments({
        includeShared: exportSettings.includeSharedDocuments,
        includeTemplates: false,
        includeDeleted: false,
        maxDocuments: exportSettings.maxDocuments
      });
      
      documentsToExport = discovery.documents;
      sourceDescription = 'All accessible documents';
    }
    
    // ... existing preview display logic ...
    console.log(`Source: ${sourceDescription}`);
    // ... rest of preview ...
  });

// Export start command
exportCommand
  .command('start')
  .description('Start the export process')
  .option('--url <url>', 'Export from a specific Quip URL')
  .option('-c, --config <file>', 'Use specific configuration file')
  .option('--dry-run', 'Preview export without downloading')
  .action(async (options) => {
    // ... existing auth and config checks ...
    
    let exportScope: string;
    let documentFilter: any;
    
    if (options.url) {
      // URL-based export
      console.log(`🚀 Starting export from URL: ${options.url}\n`);
      exportScope = `URL: ${options.url}`;
      
      // Create a custom filter that uses URL discovery
      documentFilter = {
        url: options.url,
        includeShared: exportSettings.includeSharedDocuments,
        includeTemplates: false,
        includeDeleted: false
      };
    } else {
      // Existing full export logic
      exportScope = 'All configured documents';
      documentFilter = {
        includeShared: exportSettings.includeSharedDocuments,
        includeTemplates: false,
        includeDeleted: false,
        maxDocuments: exportSettings.maxDocuments
      };
    }
    
    console.log(`Export scope: ${exportScope}`);
    
    // ... rest of export logic using documentFilter ...
  });
```

## Data Models

### QuipUrlInfo Interface

```typescript
export interface QuipUrlInfo {
  threadId: string;
  domain: string;
  isValid: boolean;
  error?: string;
}
```

### DocumentFilter Extension

Extend the existing `DocumentFilter` interface to support URL-based filtering:

```typescript
export interface DocumentFilter {
  includeShared?: boolean;
  includeTemplates?: boolean;
  includeDeleted?: boolean;
  maxDocuments?: number;
  url?: string;  // New field for URL-based filtering
}
```

## Error Handling

### URL Parsing Errors

```typescript
try {
  const urlInfo = parseQuipUrl(url);
  if (!urlInfo.isValid) {
    console.error(`❌ Invalid Quip URL: ${urlInfo.error}`);
    console.error('');
    console.error('Expected format:');
    console.error('  https://quip.com/ThreadID/optional-title');
    console.error('  https://quip-amazon.com/ThreadID');
    console.error('');
    console.error('Example:');
    console.error('  https://quip.com/fNTdOlbHmWrW/AppMod-WWSO');
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Failed to parse URL: ${error.message}`);
  process.exit(1);
}
```

### Resource Not Found

```typescript
const metadata = await quipService.getDocument(threadId);
if (!metadata) {
  console.error(`❌ Resource not found: ${url}`);
  console.error('');
  console.error('Possible reasons:');
  console.error('  • The document or folder does not exist');
  console.error('  • You do not have permission to access it');
  console.error('  • The URL is incorrect');
  console.error('');
  console.error('💡 Verify the URL in your browser first');
  process.exit(1);
}
```

### Permission Errors

```typescript
// During folder document discovery
for (const doc of folderDocuments) {
  try {
    const metadata = await this.apiClient.getDocumentMetadata(doc.id);
    if (metadata.success) {
      accessibleDocs.push(doc);
    } else {
      this.logger.warn(`Skipping document "${doc.title}" - no access permission`);
      skippedCount++;
    }
  } catch (error) {
    this.logger.warn(`Skipping document "${doc.title}" - ${error.message}`);
    skippedCount++;
  }
}

if (skippedCount > 0) {
  console.log(`⚠️  Skipped ${skippedCount} document(s) due to access permissions`);
}
```

### Authentication Errors

```typescript
if (!authManager || !validation.valid) {
  console.error('❌ Authentication required!');
  console.error('');
  console.error('Please authenticate first:');
  console.error('  quip-export auth login');
  console.error('');
  process.exit(1);
}
```

## Testing Strategy

### Unit Tests

1. **URL Parsing Tests**
   - Test valid URL formats (with and without titles)
   - Test invalid URL formats
   - Test URLs from different domains
   - Test URLs with query parameters
   - Test malformed URLs

2. **Resource Type Detection Tests**
   - Test folder detection from metadata
   - Test document detection from metadata
   - Test edge cases (empty folders, deleted resources)

3. **Document Discovery Tests**
   - Test single document discovery from URL
   - Test folder document discovery from URL
   - Test permission filtering during discovery
   - Test recursive folder traversal

### Integration Tests

1. **CLI Command Tests**
   - Test `list --url` with document URL
   - Test `list --url` with folder URL
   - Test `export preview --url` with various URLs
   - Test `export start --url` with document and folder URLs
   - Test error handling for invalid URLs

2. **End-to-End Tests**
   - Export single document via URL
   - Export folder via URL
   - Export folder with mixed permissions
   - Verify exported files match expected structure

### Manual Testing Scenarios

1. Copy a document URL from browser and export it
2. Copy a folder URL from browser and list its contents
3. Preview export from a folder URL
4. Export a folder with 10+ documents
5. Test with URLs from different Quip domains (quip.com, quip-amazon.com)
6. Test with shared folders containing documents you don't own
7. Test error messages for invalid URLs

## Implementation Notes

### Backward Compatibility

- All URL parameters are optional
- Existing commands work exactly as before when no URL is provided
- No changes to configuration file format
- No changes to existing export logic

### Performance Considerations

- URL-based exports may be faster for small subsets of documents
- Folder discovery uses existing recursive traversal (already optimized)
- Permission checks happen during discovery (fail fast for inaccessible documents)
- Rate limiting applies equally to URL-based and full exports

### URL Format Flexibility

The parser accepts various URL formats:
- With or without document title in path
- With or without query parameters
- Different Quip domains (public, enterprise, custom)
- HTTP or HTTPS protocols

### Thread ID Validation

Thread IDs in Quip are typically:
- Alphanumeric characters
- 12 characters long (but can vary)
- Case-sensitive

The parser validates format but relies on API for existence validation.

### Folder vs Document Detection

The API response includes type information:
- Documents have `type: 'DOCUMENT'` or `type: 'SPREADSHEET'`
- Folders have `type: 'FOLDER'` or specific folder indicators
- The implementation checks multiple indicators for robustness
