# Design Document

## Overview

This design extends the existing Quip export tool to support markdown and PDF export formats alongside the current DOCX and HTML formats. PDF export will leverage Quip's native API endpoint (similar to DOCX/XLSX), while markdown export will use format conversion from HTML. The enhancement will integrate seamlessly with the existing architecture while adding minimal complexity.

## Architecture

### Current Architecture Analysis

The existing system follows a layered architecture:
- **CLI Layer**: Handles user interaction and configuration (`src/cli/index.ts`)
- **Service Layer**: Core business logic (`src/services/quip/`)
- **Export Layer**: Document conversion and export (`DocumentExporter`)
- **API Layer**: Quip API communication (`QuipApiClient`)

### Enhanced Architecture

The enhancement will extend the existing `DocumentExporter` class and add format conversion for markdown only:

```
┌─────────────────┐
│   CLI Layer     │ ← Enhanced format selection
├─────────────────┤
│ Service Layer   │ ← Updated QuipService
├─────────────────┤
│ Export Layer    │ ← Enhanced DocumentExporter
│  ┌─────────────┐│
│  │ Markdown    ││ ← New component (HTML→MD)
│  │ Converter   ││
│  └─────────────┘│
├─────────────────┤
│   API Layer     │ ← Enhanced with PDF endpoint
└─────────────────┘
```

**Key Changes:**
- **PDF Export**: Uses Quip's native `/1/threads/{id}/export/pdf` API (like existing DOCX/XLSX)
- **Markdown Export**: Converts HTML to Markdown using format converter
- **Native Format Fix**: Resolve "native" format to proper document-specific format before file naming
- **Minimal Complexity**: Leverages existing patterns for PDF, adds conversion only where needed

## Components and Interfaces

### 1. Enhanced ExportOptions Interface

```typescript
interface ExportOptions {
  preferredFormats: ('docx' | 'html' | 'xlsx' | 'markdown' | 'pdf')[];
  fallbackToHtml: boolean;
  includeMetadata: boolean;
  outputDirectory?: string;
  formatSpecificOptions?: {
    markdown?: MarkdownOptions;
    // PDF uses Quip's native export - no additional options
  };
}

interface MarkdownOptions {
  imageHandling: 'inline' | 'separate' | 'skip';
  preserveComments: boolean;
  frontMatter: boolean;
}

// PDF options removed - using Quip's native PDF export
// No additional configuration needed
```

### 2. Format Converter Architecture

```typescript
interface IFormatConverter {
  canConvert(documentType: string, targetFormat: string): boolean;
  convert(content: string | Buffer, options?: any): Promise<ConversionResult>;
  getSupportedFormats(): string[];
}

interface ConversionResult {
  success: boolean;
  content?: Buffer;
  format: string;
  error?: string;
  metadata?: any;
}
```

### 3. Format Converter Implementations

#### MarkdownConverter
- **Input**: HTML content from Quip API
- **Processing**: 
  - Parse HTML using a robust HTML parser (e.g., cheerio)
  - Convert HTML elements to markdown syntax
  - Handle tables, lists, headers, links, and formatting
  - Process images based on configuration
  - Clean up Quip-specific elements
- **Output**: Markdown text with optional front matter

#### PDF Export (Native API)
- **Input**: Document ID
- **Processing**:
  - Use Quip's native `/1/threads/{id}/export/pdf` endpoint
  - Same pattern as existing DOCX/XLSX exports
  - No additional conversion or processing needed
  - Quip handles all formatting, layout, and styling
- **Output**: PDF buffer from Quip API

### 4. Enhanced DocumentExporter

The existing `DocumentExporter` will be enhanced to:
- Support multiple format selection
- Coordinate format conversion pipeline
- Manage format-specific options
- Handle multi-format output organization

```typescript
class DocumentExporter {
  private formatConverters: Map<string, IFormatConverter>;
  
  async exportDocument(
    document: QuipDocument, 
    options: ExportOptions
  ): Promise<MultiFormatExportResult>;
  
  private async convertToFormat(
    baseContent: string | Buffer,
    targetFormat: string,
    options?: any
  ): Promise<ConversionResult>;
}

interface MultiFormatExportResult {
  success: boolean;
  documentId: string;
  title: string;
  formats: FormatResult[];
  errors: string[];
}

interface FormatResult {
  format: string;
  success: boolean;
  content?: Buffer;
  filePath?: string;
  error?: string;
}
```

## Data Models

### Enhanced Configuration Schema

```typescript
interface ExportConfiguration {
  outputDirectory: string;
  exportFormats: string[]; // Changed from single format to array
  formatOptions: {
    markdown?: MarkdownOptions;
    // PDF uses native API - no additional options needed
  };
  includeSharedDocuments: boolean;
  preserveFolderStructure: boolean;
  batchSize: number;
  retryAttempts: number;
  rateLimitDelay: number;
}
```

### File Organization Structure

```
exported-documents/
├── docx/
│   ├── Private/
│   │   └── document1.docx
│   └── Shared/
│       └── document2.docx
├── html/
│   ├── Private/
│   │   └── document1.html
│   └── Shared/
│       └── document2.html
├── markdown/
│   ├── Private/
│   │   ├── document1.md
│   │   └── images/
│   │       └── document1_image1.png
│   └── Shared/
│       └── document2.md
└── pdf/
    ├── Private/
    │   └── document1.pdf
    └── Shared/
        └── document2.pdf
```

## Native Format Resolution Fix

### Problem Description

The current implementation has a bug where the "native" format results in files with `.native` extensions instead of the proper document-specific extensions (.docx, .xlsx, .html). This occurs because the file naming logic in `PathUtils.getFileExtensionForFormat()` doesn't handle the "native" format case and falls back to `.txt`.

### Root Cause Analysis

1. **DocumentExporter Logic**: The `DocumentExporter.getFileExtension()` method correctly handles "native" by determining the native format and recursively calling itself
2. **PathUtils Bypass**: The `FileWriter.writeDocument()` method calls `PathUtils.getFileExtensionForFormat()` directly, bypassing the DocumentExporter's native format resolution
3. **Missing Case**: `PathUtils.getFileExtensionForFormat()` doesn't have a case for "native" format and falls back to `.txt`

### Solution Design

#### Option 1: Fix PathUtils (Recommended)
Add native format handling to `PathUtils.getFileExtensionForFormat()`:

```typescript
static getFileExtensionForFormat(format: string, documentType?: string): string {
  switch (format.toLowerCase()) {
    case 'native':
      // Resolve native format based on document type
      if (documentType) {
        switch (documentType.toUpperCase()) {
          case 'DOCUMENT': return '.docx';
          case 'SPREADSHEET': return '.xlsx';
          default: return '.html';
        }
      }
      return '.html'; // Fallback
    case 'docx': return '.docx';
    case 'xlsx': return '.xlsx';
    case 'html': return '.html';
    case 'pdf': return '.pdf';
    case 'markdown':
    case 'md': return '.md';
    default: return '.txt';
  }
}
```

#### Option 2: Resolve Native Format Earlier
Ensure "native" format is resolved to the actual format (docx/xlsx/html) before reaching the file naming logic.

#### Implementation Strategy
- **Phase 1**: Update `PathUtils.getFileExtensionForFormat()` to handle native format with document type parameter
- **Phase 2**: Update all callers to pass document type when available
- **Phase 3**: Add comprehensive tests for native format resolution

## Error Handling

### Format-Specific Error Handling

1. **Markdown Conversion Errors**:
   - HTML parsing failures → Fallback to plain text extraction
   - Image processing errors → Skip images or use placeholders
   - Complex table conversion → Fallback to simple table format

2. **PDF Export Errors**:
   - API failures → Retry with exponential backoff
   - Unsupported document types → Clear error message
   - Rate limiting → Respect Quip's rate limits and retry

3. **Multi-Format Error Strategy**:
   - Continue processing other formats if one fails
   - Collect and report all format-specific errors
   - Provide partial success results

### Error Recovery Mechanisms

```typescript
interface FormatErrorHandler {
  handleConversionError(
    error: Error, 
    format: string, 
    document: QuipDocument
  ): Promise<ConversionResult>;
}
```

## Testing Strategy

### Unit Testing

1. **Format Converter Tests**:
   - Test HTML to Markdown conversion with various content types
   - Test PDF export using Quip's native API
   - Test error handling and edge cases
   - Mock API responses for consistent testing

2. **Integration Tests**:
   - Test multi-format export pipeline
   - Test file organization and naming
   - Test configuration validation
   - Test CLI format selection

3. **Format-Specific Test Cases**:
   - **Markdown**: Tables, lists, images, code blocks, nested formatting
   - **PDF**: API integration, error handling, document type compatibility
   - **Multi-format**: Consistency across formats, error isolation

### Test Data Strategy

- Create sample Quip documents with various content types
- Use mock HTML responses for consistent testing
- Test with different document sizes and complexity levels
- Include edge cases like empty documents, image-heavy content

### Performance Testing

- Test conversion speed for different document sizes
- Memory usage testing for PDF generation
- Concurrent format conversion testing
- Large batch export testing

## Implementation Dependencies

### New Dependencies

1. **Markdown Conversion**:
   - `turndown` - HTML to Markdown converter
   - `cheerio` - HTML parsing and manipulation

2. **PDF Export**:
   - No additional dependencies - uses existing Quip API client

3. **Utility Libraries**:
   - `mime-types` - Enhanced MIME type detection
   - `sanitize-filename` - Cross-platform filename sanitization

### Dependency Management

- Add new dependencies as optional peer dependencies where possible
- Implement graceful degradation if optional dependencies are missing
- Provide clear error messages for missing required dependencies

## Configuration Migration

### Backward Compatibility

The existing configuration format will be automatically migrated:

```typescript
// Old format
{ exportFormat: 'docx' }

// New format (auto-migrated)
{ exportFormats: ['docx'] }
```

### CLI Enhancement

Enhanced CLI options:
```bash
# Single format (backward compatible)
quip-export export --format docx

# Multiple formats
quip-export export --format docx,markdown,pdf

# Format-specific options
quip-export export --format markdown --markdown-images separate
# PDF uses Quip's native formatting - no additional options needed
```

## Performance Considerations

### Conversion Pipeline Optimization

1. **Parallel Processing**: Convert multiple formats concurrently when possible
2. **Caching**: Cache intermediate HTML content for multiple format conversions
3. **Memory Management**: Stream large documents to avoid memory issues
4. **Resource Cleanup**: Properly dispose of browser instances and temporary files

### Scalability Measures

- Implement format conversion queuing for large batches
- Add progress tracking for multi-format exports
- Optimize file I/O operations
- Monitor and limit concurrent browser instances for PDF generation

## Security Considerations

### Content Sanitization

- Sanitize HTML content before PDF generation to prevent XSS
- Validate and sanitize file paths for all formats
- Ensure proper cleanup of temporary files

### Resource Limits

- Implement timeouts for format conversion operations
- Limit memory usage for PDF generation
- Restrict file sizes for conversion operations

## Migration Path

### Phase 1: Core Infrastructure
- Implement format converter interfaces
- Enhance DocumentExporter for multi-format support
- Add basic markdown conversion

### Phase 2: PDF Support
- Add PDF export method to QuipApiClient using native API
- Integrate PDF export into DocumentExporter
- Add PDF support to multi-format export pipeline

### Phase 3: CLI and Configuration
- Update CLI for multi-format selection
- Implement configuration migration
- Add format-specific option handling

### Phase 4: Optimization and Polish
- Performance optimization
- Enhanced error reporting
- Comprehensive testing and documentation