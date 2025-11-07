# Requirements Document

## Introduction

The Quip export tool currently fails when document titles contain forward slashes (/) or other filesystem-reserved characters. These characters are interpreted as directory separators, causing file write operations to fail with ENOENT errors. This feature will implement robust filename sanitization to handle all problematic characters while preserving document title readability.

## Glossary

- **FileWriter**: The component responsible for writing exported document content to the local filesystem
- **PathUtils**: Utility module that handles path manipulation and validation
- **Sanitization**: The process of replacing or removing characters that are invalid in filenames
- **Reserved Characters**: Characters that have special meaning in filesystems (e.g., /, \, :, *, ?, ", <, >, |)

## Requirements

### Requirement 1

**User Story:** As a user exporting Quip documents, I want documents with forward slashes in their titles to export successfully, so that I don't lose access to those documents.

#### Acceptance Criteria

1. WHEN a document title contains forward slash characters, THE FileWriter SHALL replace each forward slash with a hyphen before creating the file
2. WHEN a document title contains backslash characters, THE FileWriter SHALL replace each backslash with a hyphen before creating the file
3. WHEN a document title contains colon characters, THE FileWriter SHALL replace each colon with a hyphen before creating the file
4. WHEN a document title contains multiple consecutive reserved characters, THE FileWriter SHALL replace them with a single hyphen
5. WHEN sanitization creates leading or trailing hyphens, THE FileWriter SHALL remove them from the filename

### Requirement 2

**User Story:** As a user, I want all filesystem-reserved characters handled consistently, so that exports never fail due to filename issues.

#### Acceptance Criteria

1. THE FileWriter SHALL sanitize the following reserved characters: forward slash, backslash, colon, asterisk, question mark, double quote, less-than, greater-than, pipe
2. WHEN a document title contains only reserved characters, THE FileWriter SHALL generate a fallback filename using the document ID
3. WHEN sanitization results in an empty filename, THE FileWriter SHALL use the document ID as the filename
4. THE FileWriter SHALL preserve alphanumeric characters, spaces, hyphens, underscores, and periods in document titles
5. THE FileWriter SHALL maintain filename length within filesystem limits (255 characters maximum)

### Requirement 3

**User Story:** As a user, I want to easily identify which original document corresponds to each exported file, so that I can find my documents after export.

#### Acceptance Criteria

1. THE FileWriter SHALL preserve the original document title structure as much as possible during sanitization
2. WHEN multiple documents sanitize to the same filename, THE FileWriter SHALL append numeric suffixes to ensure uniqueness
3. THE FileWriter SHALL log a warning message when a filename is sanitized, including both original and sanitized names
4. THE FileWriter SHALL maintain the file extension unchanged during sanitization
5. THE FileWriter SHALL preserve spaces and capitalization from the original title

### Requirement 4

**User Story:** As a developer, I want filename sanitization to be centralized and testable, so that it can be maintained and verified easily.

#### Acceptance Criteria

1. THE PathUtils module SHALL provide a sanitizeFilename function that accepts a filename string and returns a sanitized string
2. THE sanitizeFilename function SHALL be pure (no side effects) and deterministic (same input produces same output)
3. THE PathUtils module SHALL provide a function to validate whether a filename is safe for the current operating system
4. THE FileWriter SHALL use PathUtils for all filename sanitization operations
5. THE sanitization logic SHALL be independent of the document export format

### Requirement 5

**User Story:** As a user, I want exported documents to be organized in folders with their actual Quip folder names, so that I can navigate my exported content using familiar folder structures.

#### Acceptance Criteria

1. WHEN a document is in a Quip folder, THE DocumentDiscovery SHALL retrieve the actual folder name from Quip API
2. THE DocumentDiscovery SHALL NOT use placeholder names like "Subfolder" for folder titles
3. WHEN folder metadata cannot be retrieved, THE DocumentDiscovery SHALL use the folder ID as a fallback name
4. THE DocumentDiscovery SHALL log a warning when falling back to folder ID due to metadata retrieval failure
5. THE folder path SHALL reflect the complete hierarchy of actual folder names from Quip
