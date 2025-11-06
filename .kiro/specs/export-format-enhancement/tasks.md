# Implementation Plan

- [x] 1. Set up format converter infrastructure
  - Create base interfaces for format converters in `src/services/quip/format-converters/`
  - Define `IFormatConverter` interface and `ConversionResult` type
  - Create `FormatConverterRegistry` class to manage available converters
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 2. Implement markdown format converter
  - [ ] 2.1 Create MarkdownConverter class
    - Install `turndown` and `cheerio` dependencies
    - Implement HTML to markdown conversion logic
    - Handle tables, lists, headers, links, and text formatting
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3_

  - [ ] 2.2 Add markdown-specific image handling
    - Implement image extraction and separate file saving
    - Add markdown image reference generation
    - Support inline, separate, and skip image modes
    - _Requirements: 1.5, 4.1_

  - [ ] 2.3 Handle Quip-specific content conversion
    - Convert or filter Quip comments and collaborative features
    - Preserve code blocks with proper markdown syntax
    - Maintain nested list structure and indentation
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [ ] 2.4 Write unit tests for markdown converter
    - Test HTML to markdown conversion with various content types
    - Test image handling modes and file organization
    - Test Quip-specific content processing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Add native PDF export support
  - [x] 3.1 Add PDF export method to QuipApiClient
    - Implement `exportDocumentPdf` method using `/1/threads/{id}/export/pdf` endpoint
    - Follow same pattern as existing DOCX and XLSX export methods
    - Add proper error handling and retry logic
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Integrate PDF export into DocumentExporter
    - Add PDF case to `exportInFormat` method
    - Handle document type compatibility (documents and spreadsheets supported)
    - Add proper error messages for unsupported document types
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 3.3 Update file handling for PDF format
    - Add PDF file extension and MIME type support
    - Update filename generation for PDF files
    - Ensure proper file organization in output directories
    - _Requirements: 2.1, 5.1_

  - [x] 3.4 Write unit tests for PDF export
    - Test PDF export API integration with mocked responses
    - Test error handling for unsupported document types
    - Test file extension and MIME type handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Enhance DocumentExporter for multi-format support
  - [x] 4.1 Update ExportOptions interface
    - Change from single format to array of formats
    - Add format-specific options for markdown (PDF uses native API)
    - Maintain backward compatibility with existing single format
    - _Requirements: 3.1, 6.1_

  - [x] 4.2 Implement multi-format export pipeline
    - Modify `exportDocument` method to handle multiple formats
    - Add format converter coordination and parallel processing
    - Create `MultiFormatExportResult` response structure
    - _Requirements: 3.2, 3.3_

  - [x] 4.3 Add format-specific error handling
    - Implement isolated error handling per format
    - Continue processing other formats when one fails
    - Collect and report format-specific errors
    - _Requirements: 3.5, 7.3_

  - [x] 4.4 Write integration tests for multi-format export
    - Test exporting documents in multiple formats simultaneously
    - Test error isolation between formats
    - Test file organization and naming consistency
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Update file organization and output structure
  - [x] 5.1 Implement format-based directory structure
    - Create separate subdirectories for each export format
    - Maintain folder structure within each format directory
    - Update file path generation logic
    - _Requirements: 3.3, 7.5_

  - [x] 5.2 Enhance filename generation and sanitization
    - Add format-specific file extensions (.md, .pdf)
    - Improve filename sanitization for cross-platform compatibility
    - Handle filename conflicts across formats
    - _Requirements: 3.3, 7.5_

- [x] 6. Update CLI for multi-format selection
  - [x] 6.1 Enhance export format configuration in setup
    - Update setup command to support multiple format selection
    - Add format-specific option prompts for markdown (PDF uses native formatting)
    - Maintain backward compatibility with existing configurations
    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Update export commands for new formats
    - Add markdown and PDF options to format selection
    - Support comma-separated format lists (--format docx,markdown,pdf)
    - Add format-specific CLI flags for advanced options
    - _Requirements: 6.1, 6.2_

  - [x] 6.3 Implement configuration migration
    - Auto-migrate single format configs to array format
    - Preserve existing user preferences during migration
    - Add validation for new format-specific options
    - _Requirements: 6.3_

- [x] 7. Add progress tracking and reporting for multi-format exports
  - [x] 7.1 Enhance progress reporting
    - Update progress callbacks to show format-specific progress
    - Display current format being processed
    - Show completion status for each format
    - _Requirements: 7.1, 7.2_

  - [x] 7.2 Update export summary and reporting
    - Show success/failure counts by format
    - Display output directory structure with format subdirectories
    - Include format-specific error details in reports
    - _Requirements: 7.4, 7.5_

  - [x] 7.3 Write end-to-end tests for complete export workflow
    - Test full export process with multiple formats
    - Test CLI format selection and configuration
    - Test progress reporting and error handling
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Add format validation and dependency management
  - [x] 8.1 Implement format capability detection
    - Check for required dependencies (turndown for markdown)
    - Provide clear error messages for missing dependencies
    - Allow graceful degradation when markdown conversion unavailable
    - _Requirements: 6.3, 6.4_

  - [x] 8.2 Add format-document type compatibility validation
    - Validate format selections against document types
    - Provide warnings for suboptimal format choices
    - Ensure all document types can export to at least one format
    - _Requirements: 6.4_

  - [x] 8.3 Write validation and compatibility tests
    - Test dependency detection and error handling
    - Test format-document type compatibility checks
    - Test graceful degradation scenarios
    - _Requirements: 6.3, 6.4_

- [x] 9. Fix native format file extension bug
  - [x] 9.1 Update PathUtils.getFileExtensionForFormat method
    - Add native format case that resolves to proper extension based on document type
    - Add documentType parameter to method signature
    - Handle fallback cases when document type is not provided
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 9.2 Update all callers to pass document type
    - Modify FileWriter.writeDocument to pass document type when available
    - Update FileWriter.createSafeFileNameForFormat to handle native format properly
    - Ensure document type is available throughout the file naming pipeline
    - _Requirements: 8.4, 8.5_

  - [x] 9.3 Write comprehensive tests for native format resolution
    - Test native format resolution for documents (.docx)
    - Test native format resolution for spreadsheets (.xlsx)
    - Test native format resolution for chat documents (.html)
    - Test fallback behavior when document type is unavailable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_