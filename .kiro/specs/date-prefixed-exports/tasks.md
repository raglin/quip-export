# Implementation Plan

- [x] 1. Add date formatting utilities
  - Create date formatting functions in a new utility module or extend existing PathUtils
  - Implement `formatQuipDate()` function that converts microsecond timestamps to formatted date strings
  - Implement `isValidDateFormat()` function to validate date format patterns
  - _Requirements: 1.2, 4.1, 5.3, 5.4_

- [x] 2. Extend configuration types and interfaces
  - [x] 2.1 Add DatePrefixConfig interface to types
    - Define interface with `enabled` and `format` properties
    - _Requirements: 5.5_
  
  - [x] 2.2 Extend FileWriteOptions interface
    - Add `updatedDate` optional field for timestamp
    - Add `datePrefixConfig` optional field for configuration
    - _Requirements: 1.1, 5.5_
  
  - [x] 2.3 Update export configuration schema
    - Add `datePrefix` field to export configuration
    - Set default values (enabled: true, format: "YYYY-MM-DD")
    - _Requirements: 5.5_

- [x] 3. Update FileWriter class for date prefixing
  - [x] 3.1 Modify createSafeFileName method
    - Add `updatedDate` and `datePrefixConfig` parameters
    - Apply date prefix when enabled and timestamp provided
    - Preserve existing sanitization logic
    - _Requirements: 1.3, 1.4, 2.3, 3.1, 4.3, 5.1_
  
  - [x] 3.2 Modify createSafeFileNameForFormat method
    - Add `updatedDate` and `datePrefixConfig` parameters
    - Apply date prefix consistently across all formats
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 3.3 Update writeDocument method
    - Pass date prefix configuration to filename generation
    - Extract updatedDate from options
    - _Requirements: 1.4, 3.1, 3.2, 3.3, 3.4_
  
  - [x] 3.4 Update writeFormatDocument method
    - Pass date prefix configuration to format-specific filename generation
    - _Requirements: 3.4_

- [x] 4. Update PathUtils sanitization
  - Modify sanitizeFileNameEnhanced to preserve date prefix pattern
  - Add detection for date prefix at start of filename (YYYY-MM-DD pattern)
  - Ensure date prefix is not corrupted during sanitization
  - _Requirements: 2.3_

- [x] 5. Update CLI list command
  - [x] 5.1 Modify displayDocumentsAsTable function
    - Add "Updated" column to table output
    - Format both created and updated dates
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 5.2 Modify displayDocumentsAsCsv function
    - Include updated date in CSV output
    - _Requirements: 6.1, 6.2_

- [x] 6. Update CLI export configure command
  - [x] 6.1 Add date prefix configuration prompts
    - Prompt user to enable/disable date prefixing
    - Prompt user for date format pattern
    - Provide examples of valid formats
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.2 Add date format validation
    - Validate format pattern contains YYYY, MM, DD
    - Fall back to default if invalid
    - Display warning for invalid formats
    - _Requirements: 5.3, 5.4_
  
  - [x] 6.3 Save date prefix configuration
    - Include datePrefix settings in configuration file
    - Display configuration summary with date prefix settings
    - _Requirements: 5.5_

- [x] 7. Update CLI export preview command
  - [x] 7.1 Display updated date for each document
    - Show formatted updated date in preview output
    - _Requirements: 7.1_
  
  - [x] 7.2 Apply date prefix to preview filenames
    - Load date prefix configuration
    - Generate preview filenames with date prefix if enabled
    - Display complete output paths with date-prefixed filenames
    - _Requirements: 7.2, 7.3_

- [x] 8. Update export orchestrator integration
  - [x] 8.1 Pass updated_usec to FileWriter
    - Extract updated_usec from QuipDocument metadata
    - Include in FileWriteOptions when calling writeDocument
    - _Requirements: 1.1_
  
  - [x] 8.2 Pass date prefix configuration to FileWriter
    - Load date prefix config from export configuration
    - Pass to FileWriter methods
    - _Requirements: 5.5_

- [x] 9. Update configuration migration
  - Add date prefix default settings to migrateConfiguration function
  - Ensure existing configurations get default date prefix settings
  - _Requirements: 5.5_

- [x] 10. Update documentation
  - Update README with date prefix feature description
  - Add configuration examples showing date prefix settings
  - Document supported date format patterns
  - Add examples of date-prefixed filenames
  - _Requirements: All_
