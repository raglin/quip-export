# Design Document

## Overview

The Quip Bulk Export tool will be a Node.js command-line application that uses the Quip API to discover, browse, and export documents from Quip to local storage while preserving folder structure. The tool will handle authentication through personal access tokens or OAuth flows, provide an intuitive CLI interface for folder browsing and document selection, and implement robust error handling and progress tracking for bulk exports.

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Interface │    │   Export Core   │    │  Progress Track │
│                 │────│                 │────│                 │
│ - Commands      │    │ - Orchestration │    │ - Status        │
│ - Folder Browse │    │ - Batch Process │    │ - Reporting     │
│ - Doc Selection │    │ - Error Handling│    │ - File Tracking │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Auth Manager    │    │  Quip Service   │    │ Local File Mgr  │
│                 │    │                 │    │                 │
│ - Token Auth    │    │ - API Client    │    │ - Directory Mgr │
│ - OAuth Flows   │    │ - Folder Browse │    │ - File Writer   │
│ - Token Storage │    │ - Doc Discovery │    │ - Path Utils    │
│ - Domain Config │    │ - Export Logic  │    │ - Conflict Res  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components and Interfaces

### 1. CLI Interface (`src/cli/`)
- **Command Parser**: Handles command-line arguments and options for export operations
- **Interactive Prompts**: Guides users through domain configuration, authentication, and export preferences
- **Folder Browser**: Displays user's Quip folder structure (Private, Archive, Starred, Shared folders)
- **Document Selector**: Allows users to select individual documents, entire folders, or multiple folders
- **Export Configuration**: Prompts for output directory, export formats, and batch limits
- **Progress Display**: Shows real-time export progress with current document and folder information

### 2. Authentication Manager (`src/auth/`)
- **OAuth Handler**: Manages OAuth 2.0 flows for Microsoft Graph and optional Quip OAuth
- **Personal Access Token Handler**: Manages simple token-based authentication for Quip
- **Token Storage**: Securely stores and retrieves access tokens and personal access tokens
- **Token Refresh**: Automatically refreshes expired OAuth tokens (personal access tokens don't expire but can be regenerated)

### 3. Quip Service (`src/services/quip/`)
- **API Client**: HTTP client for Quip API interactions
- **Document Discovery**: Lists and filters available documents
- **Export Handler**: Downloads documents in various formats (HTML, PDF, Word)
- **Metadata Extractor**: Captures document metadata and folder structure

### 4. Local File Manager (`src/services/local/`)
- **Directory Manager**: Creates and manages local folder structure mirroring Quip organization
- **File Writer**: Handles writing exported documents to local storage with proper naming
- **Path Utilities**: Manages safe file paths and cross-platform compatibility
- **Conflict Resolver**: Manages naming conflicts and duplicate files with numbering or timestamps

### 5. Export Core (`src/core/`)
- **Export Orchestrator**: Coordinates the entire bulk export process
- **Batch Processor**: Handles documents with rate limiting and API throttling
- **Error Handler**: Manages errors, retries, and graceful failure handling
- **Configuration Manager**: Manages export settings and user preferences

### 6. Progress Tracker (`src/progress/`)
- **Progress Reporter**: Real-time export progress updates and statistics
- **Logger**: Detailed logging for debugging and audit trails
- **Export Reporter**: Creates export summary reports with file locations and statistics
- **File Tracker**: Tracks exported files and folder structure for reporting

## Data Models

### Document Model
```typescript
interface QuipDocument {
  id: string;
  title: string;
  type: 'DOCUMENT' | 'SPREADSHEET' | 'CHAT';
  created_usec: number;
  updated_usec: number;
  author_id: string;
  owning_company_id: string;
  link: string;
  secret_path: string;
  is_template: boolean;
  is_deleted: boolean;
}
```

### Export State Model
```typescript
interface ExportState {
  sessionId: string;
  totalDocuments: number;
  processedDocuments: number;
  successfulExports: number;
  failedExports: number;
  currentDocument?: string;
  currentFolder?: string;
  errors: ExportError[];
  startTime: Date;
  lastUpdateTime: Date;
  outputDirectory: string;
}
```

### Export Configuration Model
```typescript
interface ExportConfig {
  outputDirectory: string;
  exportFormat: 'docx' | 'html' | 'both';
  maxDocuments?: number;
  includeSharedDocuments: boolean;
  includeFolders: string[]; // folder IDs to include
  rateLimitDelay: number;
  retryAttempts: number;
}
```

### Folder Structure Model
```typescript
interface FolderStructure {
  id: string;
  name: string;
  type: 'private' | 'shared' | 'archive' | 'starred' | 'trash';
  documentCount: number;
  children?: FolderStructure[];
  documents?: QuipDocument[];
}
```

### Authentication Configuration Model
```typescript
interface QuipAuthConfig {
  authMethod: 'personal_token' | 'oauth';
  personalAccessToken?: string;
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
  baseUrl: string;
  domain: string; // e.g., 'quip.com', 'quip-enterprise.com'
  platformUrl: string; // e.g., 'https://platform.quip.com', 'https://platform.quip-enterprise.com'
  tokenUrl: string; // e.g., 'https://quip.com/dev/token', 'https://quip-enterprise.com/dev/token'
}

interface AuthenticationState {
  quipAuthMethod: 'personal_token' | 'oauth' | null;
  quipAuthenticated: boolean;
  microsoftAuthenticated: boolean;
  tokenValidated: boolean;
  domainConfigured: boolean;
  configuredDomain?: string;
}
```

## API Integration Details

### Quip API Integration
- **Base URL**: Configurable based on domain (default: `https://platform.quip.com/1/`, custom: `https://platform.{domain}/1/`)
- **Domain Configuration**: 
  - **Default**: `quip.com` (public instance)
  - **Custom**: User-provided domain (e.g., `quip-enterprise.com` for enterprise instances)
  - **URL Construction**: Platform URL built as `https://platform.{domain}` for API calls
- **Authentication**: 
  - **Primary**: Personal Access Token (Bearer token in Authorization header)
  - **Fallback**: OAuth 2.0 flow for enterprise scenarios
- **Personal Access Token**: Generated at domain-specific URL (e.g., https://quip-enterprise.com/dev/token), provides full API access to user's account
- **Endpoints Used**:
  - `GET /1/users/current` - Current user information (for token validation)
  - `GET /1/folders/{id}` - Folder contents and metadata
  - `GET /2/threads/{threadIdOrSecretPath}` - Document metadata (V2)
  - `GET /1/threads/{thread_id}/export/docx` - Document DOCX export (primary)
  - `GET /2/threads/{threadIdOrSecretPath}/html` - Document HTML export (V2, fallback)
  - `GET /1/threads/{thread_id}/export/xlsx` - Spreadsheet XLSX export
  - `GET /1/threads/search` - Search for documents
- **Rate Limiting**: 50 requests per minute per user, 750 requests per hour per user
- **Export Formats**: DOCX (primary for documents), XLSX (for spreadsheets), HTML (fallback)
- **Token Management**: Personal access tokens don't expire but can be regenerated, invalidating previous tokens

### Local File System Integration
- **Directory Management**: Create nested folder structures matching Quip organization
- **File Operations**: Write binary files (DOCX, XLSX) and text files (HTML) to local storage
- **Path Safety**: Sanitize file names for cross-platform compatibility
- **Conflict Resolution**: Handle duplicate file names with automatic numbering
- **Storage Strategy**: Stream large files directly to disk to minimize memory usage

## Error Handling

### Error Categories
1. **Authentication Errors**: 
   - Personal access token invalid or revoked
   - OAuth token expiration and refresh failures
   - Invalid credentials or unauthorized access
2. **API Errors**: Rate limiting, service unavailable, network timeouts
3. **File Errors**: Corrupted downloads, disk space issues, write permissions
4. **Permission Errors**: Insufficient access rights, restricted documents
5. **Local Storage Errors**: Directory creation failures, file system permissions, disk space

### Error Recovery Strategies
- **Exponential Backoff**: For rate limiting and temporary failures
- **Token Refresh**: Automatic token renewal for expired credentials
- **Partial Retry**: Continue export despite individual document failures
- **Graceful Degradation**: Skip problematic documents and continue with remaining exports
- **Directory Recovery**: Attempt to create missing directories and retry file operations

### Logging Strategy
- **Structured Logging**: JSON format for easy parsing and analysis
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Rotation**: Daily rotation with configurable retention
- **Sensitive Data**: Exclude tokens and personal information from logs

## Testing Strategy

### Unit Testing
- **Service Layer**: Mock API responses for Quip and OneDrive services
- **Authentication**: Test OAuth flows with mock providers
- **Data Models**: Validate serialization and validation logic
- **Error Handling**: Test all error scenarios and recovery paths

### Integration Testing
- **API Integration**: Test against Quip API with real authentication
- **End-to-End Flows**: Complete export scenarios with test data
- **Authentication Flows**: Real OAuth flows and personal access token validation
- **File Operations**: Export and local storage with various file types and sizes
- **Folder Structure**: Test folder creation and organization preservation

### Performance Testing
- **Batch Processing**: Test with large document sets (100+ documents)
- **Memory Usage**: Monitor memory consumption during large exports
- **Rate Limiting**: Verify proper handling of Quip API rate limits
- **Disk I/O**: Test local file writing performance with large files
- **Folder Depth**: Test deep folder structures and path length limits

### Security Testing
- **Token Security**: Verify secure token storage and transmission
- **Input Validation**: Test with malformed API responses
- **File Safety**: Validate uploaded file integrity and safety
- **Permission Boundaries**: Ensure proper access control enforcement