# Quip Bulk Export Tool

A command-line tool to export and download your documents from Quip to local storage while preserving folder structure and metadata. Perfect for backing up your Quip documents or preparing them for migration to other cloud services.

## 🚀 Quick Start

### 1. Installation

```bash

# Install globally via npm
npm install -g @anthragz/quip-export

# OR Build locally and link
npm install
npm run build
npm link
```

### 2. First Time Setup

```bash
# Configure your Quip domain and authentication
quip-export setup
```

This interactive setup will guide you through:
- Configuring your Quip domain (e.g., quip.com)
- Testing your connection

### 3. Browse Your Documents

```bash
# Lis documents
quip-export list

```

### 4. Export Your Documents

```bash
# Option 1: Export from a URL (fastest for specific documents/folders)
quip-export export start --url https://quip.com/AbC123XyZ456/Document-Title

# Option 2: Export all documents (requires configuration)
quip-export export configure
quip-export export start
```

## ✨ Key Features

- **🔗 URL-Based Export**: Export specific documents or folders by simply providing their Quip URLs from your browser
- **📅 Automatic Date Prefixing**: Exported filenames are automatically prefixed with the document's last updated date (e.g., `2024-11-20 Meeting Notes.docx`) for easy chronological organization
- **🗂️ Folder Structure Preservation**: Maintains your Quip folder hierarchy in the local export
- **📄 Multiple Export Formats**: Support for native (DOCX/XLSX), HTML, and Markdown formats
- **🔄 Batch Processing**: Efficient bulk export with configurable batch sizes and rate limiting
- **🔒 Secure Authentication**: Uses Quip Personal Access Tokens for secure API access
- **⚡ Resume Capability**: Automatically resumes interrupted exports from where they left off
- **🎯 Flexible Configuration**: Customizable export settings including date formats, output directories, and format-specific options

## 📋 Table of Contents

- [Key Features](#key-features)
- [Installation](#installation)
- [Authentication Setup](#authentication-setup)
- [Usage Guide](#usage-guide)
- [URL-Based Export](#url-based-export)
- [Export Configuration](#export-configuration)
- [Folder Structure](#folder-structure)
- [File Formats](#file-formats)
- [Troubleshooting](#troubleshooting)
- [Cloud Upload Guide](#cloud-upload-guide)
- [Advanced Usage](#advanced-usage)

## 🔧 Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

### Install Options

#### Option 1: Global Installation (Recommended)
```bash
npm install -g ./
quip-exort --help
```

#### Option 2: Local Installation
```bash
npm install ./
npx quip-export --help
```

#### Option 3: From Source
```bash
git clone https://github.com/anthragz/quip-export.git
cd quip-export
npm install
npm run build
npm link
```

## 🔐 Authentication Setup

### Step 1: Run Interactive Setup

The tool supports both public Quip (quip.com) and enterprise instances:

```bash
quip-export setup
```

You'll be prompted for:
- **Quip Domain**: Enter your domain without http:// or trailing / (e.g., `quip.com` or `quip-enterprise.com`)
- **Personal Access Token**: Your Quip API token
- **Export Preferences**: Output directory, format, and other settings

### Step 2: Get Your Personal Access Token

1. **Generate Token**: Visit your domain's token page:
   - Public Quip: https://quip.com/dev/token
   - Enterprise: https://your-domain.com/dev/token

2. **Copy Token**: Click "Generate Token" and copy the generated token

3. **Configure Tool**: Paste the token when prompted during setup 

### Step 3: Verify Authentication

```bash
# Check authentication status
quip-export auth status
```

## 📖 Usage Guide

### Basic Commands

| Command | Description |
|---------|-------------|
| `quip-export setup` | Interactive setup for authentication and export preferences |
| `quip-export auth status` | Check authentication status |
| `quip-export list` | List all accessible documents |
| `quip-export list --url <url>` | List documents from a specific Quip URL |
| `quip-export export configure` | Configure export preferences |
| `quip-export export preview` | Preview what will be exported |
| `quip-export export preview --url <url>` | Preview export from a specific Quip URL |
| `quip-export export start` | Start the export process |
| `quip-export export start --url <url>` | Export from a specific Quip URL |
| `quip-export export check-formats` | Check available export formats and dependencies |
| `quip-export --help` | Show all available commands |

### Browsing Your Documents

#### List Documents
```bash
# List all accessible documents
quip-export list

# List with detailed information
quip-export list --verbose

# List in CSV format
quip-export list --format csv

# Limit results
quip-export list --limit 20
```

The list command displays both created and updated dates for each document:

```
Title                                              Type        Created      Updated      Folder
──────────────────────────────────────────────────────────────────────────────────────────────
Meeting Notes                                      DOCUMENT    2024-01-15   2024-11-20   Private
Project Proposal                                   DOCUMENT    2024-03-10   2024-10-05   Shared
```

#### List Documents from URL
```bash
# List documents from a specific folder URL
quip-export list --url https://quip.com/fNTdOlbHmWrW/Team-Documents

# List a single document by URL
quip-export list --url https://quip.com/AbC123XyZ456/Meeting-Notes

# Combine with other options
quip-export list --url https://quip.com/fNTdOlbHmWrW --verbose
```

### Exporting Documents

#### Basic Export Workflow
```bash
# 1. Configure export preferences
quip-export export configure

# 2. Preview what will be exported
quip-export export preview

# 3. Start the export
quip-export export start
```

The preview command shows the exact filenames that will be created, including date prefixes:

```
1. 📄 Meeting Notes
   Type: DOCUMENT
   Folder: Private
   Updated: 2024-11-20
   Output: exported-documents/Private/2024-11-20 Meeting Notes.docx

2. 📄 Project Proposal
   Type: DOCUMENT
   Folder: Shared
   Updated: 2024-10-05
   Output: exported-documents/Shared/2024-10-05 Project Proposal.docx
```

#### URL-Based Export

Export specific documents or folders directly using their Quip URLs. This is perfect when you want to export a subset of documents without configuring complex filters.

##### Export a Single Document
```bash
# Copy the URL from your browser and export it
quip-export export start --url https://quip.com/AbC123XyZ456/Meeting-Notes
```

##### Export an Entire Folder
```bash
# Export all accessible documents from a folder
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Team-Documents
```

##### Preview Before Exporting
```bash
# Preview what will be exported from a URL
quip-export export preview --url https://quip.com/fNTdOlbHmWrW/Team-Documents

# Then export if it looks good
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Team-Documents
```

##### Supported URL Formats

The tool accepts various Quip URL formats:

```bash
# Standard format with title
https://quip.com/AbC123XyZ456/Document-Title

# Without title
https://quip.com/AbC123XyZ456

# With query parameters (ignored)
https://quip.com/AbC123XyZ456/Document-Title?section=abc

# Enterprise domains
https://quip-company.com/AbC123XyZ456/Document-Title

# Custom domains
https://docs.company.com/AbC123XyZ456
```

##### How to Get a Quip URL

1. Open the document or folder in your web browser
2. Copy the URL from the address bar
3. Paste it into the `--url` parameter

Example workflow:
```bash
# 1. Browse to a folder in Quip: https://quip.com/fNTdOlbHmWrW/Q4-Planning
# 2. Copy the URL
# 3. Export it:
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Q4-Planning
```

##### URL Export Features

- **Automatic Type Detection**: The tool automatically determines if the URL is a document or folder
- **Permission Handling**: Skips documents you don't have access to (in folders) with clear warnings
- **Progress Tracking**: Shows real-time progress for folder exports
- **Folder Structure**: Preserves folder structure when exporting from folder URLs
- **Date Prefixing**: Applies your configured date prefix settings to exported files

## 🔗 URL-Based Export

URL-based export allows you to export specific documents or folders by providing their Quip URLs directly from your web browser. This is the fastest way to export a subset of documents without configuring complex filters or navigating folder structures.

### Quick Start

```bash
# 1. Open a document or folder in your browser
# 2. Copy the URL from the address bar
# 3. Export it:
quip-export export start --url https://quip.com/AbC123XyZ456/Document-Title
```

### Supported URL Formats

The tool accepts Quip URLs in various formats and automatically extracts the thread ID:

| Format | Example | Notes |
|--------|---------|-------|
| Standard with title | `https://quip.com/AbC123XyZ456/Document-Title` | Most common format |
| Without title | `https://quip.com/AbC123XyZ456` | Also valid |
| With query parameters | `https://quip.com/AbC123XyZ456?section=abc` | Query params ignored |
| Enterprise domain | `https://quip-company.com/AbC123XyZ456` | Custom domains supported |
| With path segments | `https://quip.com/AbC123XyZ456/Title/extra` | Only thread ID extracted |

**Thread ID Requirements:**
- Alphanumeric characters only
- Minimum 8 characters (typically 12)
- Case-sensitive
- First path segment after domain

### Use Cases

#### Export a Single Document

Perfect for backing up or sharing a specific document:

```bash
# Copy URL from browser
quip-export export start --url https://quip.com/AbC123XyZ456/Meeting-Notes

# Output:
# 🚀 Starting export from URL: https://quip.com/AbC123XyZ456/Meeting-Notes
# Export scope: URL: https://quip.com/AbC123XyZ456/Meeting-Notes
# ✅ Exported: 2024-11-20 Meeting Notes.docx
```

#### Export an Entire Folder

Export all accessible documents from a folder and its subfolders:

```bash
# Copy folder URL from browser
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Team-Documents

# Output:
# 🚀 Starting export from URL: https://quip.com/fNTdOlbHmWrW/Team-Documents
# Export scope: URL: https://quip.com/fNTdOlbHmWrW/Team-Documents
# 
# Exporting 15 documents...
# [1/15] ✅ 2024-11-20 Meeting Notes.docx
# [2/15] ✅ 2024-11-15 Project Plan.docx
# ...
# [15/15] ✅ 2024-10-01 Archive.docx
# 
# ✅ Export complete! 15 documents exported in 45s
```

#### Preview Before Exporting

Check what will be exported before starting:

```bash
# Preview folder contents
quip-export export preview --url https://quip.com/fNTdOlbHmWrW/Team-Documents

# Output shows:
# - Number of documents
# - Document titles
# - Output paths
# - Folder structure

# Then export if it looks good
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Team-Documents
```

#### List Documents from URL

Browse folder contents without exporting:

```bash
# List all documents in a folder
quip-export list --url https://quip.com/fNTdOlbHmWrW/Team-Documents

# List with details
quip-export list --url https://quip.com/fNTdOlbHmWrW --verbose

# List a single document
quip-export list --url https://quip.com/AbC123XyZ456/Document
```

### How It Works

1. **URL Parsing**: Extracts the thread ID from the URL
2. **Resource Detection**: Determines if it's a document or folder
3. **Permission Check**: Verifies you have access to the resource
4. **Discovery**: 
   - For documents: Prepares single document for export
   - For folders: Discovers all accessible documents recursively
5. **Export**: Uses your configured export settings (format, date prefix, etc.)
6. **Progress**: Shows real-time progress and summary

### Permission Handling

When exporting folders, you may not have access to all documents:

```bash
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Shared-Folder

# Output:
# Exporting 20 documents...
# [1/20] ✅ 2024-11-20 Document 1.docx
# [2/20] ⚠️  Skipped: Document 2 (no access)
# [3/20] ✅ 2024-11-19 Document 3.docx
# ...
# 
# ⚠️  Skipped 3 document(s) due to access permissions
# ✅ Successfully exported 17 documents
```

**Permission Behavior:**
- Documents you can access: Exported normally
- Documents you can't access: Skipped with warning
- Export continues without failing
- Summary shows skipped count

### Combining with Other Options

URL-based export works with other CLI options:

```bash
# Use custom configuration file
quip-export export start --url https://quip.com/AbC123XyZ456 --config ./my-config.json

# Dry run (preview without downloading)
quip-export export start --url https://quip.com/fNTdOlbHmWrW --dry-run

# List with custom format
quip-export list --url https://quip.com/fNTdOlbHmWrW --format csv

# Preview with limit
quip-export export preview --url https://quip.com/fNTdOlbHmWrW --limit 10
```

### Comparison: URL vs Full Export

| Feature | URL-Based Export | Full Export |
|---------|------------------|-------------|
| **Speed** | Fast (specific subset) | Slower (all documents) |
| **Setup** | No configuration needed | Requires filter configuration |
| **Use Case** | Specific documents/folders | Complete backup |
| **Discovery** | Single URL | All accessible documents |
| **Filters** | URL defines scope | Configuration defines scope |
| **Best For** | Ad-hoc exports, sharing | Scheduled backups, migrations |

### Examples by Scenario

#### Scenario 1: Export Project Documentation
```bash
# You're working on a project and want to backup its folder
# 1. Open the project folder in Quip
# 2. Copy URL: https://quip.com/fNTdOlbHmWrW/Q4-Project
# 3. Export:
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Q4-Project
```

#### Scenario 2: Share a Single Document
```bash
# You need to send a document to someone outside Quip
# 1. Open the document in Quip
# 2. Copy URL: https://quip.com/AbC123XyZ456/Proposal
# 3. Export:
quip-export export start --url https://quip.com/AbC123XyZ456/Proposal
# 4. Share the exported file
```

#### Scenario 3: Archive Team Documents
```bash
# Your team is moving to a new platform
# 1. Get the team folder URL: https://quip.com/fNTdOlbHmWrW/Team-Docs
# 2. Preview what will be exported:
quip-export export preview --url https://quip.com/fNTdOlbHmWrW/Team-Docs
# 3. Export everything:
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Team-Docs
```

#### Scenario 4: Verify Access Before Export
```bash
# You want to check what you can access in a shared folder
# 1. List documents first:
quip-export list --url https://quip.com/fNTdOlbHmWrW/Shared --verbose
# 2. Preview export:
quip-export export preview --url https://quip.com/fNTdOlbHmWrW/Shared
# 3. Export if satisfied:
quip-export export start --url https://quip.com/fNTdOlbHmWrW/Shared
```

### Tips and Best Practices

1. **Always Preview First**: Use `export preview --url` to verify what will be exported
2. **Test with List**: Use `list --url` to check access before exporting large folders
3. **Copy from Browser**: Always copy URLs directly from your browser's address bar
4. **Check Permissions**: Expect some documents to be skipped in shared folders
5. **Use Verbose Mode**: Add `--verbose` to see detailed information about skipped documents
6. **Verify in Browser**: If a URL doesn't work, verify it opens correctly in your browser first
7. **Match Domains**: Ensure your configured domain matches the URL's domain

## ⚙️ Export Configuration

### Interactive Configuration

Run the interactive configuration wizard:

```bash
quip-export export configure
```

This will prompt you for:
- **Output Directory**: Where to save exported files (default: `./exported-documents`)
- **Export Format**: Choose from native (DOCX/XLSX), HTML, or Markdown
- **Date Prefix**: Enable/disable date prefixing and choose date format pattern
- **Format-Specific Options**: Additional options for selected format (e.g., markdown image handling)
- **Document Selection**: Include shared documents, preserve folder structure
- **Performance Settings**: Batch size, rate limiting, retry attempts

### Configuration File

The tool creates a `.export-config.json` file with your settings:

```json
{
  "quip": {
    "domain": "quip.com",
    "baseUrl": "https://platform.quip.com",
    "personalAccessToken": "your-token-here"
  },
  "export": {
    "outputDirectory": "./exported-documents",
    "exportFormat": "native",
    "datePrefix": {
      "enabled": true,
      "format": "YYYY-MM-DD"
    },
    "formatSpecificOptions": {
      "markdown": {
        "imageHandling": "separate",
        "preserveComments": false,
        "frontMatter": true
      }
    },
    "includeSharedDocuments": true,
    "preserveFolderStructure": true,
    "batchSize": 10,
    "retryAttempts": 3,
    "rateLimitDelay": 1000
  }
}
```

### Date Prefix Configuration

By default, exported filenames are automatically prefixed with the document's last updated date in ISO 8601 format (YYYY-MM-DD). This provides chronological organization and makes it easy to identify when documents were last modified.

#### Date Prefix Options

- **enabled** (boolean, default: `true`): Enable or disable date prefixing
- **format** (string, default: `"YYYY-MM-DD"`): Date format pattern

#### Supported Date Formats

The date format pattern uses the following tokens:
- `YYYY` - Four-digit year (e.g., 2024)
- `MM` - Two-digit month (01-12)
- `DD` - Two-digit day (01-31)

Common format patterns:
- `YYYY-MM-DD` - ISO 8601 format (default): `2024-11-20 Document Title.docx`
- `YYYY-DD-MM` - Year-day-month format: `2024-20-11 Document Title.docx`
- `MM-DD-YYYY` - US format: `11-20-2024 Document Title.docx`
- `DD-MM-YYYY` - European format: `20-11-2024 Document Title.docx`

#### Example Filenames

With date prefixing enabled (default):
```
2024-11-20 Meeting Notes.docx
2024-10-15 Project Proposal.docx
2023-12-01 Annual Report.docx
```

Without date prefixing (disabled):
```
Meeting Notes.docx
Project Proposal.docx
Annual Report.docx
```

#### Configuring Date Prefix

During interactive configuration:
```bash
quip-export export configure
```

You'll be prompted:
```
📅 Date Prefix Configuration:
Enable date prefix for filenames? (y/n, default: y): y
Date format (YYYY-MM-DD, YYYY-DD-MM, MM-DD-YYYY, DD-MM-YYYY, default: YYYY-MM-DD): YYYY-MM-DD
```

Or manually edit `.export-config.json`:
```json
{
  "export": {
    "datePrefix": {
      "enabled": false,
      "format": "YYYY-MM-DD"
    }
  }
}
```

### Available Export Formats

Check which formats are available on your system:

```bash
quip-export export check-formats
```

Supported formats:
- **native**: Document-appropriate format (DOCX for documents, XLSX for spreadsheets)
- **html**: Universal web format
- **markdown**: Plain text markup (requires pandoc for full support)

## 📁 Folder Structure

The tool preserves your Quip folder organization in the local export. By default, filenames are prefixed with the document's last updated date for easy chronological organization:

```
my-quip-backup/
├── Private/
│   ├── Meeting Notes/
│   │   ├── 2024-01-15 Team Standup.docx
│   │   └── 2024-03-20 Project Review.docx
│   └── Personal Documents/
│       └── 2024-02-10 My Ideas.docx
├── Shared/
│   ├── Company Docs/
│   │   ├── 2024-11-01 Employee Handbook.docx
│   │   └── 2024-10-15 Policies.docx
│   └── Team Projects/
│       └── 2024-11-20 Q4 Planning.docx
├── Starred/
│   └── 2024-09-05 Important Reference.docx
└── Archive/
    └── Old Projects/
        └── 2023-12-01 Legacy Document.docx
```

### Folder Types

- **Private**: Your personal documents
- **Shared**: Documents shared with you or that you've shared
- **Starred**: Documents you've marked as favorites
- **Archive**: Archived documents (if accessible)

## 📄 File Formats

### Native Format (Recommended)
- **Best for**: Documents that will be edited in Microsoft Word or Google Docs
- **Includes**: Full formatting, images, tables, comments
- **File types**: DOCX for documents, XLSX for spreadsheets
- **File size**: Smaller, compressed format
- **Compatibility**: Works with most office applications
  > ℹ️ **Note:** Embedded images in documents are not exported in this format

### HTML Format
- **Best for**: Web viewing, simple archival
- **Includes**: Basic formatting, embedded images
- **File size**: Larger due to embedded media
- **Compatibility**: Opens in any web browser

### Markdown Format
- **Best for**: Version control, plain text editing
- **Includes**: Text content, basic formatting, optional images
- **Requirements**: Pandoc for full conversion support
- **Options**: Configure image handling, comments, front matter
- **Compatibility**: Works with any text editor

## 🔍 Troubleshooting

### Authentication Issues

#### "Invalid token" or "Authentication failed"
```bash
# Check your token status
quip-export auth status

# Regenerate your personal access token
# Visit: https://your-domain.com/dev/token
# Then reconfigure:
quip-export setup
```

#### "Domain not configured" or "Invalid domain"
```bash
# Reconfigure your domain and token
quip-export setup

# Verify domain format (no https://, just the domain like quip.com)
```

### Export Issues

#### "No documents found"
```bash
# Check if you have access to documents
quip-export list

# List with verbose output to see details
quip-export list --verbose

# Check authentication
quip-export auth status
```

#### "Export failed" or "Rate limit exceeded"
```bash
# Reconfigure with higher rate limit delay
quip-export export configure
# When prompted, set rate limit delay to 2000ms or higher

# Reduce batch size in configuration
# Set batch size to 5 or lower during configuration

# Check available disk space
df -h
```

#### "Permission denied" or "Cannot create directory"
```bash
# Check output directory permissions
ls -la ./

# Reconfigure with different output directory
quip-export export configure
# Choose a directory you have write access to

# Create directory manually
mkdir -p ./my-backup
```

### Network Issues

#### "Connection timeout" or "Network error"
```bash
# Check internet connection
ping quip.com

# Check authentication status
quip-export auth status

```

### File System Issues

#### "Filename too long" or "Invalid characters"
- The tool automatically sanitizes filenames
- If issues persist, try a shorter output path
- Check available disk space: `df -h`

#### "Disk full" or "No space left"
```bash
# Check available space
df -h

# Reconfigure with different output directory
quip-export export configure
# Choose a directory on a drive with more space
```

### URL-Based Export Issues

#### "Invalid Quip URL" or "Cannot extract thread ID"
```bash
# Verify the URL format is correct
# Expected formats:
#   https://quip.com/ThreadID/optional-title
#   https://quip.com/ThreadID

# Example of valid URL:
quip-export export start --url https://quip.com/AbC123XyZ456/Document-Title

# Common mistakes:
# ❌ Missing https://
# ❌ Incomplete URL (just the thread ID)
# ❌ URL from a different service
```

#### "Resource not found" or "Thread does not exist"
```bash
# Verify the URL is correct by opening it in your browser first
# Make sure you're logged into Quip in your browser

# Check if you have access to the document/folder
# Try listing it first:
quip-export list --url https://quip.com/AbC123XyZ456

# If the URL works in browser but not in the tool:
# 1. Check your authentication
quip-export auth status

# 2. Verify you're using the correct domain
# The domain in the URL should match your configured domain
```

#### "Skipped documents due to permissions"
```bash
# This is normal when exporting folders with mixed permissions
# The tool will:
# - Export documents you have access to
# - Skip documents you don't have access to
# - Show warnings for skipped documents
# - Display a summary at the end

# Example output:
# ⚠️  Skipped 3 document(s) due to access permissions
# ✅ Successfully exported 15 documents

# To see which documents were skipped:
quip-export export start --url https://quip.com/FolderID --verbose
```

#### "Authentication required" when using URL
```bash
# Make sure you're authenticated
quip-export auth status

# If not authenticated, run setup
quip-export setup

# Verify your token has the necessary permissions
# Visit: https://your-domain.com/dev/token
# Regenerate if needed
```

#### URL works in browser but not in tool
```bash
# 1. Verify domain configuration matches the URL
#    If URL is https://quip-company.com/...
#    Your configured domain should be quip-company.com

# 2. Check authentication for that domain
quip-export auth status

# 3. Reconfigure if needed
quip-export setup

# 4. Test with list command first
quip-export list --url https://your-url-here
```

#### Folder URL exports only some documents
```bash
# This is expected behavior - the tool only exports documents you have access to

# To see what will be exported before starting:
quip-export export preview --url https://quip.com/FolderID

# To see detailed information about skipped documents:
quip-export export start --url https://quip.com/FolderID --verbose

# Note: Subfolders within the folder are also traversed
# All accessible documents in the folder tree will be exported
```

### Common Issues

1. **Authentication Problems**: Regenerate your personal access token
2. **Export Failures**: Check network connection and disk space
3. **Missing Documents**: Verify folder access and permissions
4. **Slow Performance**: Increase rate limit delay or reduce batch size
5. **Invalid URL**: Verify URL format and copy directly from browser
6. **Resource Not Found**: Check URL in browser first and verify authentication
7. **Partial Folder Export**: Normal when you don't have access to all documents in a folder

### Reporting Issues

When reporting issues, include:
- Command used
- Error message
- Operating system
- Node.js version (`node --version`)
- Tool version (`quip-export --version`)

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please see CONTRIBUTING.md for guidelines.