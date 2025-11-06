#!/bin/bash

# Development setup script for Quip Bulk Export Tool
# This script sets up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_header "Quip Bulk Export Tool - Development Setup"
echo

# Check Node.js version
print_status "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16.0 or higher."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js $REQUIRED_VERSION or higher."
    exit 1
fi

print_status "Node.js version: $NODE_VERSION ✓"

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm --version)
print_status "npm version: $NPM_VERSION ✓"

# Install dependencies
print_status "Installing dependencies..."
npm install

# Install global development tools (optional)
print_status "Installing global development tools..."
if ! command -v typescript &> /dev/null; then
    print_warning "TypeScript not found globally. Installing..."
    npm install -g typescript
fi

if ! command -v ts-node &> /dev/null; then
    print_warning "ts-node not found globally. Installing..."
    npm install -g ts-node
fi

# Build the project
print_status "Building the project..."
npm run build

# Run tests to ensure everything works
print_status "Running tests..."
npm test

# Link the CLI for development
print_status "Linking CLI for development..."
npm link

# Verify CLI installation
print_status "Verifying CLI installation..."
if quip-export --version &> /dev/null; then
    CLI_VERSION=$(quip-export --version)
    print_status "CLI linked successfully: $CLI_VERSION ✓"
else
    print_error "CLI linking failed"
    exit 1
fi

# Create development directories
print_status "Creating development directories..."
mkdir -p logs
mkdir -p test-exports
mkdir -p temp

# Copy environment example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        print_status "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your configuration"
    fi
fi

# Set up git hooks (if in git repository)
if [ -d .git ]; then
    print_status "Setting up git hooks..."
    
    # Pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for Quip Bulk Export Tool

echo "Running pre-commit checks..."

# Run linting
npm run lint
if [ $? -ne 0 ]; then
    echo "Linting failed. Please fix errors before committing."
    exit 1
fi

# Check formatting
npm run format:check
if [ $? -ne 0 ]; then
    echo "Code formatting check failed. Run 'npm run format' to fix."
    exit 1
fi

# Run tests
npm test
if [ $? -ne 0 ]; then
    echo "Tests failed. Please fix failing tests before committing."
    exit 1
fi

echo "Pre-commit checks passed!"
EOF

    chmod +x .git/hooks/pre-commit
    print_status "Git pre-commit hook installed ✓"
fi

# Display development information
echo
print_header "Development Environment Ready!"
echo
print_status "Available npm scripts:"
echo "  npm run dev          - Run CLI in development mode"
echo "  npm run build        - Build the project"
echo "  npm run test         - Run tests"
echo "  npm run test:watch   - Run tests in watch mode"
echo "  npm run lint         - Run linting"
echo "  npm run lint:fix     - Fix linting issues"
echo "  npm run format       - Format code"
echo
print_status "CLI commands (after npm link):"
echo "  quip-export --help   - Show help"
echo "  quip-export --version - Show version"
echo "  quip-export auth setup - Setup authentication"
echo
print_status "Development directories created:"
echo "  logs/                - Log files"
echo "  test-exports/        - Test export outputs"
echo "  temp/                - Temporary files"
echo
print_status "Next steps:"
echo "  1. Edit .env file with your configuration (if needed)"
echo "  2. Run 'quip-export auth setup' to configure authentication"
echo "  3. Start developing!"
echo
print_warning "Remember to:"
echo "  - Run tests before committing: npm test"
echo "  - Check linting: npm run lint"
echo "  - Format code: npm run format"
echo "  - Update documentation when adding features"
echo

print_status "Happy coding! 🚀"