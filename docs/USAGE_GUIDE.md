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
npm install -g quip-bulk-export

# 2. Verify installation
quip-export --version

# 3. Run interactive setup
quip-export auth setup
```

**Interactive Setup Process:**
1. **Domain Configuration**: Enter your Quip domain (e.g., `quip.com`, `quip-enterprise.com`)
2. **Authentication Method**: Choose Personal Access Token (recommended) or OAuth
3. **Token Input**: Paste your personal access token
4. **Verification**: Tool tests connection and confirms access

### Quick Start Example

```bash
# Complete workflow for first-time users
quip-export auth setup          # Configure authentication
quip-export list folders        # Browse your folder structure
quip-export export --limit 5 --output ./test-export  # Test with 5 documents
quip-export export --output ./full-backup            # Export everything
```

## Authentication Workflows

### Personal Access Token (Recommended)

**Step 1: Generate Token**
```bash
# The tool will provide the correct URL during setup
# For public Quip: https://quip.com/dev/token
# For enterprise: https://your-domain.com/dev/token
```

**Step 2: Configure Tool**
```bash
quip-export auth setup
# Choose "Personal Access Token"
# Enter your domain (e.g., quip-enterprise.com)
# Paste the token when prompted
```

**Step 3: Verify Authentication**
```bash
# Check authentication status
quip-export auth status

# Test connection
quip-export auth test
```

### OAuth Flow (Alternative)

```bash
quip-export auth setup
# Choose "OAuth Flow"
# Follow browser prompts
# Complete authorization
```

### Managing Multiple Domains

```bash
# Switch between different Quip instances
quip-export auth setup --profile work
quip-export auth setup --profile personal

# Use specific profile
quip-export --profile work list folders
quip-export --profile personal export --output ./personal-backup
```

## Browsing and Discovery

### Exploring Your Folder Structure

```bash
# View all folders with document counts
quip-export list folders

# Example output:
# Private (45 documents)
# ├── Meeting Notes (12 documents)
# ├── Personal Projects (8 documents)
# └── Draft Documents (25 documents)
# Shared (23 documents)
# ├── Team Documents (15 documents)
# └── Company Policies (8 documents)
# Starred (7 documents)
# Archive (156 documents)
```

### Listing Documents

```bash
# List all documents
quip-export list documents

# List documents in specific folder
quip-export list documents --folder "Private"

# List with detailed metadata
quip-export list documents --detailed

# Example detailed output:
# Private/Meeting Notes/
#   - Team Standup - 2024-01-15.docx (Modified: 2024-01-15, Author: john.doe)
#   - Project Review Meeting.docx (Modified: 2024-01-10, Author: jane.smith)
```

### Filtering and Searching

```bash
# List only shared documents
quip-export list documents --shared-only

# List documents modified after specific date
quip-export list documents --modified-after 2024-01-01

# List documents by author
quip-export list documents --author john.doe

# Search documents by title
quip-export list documents --search "meeting notes"
```

## Export Workflows

### Basic Export Examples

#### Export Everything
```bash
# Export all documents to default location
quip-export export

# Export all documents to specific location
quip-export export --output ./my-quip-backup

# Export with verbose progress
quip-export export --output ./backup --verbose
```

#### Selective Exports
```bash
# Export specific folders
quip-export export --folders "Private,Starred" --output ./important-docs

# Export excluding shared documents
quip-export export --exclude-shared --output ./private-only

# Export with document limit (for testing)
quip-export export --limit 10 --output ./test-export
```

### Format-Specific Exports

```bash
# Export as DOCX (default, best for editing)
quip-export export --format docx --output ./docx-export

# Export as HTML (good for web viewing)
quip-export export --format html --output ./html-export

# Export in both formats
quip-export export --format both --output ./complete-export
```

### Advanced Export Options

```bash
# Export with custom rate limiting
quip-export export \
  --rate-limit 2000 \
  --retry-attempts 5 \
  --timeout 30000 \
  --output ./robust-export

# Export with batch processing
quip-export export \
  --batch-size 10 \
  --batch-delay 5000 \
  --max-concurrent 2 \
  --output ./batch-export

# Export with detailed logging
quip-export export \
  --verbose \
  --log-file ./export.log \
  --output ./logged-export
```

## Advanced Usage

### Configuration Files

Create `.quip-export-config.json` for repeated use:

```json
{
  "domain": "quip-enterprise.com",
  "authMethod": "personal_token",
  "outputDirectory": "./daily-backups",
  "exportFormat": "docx",
  "maxDocuments": 1000,
  "includeSharedDocuments": true,
  "rateLimitDelay": 1000,
  "retryAttempts": 3,
  "includeFolders": ["Private", "Starred"],
  "excludeFolders": ["Archive"],
  "batchSize": 25,
  "verbose": true
}
```

Use configuration file:
```bash
# Tool automatically loads .quip-export-config.json from current directory
quip-export export

# Or specify config file location
quip-export export --config ./my-config.json
```

### Environment Variables

```bash
# Set environment variables for automation
export QUIP_DOMAIN="quip-enterprise.com"
export QUIP_TOKEN="your-personal-access-token"
export QUIP_OUTPUT_DIR="./automated-backups"

# Run export using environment variables
quip-export export --output "$QUIP_OUTPUT_DIR"
```

### Resume Interrupted Exports

```bash
# Start export with session tracking
quip-export export --session-id backup-20240115 --output ./backup

# If interrupted, resume using same session ID
quip-export export --resume --session-id backup-20240115 --output ./backup

# Check session status
quip-export status --session-id backup-20240115
```

## Automation and Scripting

### Daily Backup Script

```bash
#!/bin/bash
# daily-backup.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="./backups/$DATE"
LOG_FILE="./logs/backup-$DATE.log"

echo "Starting daily Quip backup for $DATE" | tee -a "$LOG_FILE"

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "./logs"

# Export documents
quip-export export \
  --output "$BACKUP_DIR" \
  --format docx \
  --verbose \
  --log-file "$LOG_FILE" \
  --folders "Private,Starred"

# Check if export was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully" | tee -a "$LOG_FILE"
    
    # Optional: Upload to cloud storage
    rclone copy "$BACKUP_DIR" "onedrive:QuipBackups/$DATE"
    
    # Optional: Clean up old backups (keep last 30 days)
    find ./backups -type d -mtime +30 -exec rm -rf {} \;
else
    echo "Backup failed" | tee -a "$LOG_FILE"
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

# Export everything
quip-export export \
  --output "$BACKUP_DIR" \
  --format both \
  --include-shared \
  --verbose

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
$LogFile = ".\logs\backup-$Date.log"

Write-Host "Starting Quip backup for $Date"

# Create directories
New-Item -ItemType Directory -Force -Path $BackupDir
New-Item -ItemType Directory -Force -Path ".\logs"

# Run export
& quip-export export --output $BackupDir --format docx --verbose --log-file $LogFile

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

## Best Practices

### Planning Your Export Strategy

1. **Assess Your Data:**
   ```bash
   # Get overview of your documents
   quip-export list folders
   quip-export list documents --detailed | wc -l
   ```

2. **Test First:**
   ```bash
   # Always test with small batch first
   quip-export export --limit 5 --output ./test
   ```

3. **Plan Storage:**
   ```bash
   # Estimate storage needs (rough calculation)
   # DOCX: ~50KB per page average
   # HTML: ~100KB per page average
   # Plan for 2-3x estimated size for safety
   ```

### Performance Optimization

```bash
# For large exports (1000+ documents)
quip-export export \
  --batch-size 20 \
  --rate-limit 1500 \
  --max-concurrent 3 \
  --output ./large-export

# For slow networks
quip-export export \
  --rate-limit 3000 \
  --timeout 60000 \
  --retry-attempts 5 \
  --output ./slow-network-export

# For fast networks and systems
quip-export export \
  --batch-size 50 \
  --rate-limit 500 \
  --max-concurrent 8 \
  --output ./fast-export
```

### Error Handling and Recovery

```bash
# Export with comprehensive error handling
quip-export export \
  --output ./backup \
  --continue-on-error \
  --error-log ./errors.log \
  --retry-failed \
  --verbose

# Check for failed exports
grep "FAILED" ./errors.log

# Retry only failed documents
quip-export retry --error-log ./errors.log --output ./backup
```

### Monitoring and Logging

```bash
# Enable comprehensive logging
DEBUG=quip-export:* quip-export export \
  --output ./backup \
  --log-file ./detailed.log \
  --json-output ./progress.json

# Monitor progress in real-time
tail -f ./detailed.log

# Parse JSON progress for automation
jq '.progress.percentage' ./progress.json
```

### Security Best Practices

1. **Token Management:**
   ```bash
   # Store tokens securely
   export QUIP_TOKEN=$(security find-generic-password -s "quip-token" -w)
   
   # Or use encrypted files
   gpg --decrypt ~/.quip-token.gpg | quip-export auth setup --token-stdin
   ```

2. **Access Control:**
   ```bash
   # Set restrictive permissions on export directories
   chmod 700 ./backup-directory
   
   # Use temporary directories for sensitive exports
   TEMP_DIR=$(mktemp -d)
   quip-export export --output "$TEMP_DIR"
   # Process files...
   rm -rf "$TEMP_DIR"
   ```

3. **Audit Trail:**
   ```bash
   # Log all export activities
   quip-export export \
     --output ./backup \
     --audit-log ./audit.log \
     --include-metadata
   ```

### Maintenance and Cleanup

```bash
# Regular maintenance script
#!/bin/bash

# Clean old logs (keep 90 days)
find ./logs -name "*.log" -mtime +90 -delete

# Clean old backups (keep 30 days)
find ./backups -type d -mtime +30 -exec rm -rf {} \;

# Verify recent backups
for backup in $(find ./backups -type d -mtime -7); do
    echo "Verifying $backup..."
    find "$backup" -name "*.docx" | wc -l
done

# Update tool
npm update -g quip-bulk-export
```

This usage guide provides comprehensive examples for all common scenarios. Adapt the examples to your specific needs and environment.