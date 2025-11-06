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
- Choosing authentication method (Personal Access Token recommended)
- Testing your connection

### 3. Browse Your Documents

```bash
# View your folder structure
quip-export list folders

# View documents in a specific folder
quip-export list documents --folder "Private"
```

### 4. Export Your Documents

```bash
# Export all documents to local storage
quip-export export --output ./my-quip-backup

# Export specific folders only
quip-export export --folders "Private,Starred" --output ./my-documents

# Test with a few documents first
quip-export export --limit 5 --output ./test-export
```

## 📋 Table of Contents

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

- Node.js 16 or higher
- npm or yarn package manager

### Install Options

#### Option 1: Global Installation (Recommended)
```bash
npm install -g quip-export
```

#### Option 2: Local Installation
```bash
npm install quip-export
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

### Step 1: Configure Your Quip Domain

The tool supports both public Quip (quip.com) and enterprise instances:

```bash
quip-export auth setup
```

You'll be prompted for:
- **Quip Domain**: Enter your domain (e.g., `quip.com`)
- **Authentication Method**: Choose Personal Access Token (recommended) or OAuth

### Step 2: Get Your Personal Access Token (Recommended)

1. **Generate Token**: Visit your domain's token page:
   - Public Quip: https://quip.com/dev/token
   - Enterprise: https://your-domain.com/dev/token

2. **Copy Token**: Copy the generated token

3. **Configure Tool**: Paste the token when prompted during setup

### Step 3: Verify Authentication

```bash
# Check authentication status
quip-export auth status

# Test connection
quip-export auth test
```

## 📖 Usage Guide

### Basic Commands

| Command | Description |
|---------|-------------|
| `quip-export auth setup` | Interactive authentication setup |
| `quip-export auth status` | Check authentication status |
| `quip-export list folders` | View your folder structure |
| `quip-export list documents` | List all documents |
| `quip-export export` | Export documents to local storage |
| `quip-export --help` | Show all available commands |

### Browsing Your Documents

#### View Folder Structure
```bash
# Show all folders with document counts
quip-export list folders

# Show detailed folder information
quip-export list folders --detailed
```

#### List Documents
```bash
# List all documents
quip-export list documents

# List documents in specific folders
quip-export list documents --folder "Private"
quip-export list documents --folder "Shared"

# List with metadata
quip-export list documents --detailed
```

### Exporting Documents

#### Basic Export
```bash
# Export all documents
quip-export export --output ./my-quip-backup

# Export with progress display
quip-export export --output ./backup --verbose
```

#### Selective Export
```bash
# Export specific folders
quip-export export --folders "Private,Starred" --output ./documents

# Export with document limit (for testing)
quip-export export --limit 10 --output ./test

# Export excluding shared documents
quip-export export --exclude-shared --output ./private-docs
```

#### Format Options
```bash
# Export as DOCX (default)
quip-export export --format docx --output ./docx-export

# Export as HTML
quip-export export --format html --output ./html-export

# Export in both formats
quip-export export --format both --output ./complete-export
```

## ⚙️ Export Configuration

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <path>` | Output directory for exported files | `./quip-export` |
| `--format <type>` | Export format: `docx`, `html`, `both` | `docx` |
| `--folders <list>` | Comma-separated folder names to export | All folders |
| `--limit <number>` | Maximum number of documents to export | No limit |
| `--exclude-shared` | Skip shared documents | Include all |
| `--rate-limit <ms>` | Delay between API calls (milliseconds) | 1000 |
| `--retry-attempts <num>` | Number of retry attempts for failed exports | 3 |
| `--verbose` | Show detailed progress information | false |

### Configuration File

Create a `.quip-export-config.json` file in your project directory:

```json
{
  "outputDirectory": "./my-exports",
  "exportFormat": "docx",
  "maxDocuments": 100,
  "includeSharedDocuments": true,
  "rateLimitDelay": 1000,
  "retryAttempts": 3,
  "includeFolders": ["Private", "Starred"]
}
```

## 📁 Folder Structure

The tool preserves your Quip folder organization in the local export:

```
my-quip-backup/
├── Private/
│   ├── Meeting Notes/
│   │   ├── Team Standup - 2024-01-15.docx
│   │   └── Project Review.docx
│   └── Personal Documents/
│       └── My Ideas.docx
├── Shared/
│   ├── Company Docs/
│   │   ├── Employee Handbook.docx
│   │   └── Policies.docx
│   └── Team Projects/
│       └── Q4 Planning.docx
├── Starred/
│   └── Important Reference.docx
└── Archive/
    └── Old Projects/
        └── Legacy Document.docx
```

### Folder Types

- **Private**: Your personal documents
- **Shared**: Documents shared with you or that you've shared
- **Starred**: Documents you've marked as favorites
- **Archive**: Archived documents (if accessible)

## 📄 File Formats

### DOCX Format (Recommended)
- **Best for**: Documents that will be edited in Microsoft Word or Google Docs
- **Includes**: Full formatting, images, tables, comments
- **File size**: Smaller, compressed format
- **Compatibility**: Works with most word processors

### HTML Format
- **Best for**: Web viewing, simple archival
- **Includes**: Basic formatting, embedded images
- **File size**: Larger due to embedded media
- **Compatibility**: Opens in any web browser

### Both Formats
- **Best for**: Maximum compatibility and backup
- **Result**: Creates both DOCX and HTML versions of each document
- **File size**: Largest option but most flexible

## 🔍 Troubleshooting

### Authentication Issues

#### "Invalid token" or "Authentication failed"
```bash
# Check your token status
quip-export auth status

# Regenerate your personal access token
# Visit: https://your-domain.com/dev/token
# Then reconfigure:
quip-export auth setup
```

#### "Domain not configured" or "Invalid domain"
```bash
# Reconfigure your domain
quip-export auth setup

# Verify domain format (no https://, just the domain)
```

### Export Issues

#### "No documents found"
```bash
# Check if you have access to documents
quip-export list documents

# Try including shared documents
quip-export list documents --include-shared

# Verify folder names
quip-export list folders
```

#### "Export failed" or "Rate limit exceeded"
```bash
# Increase rate limit delay
quip-export export --rate-limit 2000 --output ./backup

# Reduce batch size
quip-export export --limit 50 --output ./partial-backup

# Check available disk space
df -h
```

#### "Permission denied" or "Cannot create directory"
```bash
# Check output directory permissions
ls -la ./

# Try a different output directory
quip-export export --output ~/Documents/quip-backup

# Create directory manually
mkdir -p ./my-backup
quip-export export --output ./my-backup
```

### Network Issues

#### "Connection timeout" or "Network error"
```bash
# Check internet connection
ping quip.com

# Try with increased timeout
quip-export export --timeout 30000 --output ./backup

# Use verbose mode to see detailed errors
quip-export export --verbose --output ./backup
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

# Clean up space or choose different output directory
quip-export export --output /path/to/larger/drive/backup
```

## ☁️ Cloud Upload Guide

After exporting your documents locally, you can upload them to any cloud service:

### Microsoft OneDrive

#### Option 1: OneDrive Desktop App
1. Install OneDrive desktop application
2. Copy exported folder to your OneDrive folder
3. Wait for automatic sync

#### Option 2: Web Upload
1. Go to [onedrive.live.com](https://onedrive.live.com)
2. Click "Upload" → "Folder"
3. Select your exported folder

#### Option 3: Command Line (Advanced)
```bash
# Install OneDrive CLI tool
npm install -g onedrive-cli

# Upload folder
onedrive upload ./my-quip-backup /Documents/QuipBackup
```

### Google Drive

#### Option 1: Google Drive Desktop App
1. Install Google Drive desktop application
2. Copy exported folder to your Google Drive folder
3. Wait for automatic sync

#### Option 2: Web Upload
1. Go to [drive.google.com](https://drive.google.com)
2. Click "New" → "Folder upload"
3. Select your exported folder

#### Option 3: Command Line (Advanced)
```bash
# Install gdrive CLI tool
# Follow installation instructions at: https://github.com/prasmussen/gdrive

# Upload folder
gdrive upload -r ./my-quip-backup
```

### Dropbox

#### Option 1: Dropbox Desktop App
1. Install Dropbox desktop application
2. Copy exported folder to your Dropbox folder
3. Wait for automatic sync

#### Option 2: Web Upload
1. Go to [dropbox.com](https://dropbox.com)
2. Click "Upload" → "Folder"
3. Select your exported folder

### Other Cloud Services

Most cloud services support folder upload through:
- **Desktop applications**: Drag and drop to sync folder
- **Web interfaces**: Upload folder option
- **Command line tools**: Service-specific CLI tools

## 🔧 Advanced Usage

### Batch Processing

For large document sets, use batch processing options:

```bash
# Process in smaller batches
quip-export export --batch-size 25 --output ./backup

# Add delays between batches
quip-export export --batch-delay 5000 --output ./backup

# Resume interrupted exports
quip-export export --resume --session-id abc123 --output ./backup
```

### Custom Scripts

Create custom export scripts for repeated use:

```bash
#!/bin/bash
# export-script.sh

# Export private documents only
quip-export export \
  --folders "Private" \
  --format docx \
  --output "./backups/$(date +%Y-%m-%d)" \
  --verbose

# Upload to cloud (example with rclone)
rclone copy "./backups/$(date +%Y-%m-%d)" "onedrive:QuipBackups/"
```

### Environment Variables

Set environment variables for automation:

```bash
export QUIP_DOMAIN="quip.com"
export QUIP_TOKEN="your-personal-access-token"
export QUIP_OUTPUT_DIR="./automated-backups"

quip-export export --output "$QUIP_OUTPUT_DIR"
```

### Logging and Monitoring

Enable detailed logging for troubleshooting:

```bash
# Enable debug logging
DEBUG=quip-export:* quip-export export --output ./backup

# Save logs to file
quip-export export --output ./backup --log-file ./export.log

# Monitor progress with JSON output
quip-export export --output ./backup --json > progress.json
```

## 📞 Support

### Getting Help

```bash
# General help
quip-export --help

# Command-specific help
quip-export export --help
quip-export auth --help

# Version information
quip-export --version
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