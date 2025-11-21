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
# Configure export
quip-export export configure

# Export documents
quip-export export start
```

## ✨ Key Features

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
| `quip-export export configure` | Configure export preferences |
| `quip-export export preview` | Preview what will be exported |
| `quip-export export start` | Start the export process |
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
### Common Issues

1. **Authentication Problems**: Regenerate your personal access token
2. **Export Failures**: Check network connection and disk space
3. **Missing Documents**: Verify folder access and permissions
4. **Slow Performance**: Increase rate limit delay or reduce batch size

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