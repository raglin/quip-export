# Troubleshooting Guide

This comprehensive guide helps you resolve common issues with the Quip Bulk Export Tool.

## Quick Diagnostics

Before diving into specific issues, run these diagnostic commands:

```bash
# Check tool version and basic functionality
quip-export --version
quip-export --help

# Check authentication status
quip-export auth status

# Test connection to Quip
quip-export auth test

# Check system requirements
node --version  # Should be 16.0+
npm --version   # Should be 7.0+
```

## Authentication Issues

### Issue: "Invalid token" or "Authentication failed"

**Symptoms:**
- Error message: "Authentication failed: Invalid token"
- Cannot access documents or folders
- 401 Unauthorized errors

**Solutions:**

1. **Regenerate Personal Access Token:**
   ```bash
   # Visit your domain's token page
   # Public Quip: https://quip.com/dev/token
   # Enterprise: https://your-domain.com/dev/token
   
   # Reconfigure authentication
   quip-export auth setup
   ```

2. **Check Token Format:**
   - Token should be a long string (40+ characters)
   - No spaces or special characters at beginning/end
   - Copy entire token without truncation

3. **Verify Domain Configuration:**
   ```bash
   quip-export auth status
   # Check if domain matches your Quip instance
   ```

### Issue: "Domain not configured" or "Invalid domain"

**Symptoms:**
- Error: "Domain configuration missing"
- Cannot connect to Quip API
- Wrong API endpoints being used

**Solutions:**

1. **Reconfigure Domain:**
   ```bash
   quip-export auth setup
   # Enter domain without https:// prefix
   # Correct: quip-enterprise.com
   # Incorrect: https://quip-enterprise.com
   ```

2. **Verify Domain Format:**
   - Use just the domain name (e.g., `quip.com`)
   - For enterprise: use your custom domain (e.g., `quip-enterprise.com`)
   - No protocol (http/https) or paths

3. **Test Domain Connectivity:**
   ```bash
   # Test if domain is accessible
   ping your-domain.com
   curl -I https://your-domain.com
   ```

### Issue: "OAuth flow failed" or "Redirect URI mismatch"

**Symptoms:**
- OAuth authentication window closes unexpectedly
- Redirect URI errors
- Cannot complete OAuth flow

**Solutions:**

1. **Use Personal Access Token Instead:**
   ```bash
   quip-export auth setup
   # Choose "Personal Access Token" option
   ```

2. **Check OAuth Configuration:**
   - Verify client ID and secret
   - Ensure redirect URI matches configuration
   - Check OAuth app permissions

## Export Issues

### Issue: "No documents found"

**Symptoms:**
- Export completes but no files created
- Empty folder structure
- "0 documents exported" message

**Solutions:**

1. **Check Document Access:**
   ```bash
   # List all documents to verify access
   quip-export list documents
   
   # Include shared documents
   quip-export list documents --include-shared
   
   # Check specific folders
   quip-export list folders
   ```

2. **Verify Folder Selection:**
   ```bash
   # List available folders
   quip-export list folders
   
   # Export specific folders
   quip-export export --folders "Private,Starred" --output ./test
   ```

3. **Check Permissions:**
   - Ensure you have read access to documents
   - Some documents may be restricted
   - Try exporting a single known document first

### Issue: "Export failed" or "Rate limit exceeded"

**Symptoms:**
- Export stops with rate limit errors
- "Too many requests" messages
- Slow or stalled exports

**Solutions:**

1. **Increase Rate Limiting:**
   ```bash
   # Add delay between requests (milliseconds)
   quip-export export --rate-limit 2000 --output ./backup
   
   # Reduce batch size
   quip-export export --batch-size 10 --output ./backup
   ```

2. **Resume Failed Exports:**
   ```bash
   # Check for resume capability
   quip-export export --resume --output ./backup
   ```

3. **Export in Smaller Batches:**
   ```bash
   # Limit number of documents
   quip-export export --limit 50 --output ./partial-backup
   
   # Export specific folders separately
   quip-export export --folders "Private" --output ./private-backup
   quip-export export --folders "Starred" --output ./starred-backup
   ```

### Issue: "Permission denied" or "Cannot create directory"

**Symptoms:**
- Cannot create output directory
- File write permissions errors
- "EACCES" or "EPERM" errors

**Solutions:**

1. **Check Directory Permissions:**
   ```bash
   # Check current directory permissions
   ls -la ./
   
   # Create directory manually
   mkdir -p ./my-backup
   chmod 755 ./my-backup
   
   # Try export again
   quip-export export --output ./my-backup
   ```

2. **Use Different Output Directory:**
   ```bash
   # Try user home directory
   quip-export export --output ~/Documents/quip-backup
   
   # Try temporary directory
   quip-export export --output /tmp/quip-backup
   ```

3. **Run with Appropriate Permissions:**
   ```bash
   # On Linux/macOS (use carefully)
   sudo quip-export export --output ./backup
   
   # Better: Change ownership
   sudo chown -R $(whoami) ./backup-directory
   ```

## Network Issues

### Issue: "Connection timeout" or "Network error"

**Symptoms:**
- Timeouts during document download
- Network connection errors
- Intermittent failures

**Solutions:**

1. **Check Internet Connection:**
   ```bash
   # Test connectivity to Quip
   ping quip.com
   curl -I https://platform.quip.com
   
   # For enterprise domains
   ping your-domain.com
   curl -I https://platform.your-domain.com
   ```

2. **Increase Timeout Settings:**
   ```bash
   # Increase timeout (milliseconds)
   quip-export export --timeout 30000 --output ./backup
   
   # Add retry attempts
   quip-export export --retry-attempts 5 --output ./backup
   ```

3. **Use Verbose Mode for Debugging:**
   ```bash
   # Enable detailed logging
   quip-export export --verbose --output ./backup
   
   # Save logs to file
   quip-export export --log-file ./export.log --output ./backup
   ```

### Issue: "SSL/TLS certificate errors"

**Symptoms:**
- Certificate validation errors
- SSL handshake failures
- "CERT_UNTRUSTED" errors

**Solutions:**

1. **Update Node.js and npm:**
   ```bash
   # Check versions
   node --version
   npm --version
   
   # Update to latest LTS
   nvm install --lts
   nvm use --lts
   ```

2. **Check Corporate Firewall:**
   ```bash
   # Configure proxy if behind corporate firewall
   npm config set proxy http://proxy.company.com:8080
   npm config set https-proxy http://proxy.company.com:8080
   
   # Set registry
   npm config set registry https://registry.npmjs.org/
   ```

## File System Issues

### Issue: "Filename too long" or "Invalid characters"

**Symptoms:**
- Cannot create files with long names
- Invalid character errors
- File creation failures

**Solutions:**

1. **Use Shorter Output Path:**
   ```bash
   # Use shorter base path
   quip-export export --output ./backup
   
   # Instead of very long paths
   # quip-export export --output ./very/long/path/to/my/quip/document/backup/folder
   ```

2. **Check File System Limits:**
   ```bash
   # Check file system type and limits
   df -T ./
   
   # For Windows: Use shorter paths or enable long path support
   # For Linux/macOS: Usually not an issue
   ```

3. **The Tool Handles This Automatically:**
   - File names are automatically sanitized
   - Long names are truncated with unique identifiers
   - Invalid characters are replaced with safe alternatives

### Issue: "Disk full" or "No space left on device"

**Symptoms:**
- Export stops due to disk space
- "ENOSPC" errors
- Cannot write files

**Solutions:**

1. **Check Available Space:**
   ```bash
   # Check disk space
   df -h
   
   # Check specific directory
   du -sh ./output-directory
   ```

2. **Clean Up Space:**
   ```bash
   # Remove old exports
   rm -rf ./old-backup
   
   # Clean npm cache
   npm cache clean --force
   
   # Clean system temporary files
   # Windows: Disk Cleanup utility
   # macOS: sudo rm -rf /private/var/folders/*/T/*
   # Linux: sudo rm -rf /tmp/*
   ```

3. **Use Different Drive:**
   ```bash
   # Export to external drive or different partition
   quip-export export --output /path/to/larger/drive/backup
   ```

## Performance Issues

### Issue: "Export is very slow"

**Symptoms:**
- Export takes much longer than expected
- High memory usage
- System becomes unresponsive

**Solutions:**

1. **Optimize Export Settings:**
   ```bash
   # Reduce batch size
   quip-export export --batch-size 5 --output ./backup
   
   # Increase delays
   quip-export export --rate-limit 3000 --output ./backup
   
   # Limit concurrent operations
   quip-export export --max-concurrent 2 --output ./backup
   ```

2. **Monitor System Resources:**
   ```bash
   # Check memory usage
   # Windows: Task Manager
   # macOS: Activity Monitor
   # Linux: htop or top
   
   # Check disk I/O
   # Linux: iotop
   # macOS: sudo fs_usage -w -f filesys
   ```

3. **Export in Smaller Chunks:**
   ```bash
   # Export folders separately
   quip-export export --folders "Private" --output ./private
   quip-export export --folders "Starred" --output ./starred
   
   # Use document limits
   quip-export export --limit 100 --output ./batch1
   ```

### Issue: "High memory usage"

**Symptoms:**
- System runs out of memory
- Tool crashes with memory errors
- Other applications become slow

**Solutions:**

1. **Increase Node.js Memory Limit:**
   ```bash
   # Increase memory limit (in MB)
   NODE_OPTIONS="--max-old-space-size=4096" quip-export export --output ./backup
   ```

2. **Process Smaller Batches:**
   ```bash
   # Reduce batch size significantly
   quip-export export --batch-size 1 --output ./backup
   
   # Add delays between documents
   quip-export export --rate-limit 5000 --output ./backup
   ```

## Format-Specific Issues

### Issue: "DOCX export failed" or "Corrupted DOCX files"

**Symptoms:**
- DOCX files won't open
- Export fails for specific documents
- Corrupted file errors

**Solutions:**

1. **Try HTML Format:**
   ```bash
   # Use HTML as fallback
   quip-export export --format html --output ./backup
   
   # Export both formats
   quip-export export --format both --output ./backup
   ```

2. **Check Document Types:**
   ```bash
   # List documents with types
   quip-export list documents --detailed
   
   # Some document types may not support DOCX
   ```

3. **Verify File Integrity:**
   ```bash
   # Check file sizes
   ls -la ./backup/
   
   # Files with 0 bytes indicate export failures
   find ./backup -size 0 -name "*.docx"
   ```

### Issue: "Images missing from exported documents"

**Symptoms:**
- Documents export but images are missing
- Broken image links in HTML
- Empty image placeholders

**Solutions:**

1. **Check Export Format:**
   ```bash
   # DOCX should include embedded images
   quip-export export --format docx --output ./backup
   
   # HTML exports images separately
   quip-export export --format html --output ./backup
   ```

2. **Verify Image Access:**
   - Some images may be restricted or private
   - External images may not be accessible
   - Check original document for image availability

## Configuration Issues

### Issue: "Configuration file not found" or "Invalid configuration"

**Symptoms:**
- Tool cannot find configuration
- Settings not persisting
- Default values always used

**Solutions:**

1. **Recreate Configuration:**
   ```bash
   # Remove old configuration
   rm -f ~/.quip-export-config.json
   
   # Reconfigure
   quip-export auth setup
   ```

2. **Check Configuration Location:**
   ```bash
   # Check home directory
   ls -la ~/.*quip*
   
   # Check current directory
   ls -la ./.quip*
   ```

3. **Manual Configuration:**
   ```bash
   # Create configuration file manually
   cat > ~/.quip-export-config.json << EOF
   {
     "domain": "your-domain.com",
     "authMethod": "personal_token",
     "outputDirectory": "./exports"
   }
   EOF
   ```

## Advanced Troubleshooting

### Enable Debug Logging

```bash
# Enable all debug output
DEBUG=quip-export:* quip-export export --output ./backup

# Enable specific modules
DEBUG=quip-export:auth quip-export auth test
DEBUG=quip-export:export quip-export export --output ./backup

# Save debug output to file
DEBUG=quip-export:* quip-export export --output ./backup 2> debug.log
```

### Network Debugging

```bash
# Trace network requests (Linux/macOS)
strace -e trace=network quip-export export --output ./backup

# Use curl to test API endpoints manually
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://platform.quip.com/1/users/current

# Test with verbose curl
curl -v -H "Authorization: Bearer YOUR_TOKEN" \
     https://platform.your-domain.com/1/users/current
```

### System Information for Bug Reports

When reporting issues, include this information:

```bash
# System information
uname -a                    # Operating system
node --version             # Node.js version
npm --version              # npm version
quip-export --version      # Tool version

# Environment
echo $PATH                 # PATH variable
npm config list           # npm configuration
env | grep -i proxy       # Proxy settings

# Disk space
df -h                     # Available disk space
du -sh ./output-dir       # Export directory size
```

## Getting Additional Help

### Before Asking for Help

1. **Search existing issues** on GitHub
2. **Check the FAQ** section in README
3. **Try the solutions** in this troubleshooting guide
4. **Gather system information** as shown above

### When Creating an Issue

Include:
- **Exact command used**
- **Complete error message**
- **System information** (OS, Node.js version, tool version)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Any relevant logs** or debug output

### Community Resources

- **GitHub Issues**: Report bugs and get help
- **Documentation**: Check README and docs folder
- **Stack Overflow**: Tag questions with `quip-bulk-export`

### Emergency Workarounds

If you need to export urgently and the tool isn't working:

1. **Manual Export**: Use Quip's built-in export for individual documents
2. **Browser Automation**: Use tools like Puppeteer to automate browser-based export
3. **API Scripts**: Write custom scripts using Quip API directly
4. **Alternative Tools**: Look for other Quip export solutions

Remember: This tool is designed to be robust, but complex integrations can have issues. Most problems have solutions, and the community is here to help!