# Implementation Plan

- [ ] 1. Create URL parsing utility module
  - [ ] 1.1 Create url-parser.ts utility file
    - Implement `parseQuipUrl()` function to extract thread ID from URLs
    - Implement `isQuipUrl()` function to validate Quip URLs
    - Handle various URL formats (with/without titles, query parameters)
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 1.2 Add URL validation logic
    - Validate thread ID format (alphanumeric, minimum length)
    - Provide descriptive error messages for invalid URLs
    - _Requirements: 7.1, 7.2_
  
  - [ ] 1.3 Define QuipUrlInfo interface
    - Add interface to types with threadId, domain, isValid, and error fields
    - _Requirements: 1.1, 4.1_

- [ ] 2. Extend DocumentDiscovery class for URL-based discovery
  - [ ] 2.1 Add discoverFromUrl method
    - Parse URL and extract thread ID
    - Fetch resource metadata from API
    - Determine if resource is folder or document
    - Route to appropriate discovery method
    - _Requirements: 1.1, 1.2, 2.1, 2.2_
  
  - [ ] 2.2 Add discoverFromFolder private method
    - Use existing getDocumentsFromFolder method
    - Apply document filters
    - Return DiscoveryResult with folder documents
    - _Requirements: 2.3, 2.4, 2.5_
  
  - [ ] 2.3 Add discoverSingleDocument private method
    - Create DocumentWithPath for single document
    - Apply document filters
    - Return DiscoveryResult with single document
    - _Requirements: 1.3, 1.4_
  
  - [ ] 2.4 Add isFolderThread helper method
    - Check resource type indicators
    - Handle various folder type formats
    - _Requirements: 2.1, 2.2_
  
  - [ ] 2.5 Add permission checking during folder discovery
    - Verify read access for each document
    - Skip documents without permission
    - Log warnings for skipped documents
    - Track skipped document count
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Extend DocumentFilter interface
  - Add optional `url` field to DocumentFilter type
  - Update type definitions
  - _Requirements: 5.2_

- [ ] 4. Update CLI list command for URL support
  - [ ] 4.1 Add --url option to list command
    - Add option definition with description
    - _Requirements: 5.1, 8.1_
  
  - [ ] 4.2 Implement URL-based listing logic
    - Check if URL option is provided
    - Call discoverFromUrl when URL is present
    - Display source information (URL vs all documents)
    - _Requirements: 8.2, 8.3_
  
  - [ ] 4.3 Update list output to show document count
    - Display count of documents found from URL
    - _Requirements: 8.2_
  
  - [ ] 4.4 Maintain backward compatibility
    - Ensure existing list behavior works without URL
    - _Requirements: 8.4_

- [ ] 5. Update CLI export preview command for URL support
  - [ ] 5.1 Add --url option to preview command
    - Add option definition with description
    - _Requirements: 5.1, 9.1_
  
  - [ ] 5.2 Implement URL-based preview logic
    - Check if URL option is provided
    - Call discoverFromUrl when URL is present
    - Display source description (URL vs all documents)
    - _Requirements: 9.2, 9.4_
  
  - [ ] 5.3 Update preview output format
    - Show URL source in preview header
    - Display document count from URL
    - _Requirements: 9.2, 9.4_
  
  - [ ] 5.4 Maintain backward compatibility
    - Ensure existing preview behavior works without URL
    - _Requirements: 9.3_

- [ ] 6. Update CLI export start command for URL support
  - [ ] 6.1 Add --url option to start command
    - Add option definition with description
    - _Requirements: 5.1, 5.2_
  
  - [ ] 6.2 Implement URL-based export logic
    - Check if URL option is provided
    - Create document filter with URL field
    - Pass URL to discovery process
    - _Requirements: 5.2_
  
  - [ ] 6.3 Update export scope display
    - Show URL source in export header
    - Display export scope description
    - _Requirements: 5.4_
  
  - [ ] 6.4 Maintain backward compatibility
    - Ensure existing export behavior works without URL
    - _Requirements: 5.3_

- [ ] 7. Update ExportOrchestrator for URL-based exports
  - [ ] 7.1 Modify startExport to handle URL filter
    - Check if config contains URL field
    - Use discoverFromUrl when URL is present
    - Use existing discovery when URL is absent
    - _Requirements: 5.2_
  
  - [ ] 7.2 Add progress tracking for URL exports
    - Display total document count at start
    - Show current document number and title during export
    - Display completion summary with time and success rate
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 8. Add error handling for URL-based operations
  - [ ] 8.1 Add URL parsing error messages
    - Display clear error for invalid URL format
    - Show expected URL format examples
    - _Requirements: 7.1, 7.2_
  
  - [ ] 8.2 Add resource not found error handling
    - Display error when thread ID doesn't exist
    - Provide troubleshooting suggestions
    - _Requirements: 7.3_
  
  - [ ] 8.3 Add authentication error handling
    - Display error when authentication fails
    - Guide user to authenticate
    - _Requirements: 7.4_
  
  - [ ] 8.4 Add permission error handling
    - Display warning for skipped documents
    - Show count of skipped documents in summary
    - _Requirements: 3.3, 3.4_

- [ ] 9. Update documentation
  - Update README with URL-based export examples
  - Document --url option for list, preview, and start commands
  - Add examples of document and folder URLs
  - Document supported URL formats
  - Add troubleshooting section for URL-based exports
  - _Requirements: All_
