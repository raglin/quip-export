# Usage Guide

This comprehensive guide provides detailed examples and workflows for using the Quip Bulk Export Tool effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication Workflows](#authentication-workflows)
- [Browsing and Discovery](#browsing-and-discovery)
- [Export Workflows](#export-workflows)
- [Advanced Usage](#advanced-usage)
- [Automation and Scripting](#automation-and-scripting)
- [Best Practices](#best-practices)

## Getting Started

### First-Time Setup Workflow

```bash
# 1. Install the tool
npm install -g quip-export

# 2. Verify installation
quip-export --version

# 3. Run interactive setup
quip-export setup
```

**Interactive Setup Process:**
1. **Domain Configuration**: Enter your Quip domain (e.g., `quip.com`, `quip-enterprise.com`)
2. **Token Input**: Paste your personal access token
3. **Export Preferences**: Configure output directory, format, and other settings
4. **Verification**: Tool tests connection and confirms access

### Quick Start Example

```bash
# Complete workflow for first-time users
quip-export setup                    # Configure authentication and preferences
quip-export list                     # Browse your documents
quip-export list --limit 5           # View first 5 documents
quip-export export preview           # Preview what will be exported
quip-export export start             # Start the export process
```

## Authentication Workflows

### Personal Access Token Authentication

**Step 1: Generate Token**
```bash
# The tool will provide the correct URL during setup
# For public Quip: https://quip.com/dev/token
# For enterprise: https://your-domain.com/dev/token
```

**Step 2: Configure Tool**
```bash
quip-export setup
# Enter your domain (e.g., quip-enterprise.com)
# Paste the token when prompted (input will be masked)
# Configure export preferences
```

**Step 3: Verify Authentication**
```bash
# Check authentication status
quip-export auth status

# Test connection
quip-export auth login
```

## Browsing and Discovery

### Listing Documents

```bash
# List all accessible documents
quip-export list

# List with detailed information
quip-export list --verbose

# List in different formats
quip-export list --format table    # Default table view
quip-export list --format csv      # CSV format
quip-export list --format json     # JSON format

# Limit results
quip-export list --limit 20

# Example output:
# 📋 Documents:
# ────────────────────────────────────────────────────────────
# Title                          Type        Created      Folder
# ────────────────────────────────────────────────────────────
# Team Standup - 2024-01-15     DOCUMENT    2024-01-15   Private/Meeting Notes
# Project Review Meeting        DOCUMENT    2024-01-10   Private/Meeting Notes
# Q4 Planning                   DOCUMENT    2024-01-08   Shared/Team Projects
```

## Export Workflows

### Basic Export Workflow

#### Configure Export Settings
```bash
# Run interactive configuration
quip-export export configure

# This will prompt you for:
# - Output directory
# - Export format (native/HTML/markdown)
# - Format-specific options
# - Document selection preferences
# - Performance settings
```

#### Preview Export
```bash
# Preview what will be exported
quip-export export preview

# Preview with custom limit
quip-export export preview --limit 10
```

#### Start Export
```bash
# Start the export process
quip-export export start

# Dry run (preview without downloading)
quip-export export start --dry-run
```

### Format-Specific Configuration

During `quip-export export configure`, you can choose:

**Native Format** (Recommended)
- DOCX for documents
- XLSX for spreadsheets
- Best for editing in Microsoft Office or Google Docs

**HTML Format**
- Universal web format
- Good for viewing and archival
- Works in any browser

**Markdown Format**
- Plain text markup
- Version control friendly
- Requires pandoc for full support
- Configure image handling, comments, front matter

## Advanced Usage

### Configuration Files

The tool creates `.export-config.json` when you run `quip-export setup` or `quip-export export configure`:

```json
{
  "quip": {
    "domain": "quip-enterprise.com",
    "baseUrl": "https://platform.quip-enterprise.com",
    "personalAccessToken": "your-token-here"
  },
  "export": {
    "outputDirectory": "./exported-documents",
    "exportFormat": "native",
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

Use configuration file:
```bash
# Tool automatically loads .export-config.json from current directory
quip-export export start

# Or specify config file location
quip-export export start --config ./my-config.json
```

### Check Export Formats

```bash
# Check which formats are available on your system
quip-export export check-formats

# This shows:
# - Available formats (native, HTML, markdown)
# - Required dependencies (e.g., pandoc for markdown)
# - Installation instructions for missing dependencies
```

## Automation and Scripting

### Daily Backup Script

```bash
#!/bin/bash
# daily-backup.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="./backups/$DATE"

echo "Starting daily Quip backup for $DATE"

# Update configuration with new output directory
# (Edit .export-config.json to set outputDirectory to $BACKUP_DIR)
# Or use jq to update programmatically:
jq ".export.outputDirectory = \"$BACKUP_DIR\"" .export-config.json > .export-config.tmp.json
mv .export-config.tmp.json .export-config.json

# Run export
quip-export export start

# Check if export was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
    
    # Optional: Upload to cloud storage
    rclone copy "$BACKUP_DIR" "onedrive:QuipBackups/$DATE"
    
    # Optional: Clean up old backups (keep last 30 days)
    find ./backups -type d -mtime +30 -exec rm -rf {} \;
else
    echo "Backup failed"
    exit 1
fi
```

### Weekly Full Backup Script

```bash
#!/bin/bash
# weekly-backup.sh

WEEK=$(date +%Y-W%U)
BACKUP_DIR="./weekly-backups/$WEEK"

echo "Starting weekly full backup for $WEEK"

# Update configuration for weekly backup
jq ".export.outputDirectory = \"$BACKUP_DIR\" | .export.includeSharedDocuments = true" \
   .export-config.json > .export-config.tmp.json
mv .export-config.tmp.json .export-config.json

# Run export
quip-export export start

# Create archive
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"

# Upload to multiple cloud services for redundancy
rclone copy "$BACKUP_DIR.tar.gz" "onedrive:QuipArchives/"
rclone copy "$BACKUP_DIR.tar.gz" "gdrive:QuipArchives/"

echo "Weekly backup completed: $BACKUP_DIR.tar.gz"
```

### PowerShell Automation (Windows)

```powershell
# backup-quip.ps1

$Date = Get-Date -Format "yyyy-MM-dd"
$BackupDir = ".\backups\$Date"

Write-Host "Starting Quip backup for $Date"

# Update configuration
$config = Get-Content .export-config.json | ConvertFrom-Json
$config.export.outputDirectory = $BackupDir
$config | ConvertTo-Json -Depth 10 | Set-Content .export-config.json

# Run export
& quip-export export start

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully"
    
    # Upload to OneDrive
    & rclone copy $BackupDir "onedrive:QuipBackups\$Date"
    
    # Clean up old backups
    Get-ChildItem ".\backups" | Where-Object {$_.CreationTime -lt (Get-Date).AddDays(-30)} | Remove-Item -Recurse -Force
} else {
    Write-Error "Backup failed"
    exit 1
}
```

### Cron Job Setup (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/daily-backup.sh >> /path/to/cron.log 2>&1

# Add weekly backup on Sundays at 3 AM
0 3 * * 0 /path/to/weekly-backup.sh >> /path/to/cron.log 2>&1

# Add monthly full archive on 1st of each month at 4 AM
0 4 1 * * /path/to/monthly-archive.sh >> /path/to/cron.log 2>&1
```

### Task Scheduler Setup (Windows)

```powershell
# Create scheduled task for daily backup
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\backup-quip.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount

Register-ScheduledTask -TaskName "QuipDailyBackup" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal
```

This usage guide provides examples for common scenarios. These are not tested are AI-generated. Adapt the examples to your specific needs and environment.