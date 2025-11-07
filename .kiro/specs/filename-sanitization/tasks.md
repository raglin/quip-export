# Implementation Plan

- [x] 1. Update PathUtils sanitization logic
  - [x] 1.1 Add comprehensive filesystem reserved characters regex
    - Create new constant `FILESYSTEM_RESERVED_CHARS` that includes forward slash and backslash on all platforms
    - Update regex to: `/[<>:"|?*\/\\\x00-\x1f]/g`
    - _Requirements: 1.1, 1.2, 2.1_

  - [x] 1.2 Enhance sanitizeFileNameEnhanced function
    - Implement character-specific replacement strategy (slashes/colons → hyphens, others → underscores)
    - Add logic to collapse multiple consecutive separators into single separator
    - Add logic to remove leading and trailing separators
    - Update fallback logic to handle empty filenames after sanitization
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.4, 3.5_

  - [x] 1.3 Add significantChange detection to PathSanitizationResult
    - Calculate percentage of characters changed during sanitization
    - Set significantChange flag when >30% of characters are modified
    - _Requirements: 3.3, 4.1, 4.2_

- [x] 2. Update FileWriter logging
  - [x] 2.1 Add INFO-level logging for significant filename changes
    - Log when significantChange flag is true
    - Include both original and sanitized filenames in log message
    - _Requirements: 3.3, 4.4_

  - [x] 2.2 Add DEBUG-level logging for all sanitization operations
    - Log every sanitization with before/after filenames
    - Include list of unsafe characters found
    - _Requirements: 3.3, 4.4_

- [x] 3. Update DirectoryManager for folder path sanitization
  - [x] 3.1 Apply sanitization to folder path components
    - Update createFormatQuipFolderStructure to sanitize each path segment
    - Ensure forward slashes in folder names don't create unintended nesting
    - _Requirements: 2.1, 4.5_

- [x] 4. Add validation helper function
  - [x] 4.1 Create isFilenameSafe validation function
    - Check for presence of reserved characters
    - Verify filename length is within limits
    - Return boolean indicating if filename is safe
    - _Requirements: 4.3_

- [x] 5. Update type definitions
  - [x] 5.1 Extend PathSanitizationResult interface
    - Add optional significantChange boolean field
    - Update JSDoc comments to document new field
    - _Requirements: 4.1, 4.2_

- [x] 6. Fix folder name retrieval in DocumentDiscovery
  - [x] 6.1 Add getFolderMetadata helper function
    - Create private async function that accepts folderId
    - Check folderCache first for performance
    - Call Quip API to fetch folder metadata
    - Extract and return folder title and metadata
    - Cache the result in folderCache
    - _Requirements: 5.1, 5.3_

  - [x] 6.2 Update parseFolderResponse to use actual folder names
    - Replace hardcoded 'Subfolder' with call to getFolderMetadata
    - Implement try-catch to handle metadata fetch failures
    - Use folder ID as fallback when metadata fetch fails
    - Add warning log when fallback is used
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.3 Verify folder path construction
    - Ensure buildFolderStructure uses actual folder names
    - Test with nested folder hierarchies
    - Verify complete folder paths are correct
    - _Requirements: 5.5_

- [x] 7. Update documentation
  - [x] 7.1 Update CHANGELOG.md
    - Document the bug fix for forward slash handling
    - Document the bug fix for hardcoded folder names
    - Explain the new sanitization behavior
    - Note the change from underscores to hyphens for slashes/colons
    - _Requirements: 3.3_

  - [x] 7.2 Update USAGE_GUIDE.md
    - Add section explaining filename sanitization
    - Provide examples of common problematic filenames and their sanitized versions
    - Document the character replacement strategy
    - Explain folder structure preservation
    - _Requirements: 3.3, 5.5_

  - [x] 7.3 Update TROUBLESHOOTING.md
    - Add entry for filename sanitization issues
    - Add entry for folder name issues
    - Explain how to identify if sanitization is causing problems
    - Provide guidance on reviewing sanitized filenames and folder structures
    - _Requirements: 3.3, 5.4_
