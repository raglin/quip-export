#!/bin/bash

# Release script for Quip Bulk Export Tool
# Usage: ./scripts/release.sh [major|minor|patch]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if we're on main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    print_error "Release must be done from main branch. Current branch: $current_branch"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Check if we have the latest changes
git fetch origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    print_error "Local main branch is not up to date with origin/main"
    exit 1
fi

# Determine version bump type
VERSION_TYPE=${1:-patch}
if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
    print_error "Invalid version type: $VERSION_TYPE. Must be major, minor, or patch."
    exit 1
fi

print_status "Starting release process with version bump: $VERSION_TYPE"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Run pre-release checks
print_status "Running pre-release checks..."

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Run linting
print_status "Running linting..."
npm run lint

# Check formatting
print_status "Checking code formatting..."
npm run format:check

# Build project
print_status "Building project..."
npm run build:clean

# Run tests
print_status "Running tests..."
npm run test:coverage

# Run security audit
print_status "Running security audit..."
npm audit --audit-level moderate

print_status "All pre-release checks passed!"

# Bump version
print_status "Bumping version ($VERSION_TYPE)..."
npm version $VERSION_TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
print_status "New version: $NEW_VERSION"

# Update CHANGELOG.md
print_status "Updating CHANGELOG.md..."
TODAY=$(date +%Y-%m-%d)

# Create temporary file with new changelog entry
cat > /tmp/changelog_entry << EOF
## [$NEW_VERSION] - $TODAY

### Added
- Version $NEW_VERSION release

### Changed
- Updated version to $NEW_VERSION

### Fixed
- Bug fixes and improvements

EOF

# Backup original changelog
cp CHANGELOG.md CHANGELOG.md.bak

# Insert new entry after "## [Unreleased]" section
awk '
/^## \[Unreleased\]/ {
    print $0
    print ""
    while ((getline line < "/tmp/changelog_entry") > 0) {
        print line
    }
    close("/tmp/changelog_entry")
    next
}
{ print }
' CHANGELOG.md.bak > CHANGELOG.md

# Clean up
rm /tmp/changelog_entry CHANGELOG.md.bak

# Commit changes
print_status "Committing version bump..."
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: bump version to $NEW_VERSION"

# Create git tag
print_status "Creating git tag..."
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# Push changes and tags
print_warning "Ready to push changes and tags. This will trigger the release process."
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Pushing changes to origin..."
    git push origin main
    git push origin "v$NEW_VERSION"
    
    print_status "Release process initiated!"
    print_status "GitHub Actions will now:"
    print_status "  1. Run CI/CD pipeline"
    print_status "  2. Publish to npm registry"
    print_status "  3. Build and push Docker image"
    print_status "  4. Create GitHub release"
    
    print_status "Monitor the progress at: https://github.com/your-org/quip-export/actions"
else
    print_warning "Release cancelled. Rolling back changes..."
    git reset --hard HEAD~1
    git tag -d "v$NEW_VERSION"
    print_status "Changes rolled back."
fi