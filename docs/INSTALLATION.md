# Installation Guide

This guide provides detailed installation instructions for the Quip Bulk Export Tool across different platforms and environments.

## System Requirements

### Minimum Requirements
- **Node.js**: Version 16.0 or higher
- **npm**: Version 7.0 or higher (comes with Node.js)
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Memory**: 512 MB RAM minimum, 2 GB recommended for large exports
- **Storage**: 100 MB for tool installation, plus space for exported documents

### Recommended Requirements
- **Node.js**: Version 18.0 or higher (LTS)
- **Memory**: 4 GB RAM for optimal performance
- **Storage**: SSD with sufficient space for your document exports

## Installation Methods

### Method 1: Global Installation via npm (Recommended)

This is the easiest method for most users:

```bash
# Install globally
npm install -g quip-export

# Verify installation
quip-export --version

# Get help
quip-export --help
```

**Advantages:**
- Available from any directory
- Simple command: `quip-export`
- Automatic updates with `npm update -g quip-export`

### Method 2: Local Installation via npm

Install in a specific project directory:

```bash
# Create project directory
mkdir quip-export-project
cd quip-export-project

# Install locally
npm install quip-export

# Run with npx
npx quip-export --help

# Or add to package.json scripts
echo '{"scripts": {"export": "quip-export"}}' > package.json
npm run export -- --help
```

**Advantages:**
- Isolated installation
- Version control per project
- No global permissions needed

### Method 3: Direct Download and Install

For environments without npm access:

```bash
# Download source
git clone https://github.com/anthragz/quip-export.git
cd quip-export

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link

# Or run directly
node dist/cli/index.js --help
```

### Method 4: Using npx (No Installation)

Run without installing:

```bash
# Run directly with npx
npx quip-export --help

# Export documents
npx quip-export export --output ./my-backup
```

**Advantages:**
- No installation required
- Always uses latest version
- Good for one-time use

## Platform-Specific Instructions

### Windows

#### Prerequisites
1. **Install Node.js**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose LTS version
   - Run installer with default settings

2. **Verify Installation**:
   ```cmd
   node --version
   npm --version
   ```

#### Installation
```cmd
# Open Command Prompt or PowerShell as Administrator
npm install -g quip-export

# Verify
quip-export --version
```

#### Common Windows Issues

**Issue**: `'quip-export' is not recognized`
```cmd
# Check npm global path
npm config get prefix

# Add to PATH if needed (replace with your npm prefix)
setx PATH "%PATH%;C:\Users\YourName\AppData\Roaming\npm"

# Restart Command Prompt
```

**Issue**: Permission errors
```cmd
# Run as Administrator or use local installation
npm install quip-export
npx quip-export --help
```

### macOS

#### Prerequisites
1. **Install Node.js**:
   ```bash
   # Option 1: Download from nodejs.org
   # Option 2: Use Homebrew
   brew install node
   
   # Option 3: Use nvm (recommended for developers)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install --lts
   nvm use --lts
   ```

2. **Verify Installation**:
   ```bash
   node --version
   npm --version
   ```

#### Installation
```bash
# Install globally
npm install -g quip-export

# Verify
quip-export --version
```

#### Common macOS Issues

**Issue**: Permission errors with global install
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g quip-export

# Option 2: Configure npm to use different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bash_profile
source ~/.bash_profile
npm install -g quip-export

# Option 3: Use local installation
npm install quip-export
npx quip-export --help
```

### Linux (Ubuntu/Debian)

#### Prerequisites
```bash
# Update package list
sudo apt update

# Install Node.js and npm
sudo apt install nodejs npm

# Or install latest version via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### Installation
```bash
# Install globally
sudo npm install -g quip-export

# Or without sudo (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g quip-export

# Verify
quip-export --version
```

### Linux (CentOS/RHEL/Fedora)

#### Prerequisites
```bash
# CentOS/RHEL 8+
sudo dnf install nodejs npm

# CentOS/RHEL 7
sudo yum install nodejs npm

# Fedora
sudo dnf install nodejs npm

# Or install latest via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install nodejs
```

## Docker Installation

For containerized environments:

### Dockerfile
```dockerfile
FROM node:18-alpine

# Install the tool globally
RUN npm install -g quip-export

# Create working directory
WORKDIR /exports

# Set entrypoint
ENTRYPOINT ["quip-export"]
CMD ["--help"]
```

### Build and Run
```bash
# Build image
docker build -t quip-export .

# Run with volume mount for exports
docker run -v $(pwd)/exports:/exports quip-export export --output /exports
```

### Docker Compose
```yaml
version: '3.8'
services:
  quip-export:
    build: .
    volumes:
      - ./exports:/exports
      - ./config:/config
    environment:
      - QUIP_DOMAIN=your-domain.com
      - QUIP_TOKEN=your-token
```

## Verification

After installation, verify everything works:

```bash
# Check version
quip-export --version

# Check help
quip-export --help

# Test authentication setup
quip-export auth setup

# Test connection (after setup)
quip-export auth test
```

## Updating

### Global Installation
```bash
# Check current version
quip-export --version

# Update to latest
npm update -g quip-export

# Verify update
quip-export --version
```

### Local Installation
```bash
# In project directory
npm update quip-export

# Or reinstall
npm install quip-export@latest
```

## Uninstalling

### Global Installation
```bash
npm uninstall -g quip-export
```

### Local Installation
```bash
npm uninstall quip-export
```

### Complete Cleanup
```bash
# Remove global installation
npm uninstall -g quip-export

# Clear npm cache
npm cache clean --force

# Remove configuration (optional)
rm -rf ~/.quip-export-config
```

## Troubleshooting Installation

### Common Issues

#### Node.js Version Issues
```bash
# Check version
node --version

# If too old, update Node.js
# Use nvm for version management
nvm install --lts
nvm use --lts
```

#### npm Permission Issues
```bash
# Check npm configuration
npm config list

# Fix permissions (Linux/macOS)
sudo chown -R $(whoami) ~/.npm

# Or use different prefix
npm config set prefix '~/.npm-global'
```

#### Network Issues
```bash
# Check npm registry
npm config get registry

# Use different registry if needed
npm config set registry https://registry.npmjs.org/

# Install with verbose logging
npm install -g quip-export --verbose
```

#### Proxy Issues
```bash
# Configure proxy if behind corporate firewall
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Or use .npmrc file
echo "proxy=http://proxy.company.com:8080" >> ~/.npmrc
echo "https-proxy=http://proxy.company.com:8080" >> ~/.npmrc
```

### Getting Help

If you encounter issues:

1. **Check the troubleshooting section** in the main README
2. **Search existing issues** on GitHub
3. **Create a new issue** with:
   - Operating system and version
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Installation method used
   - Complete error message
   - Steps to reproduce

### Development Installation

For contributors and developers:

```bash
# Clone repository
git clone https://github.com/anthragz/quip-export.git
cd quip-export

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Link for development
npm link

# Run in development mode
npm run dev -- --help
```

This allows you to:
- Make code changes
- Test immediately
- Contribute back to the project
- Use latest unreleased features