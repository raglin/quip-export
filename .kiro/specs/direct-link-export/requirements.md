# Requirements Document

## Introduction

This feature enables users to export Quip documents and folders by providing direct URLs from their web browser. Instead of navigating through folder structures or searching for documents by name, users can simply copy a URL from their browser and use it to export specific documents or entire folders with all accessible content.

## Glossary

- **QuipExportTool**: The command-line application that exports documents from Quip to local storage
- **QuipURL**: A web URL pointing to a Quip resource (document, spreadsheet, or folder)
- **FolderURL**: A Quip URL that points to a folder containing multiple documents
- **DocumentURL**: A Quip URL that points to a single document or spreadsheet
- **ThreadID**: The unique identifier extracted from a Quip URL that identifies a specific resource
- **ExportCommand**: The CLI command that initiates the export process
- **AccessibleDocument**: A document that the authenticated user has permission to view and export

## Requirements

### Requirement 1

**User Story:** As a user browsing Quip in my web browser, I want to export a specific document by providing its URL, so that I can quickly export individual documents without searching through folder structures.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives a DocumentURL as input, THE QuipExportTool SHALL extract the ThreadID from the URL
2. WHEN THE QuipExportTool has extracted the ThreadID, THE QuipExportTool SHALL retrieve the document metadata from the Quip API
3. WHEN THE QuipExportTool has retrieved the document metadata, THE QuipExportTool SHALL export the document using the configured export settings
4. WHEN THE QuipExportTool completes the export, THE QuipExportTool SHALL save the document to the configured output directory

### Requirement 2

**User Story:** As a user browsing Quip folders in my web browser, I want to export an entire folder by providing its URL, so that I can export all documents I have access to within that folder.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives a FolderURL as input, THE QuipExportTool SHALL extract the ThreadID from the URL
2. WHEN THE QuipExportTool has extracted the ThreadID, THE QuipExportTool SHALL retrieve the folder metadata from the Quip API
3. WHEN THE QuipExportTool has retrieved the folder metadata, THE QuipExportTool SHALL discover all AccessibleDocument items within the folder
4. WHEN THE QuipExportTool has discovered the documents, THE QuipExportTool SHALL export each AccessibleDocument using the configured export settings
5. WHEN THE QuipExportTool exports folder documents, THE QuipExportTool SHALL preserve the folder structure in the output directory

### Requirement 3

**User Story:** As a user with access to shared folders, I want to export only the documents I have permission to access, so that the export process does not fail due to permission errors.

#### Acceptance Criteria

1. WHEN THE QuipExportTool attempts to access a document within a folder, THE QuipExportTool SHALL verify the user has read permission for that document
2. WHEN THE QuipExportTool encounters a document without read permission, THE QuipExportTool SHALL skip that document and continue with the next document
3. WHEN THE QuipExportTool skips a document due to permissions, THE QuipExportTool SHALL log a warning message with the document title
4. WHEN THE QuipExportTool completes a folder export, THE QuipExportTool SHALL report the count of successfully exported and skipped documents

### Requirement 4

**User Story:** As a user providing Quip URLs, I want the tool to accept URLs in various formats, so that I can copy URLs directly from my browser without modification.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives a QuipURL, THE QuipExportTool SHALL accept URLs with the format https://domain.com/ThreadID/optional-title
2. WHEN THE QuipExportTool receives a QuipURL, THE QuipExportTool SHALL accept URLs with the format https://domain.com/ThreadID
3. WHEN THE QuipExportTool receives a QuipURL, THE QuipExportTool SHALL extract the ThreadID regardless of whether the optional title is present
4. WHEN THE QuipExportTool receives a QuipURL with query parameters, THE QuipExportTool SHALL ignore the query parameters and extract the ThreadID from the path

### Requirement 5

**User Story:** As a user exporting via URL, I want to use the existing export commands with URL parameters, so that I have a consistent interface for all export operations.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives the export start command, THE QuipExportTool SHALL accept an optional URL parameter
2. WHEN THE QuipExportTool receives a URL parameter, THE QuipExportTool SHALL export only the document or folder specified by the URL
3. WHEN THE QuipExportTool receives the export start command without a URL, THE QuipExportTool SHALL export all documents as configured
4. WHEN THE QuipExportTool completes the URL export, THE QuipExportTool SHALL display a summary of exported documents

### Requirement 8

**User Story:** As a user listing documents, I want to provide a folder URL to list only documents in that folder, so that I can preview folder contents before exporting.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives the list command, THE QuipExportTool SHALL accept an optional URL parameter
2. WHEN THE QuipExportTool receives a FolderURL with the list command, THE QuipExportTool SHALL display only documents within that folder
3. WHEN THE QuipExportTool receives a DocumentURL with the list command, THE QuipExportTool SHALL display only that single document
4. WHEN THE QuipExportTool receives the list command without a URL, THE QuipExportTool SHALL list all accessible documents as currently implemented

### Requirement 9

**User Story:** As a user previewing exports, I want to provide a URL to preview what will be exported from that specific resource, so that I can verify the export scope before starting.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives the export preview command, THE QuipExportTool SHALL accept an optional URL parameter
2. WHEN THE QuipExportTool receives a URL with the preview command, THE QuipExportTool SHALL display a preview of documents that will be exported from that URL
3. WHEN THE QuipExportTool receives the preview command without a URL, THE QuipExportTool SHALL preview all documents as currently implemented
4. WHEN THE QuipExportTool displays the URL-based preview, THE QuipExportTool SHALL show the folder or document name from the URL

### Requirement 6

**User Story:** As a user exporting a folder by URL, I want to see progress information during the export, so that I know the export is working and how many documents remain.

#### Acceptance Criteria

1. WHEN THE QuipExportTool begins a folder export, THE QuipExportTool SHALL display the total count of documents to be exported
2. WHEN THE QuipExportTool exports each document, THE QuipExportTool SHALL display the current document number and title
3. WHEN THE QuipExportTool completes a document export, THE QuipExportTool SHALL update the progress indicator
4. WHEN THE QuipExportTool completes the folder export, THE QuipExportTool SHALL display the total time elapsed and success rate

### Requirement 7

**User Story:** As a user providing an invalid URL, I want clear error messages, so that I can correct the URL and retry the export.

#### Acceptance Criteria

1. WHEN THE QuipExportTool receives a URL with an invalid format, THE QuipExportTool SHALL display an error message indicating the URL format is invalid
2. WHEN THE QuipExportTool cannot extract a ThreadID from the URL, THE QuipExportTool SHALL display an error message with the expected URL format
3. WHEN THE QuipExportTool receives a ThreadID that does not exist, THE QuipExportTool SHALL display an error message indicating the resource was not found
4. WHEN THE QuipExportTool encounters an authentication error, THE QuipExportTool SHALL display an error message indicating the user needs to authenticate
