# Requirements Document

## Introduction

This feature enhances the Quip export tool by automatically prefixing exported document filenames with their last updated date in ISO 8601 format (YYYY-MM-DD). This provides chronological organization and makes it easier to identify when documents were last modified.

## Glossary

- **QuipExportTool**: The command-line application that exports documents from Quip to local storage
- **ExportedDocument**: A document file that has been downloaded from Quip and saved to local storage
- **UpdatedDate**: The timestamp indicating when a document was last modified in Quip, stored in the `updated_usec` field
- **ISODateFormat**: The ISO 8601 date format (YYYY-MM-DD) used for prefixing filenames
- **DocumentFilename**: The name of the file saved to local storage, including the date prefix and original title

## Requirements

### Requirement 1

**User Story:** As a user exporting Quip documents, I want the exported filenames to include the last updated date, so that I can easily identify when documents were last modified without opening them.

#### Acceptance Criteria

1. WHEN THE QuipExportTool exports a document, THE QuipExportTool SHALL retrieve the updated_usec field from the document metadata
2. WHEN THE QuipExportTool has retrieved the updated_usec field, THE QuipExportTool SHALL convert the timestamp to ISODateFormat (YYYY-MM-DD)
3. WHEN THE QuipExportTool generates the DocumentFilename, THE QuipExportTool SHALL prepend the ISODateFormat to the original document title with a space separator
4. WHEN THE QuipExportTool saves the ExportedDocument, THE QuipExportTool SHALL use the date-prefixed DocumentFilename as the file name

### Requirement 2

**User Story:** As a user with documents that have the same title but different update dates, I want each exported file to have a unique name based on its update date, so that I can distinguish between different versions.

#### Acceptance Criteria

1. WHEN THE QuipExportTool encounters multiple documents with identical titles, THE QuipExportTool SHALL create unique filenames by including each document's respective ISODateFormat prefix
2. WHEN THE QuipExportTool generates a date-prefixed DocumentFilename, THE QuipExportTool SHALL ensure the filename is valid for the target file system
3. WHEN THE QuipExportTool sanitizes the DocumentFilename, THE QuipExportTool SHALL preserve the ISODateFormat prefix at the beginning of the filename

### Requirement 3

**User Story:** As a user exporting documents in different formats, I want the date prefix to be applied consistently across all export formats, so that I have uniform naming regardless of the output format.

#### Acceptance Criteria

1. WHEN THE QuipExportTool exports a document in native format, THE QuipExportTool SHALL apply the ISODateFormat prefix to the DocumentFilename
2. WHEN THE QuipExportTool exports a document in HTML format, THE QuipExportTool SHALL apply the ISODateFormat prefix to the DocumentFilename
3. WHEN THE QuipExportTool exports a document in markdown format, THE QuipExportTool SHALL apply the ISODateFormat prefix to the DocumentFilename
4. WHEN THE QuipExportTool exports a document in multiple formats simultaneously, THE QuipExportTool SHALL apply the same ISODateFormat prefix to all format variants of the DocumentFilename

### Requirement 4

**User Story:** As a user reviewing exported documents, I want the date prefix format to be sortable, so that I can easily organize documents chronologically by filename.

#### Acceptance Criteria

1. WHEN THE QuipExportTool formats the date prefix, THE QuipExportTool SHALL use the configured date format pattern with YYYY as the four-digit year, MM as the two-digit month, and DD as the two-digit day
2. WHEN THE QuipExportTool converts the updated_usec timestamp, THE QuipExportTool SHALL use the local timezone for date calculation
3. WHEN THE QuipExportTool creates the date-prefixed DocumentFilename, THE QuipExportTool SHALL separate the date prefix from the document title with a single space character

### Requirement 5

**User Story:** As a user configuring the export tool, I want to enable or disable date prefixing and customize the date format, so that I can control how filenames are generated.

#### Acceptance Criteria

1. WHEN THE QuipExportTool runs the configure command, THE QuipExportTool SHALL prompt the user to enable or disable date prefixing
2. WHEN THE QuipExportTool prompts for date format, THE QuipExportTool SHALL accept format patterns containing YYYY, MM, and DD tokens
3. WHEN THE QuipExportTool validates a date format pattern, THE QuipExportTool SHALL verify that the pattern contains all three required tokens (YYYY, MM, DD)
4. WHEN THE QuipExportTool receives an invalid date format pattern, THE QuipExportTool SHALL use the default format YYYY-MM-DD
5. WHEN THE QuipExportTool saves the configuration, THE QuipExportTool SHALL store the date prefix enabled flag and format pattern in the export configuration file

### Requirement 6

**User Story:** As a user listing documents, I want to see both the created date and updated date in the output, so that I can understand the document timeline.

#### Acceptance Criteria

1. WHEN THE QuipExportTool executes the list command, THE QuipExportTool SHALL display both the created_usec and updated_usec dates for each document
2. WHEN THE QuipExportTool formats dates for display, THE QuipExportTool SHALL convert timestamps to human-readable date format
3. WHEN THE QuipExportTool displays the document list in table format, THE QuipExportTool SHALL include separate columns for Created and Updated dates

### Requirement 7

**User Story:** As a user previewing an export, I want to see the date-prefixed filename in the preview output, so that I know exactly what the exported files will be named.

#### Acceptance Criteria

1. WHEN THE QuipExportTool executes the preview command, THE QuipExportTool SHALL display the UpdatedDate for each document
2. WHEN THE QuipExportTool generates the output path preview, THE QuipExportTool SHALL apply the date prefix to the DocumentFilename if date prefixing is enabled
3. WHEN THE QuipExportTool displays the preview output, THE QuipExportTool SHALL show the complete path including the date-prefixed DocumentFilename
