# Contributing to Quip Bulk Export Tool

Thank you for your interest in contributing to the Quip Bulk Export Tool! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and constructive in all interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 16.0 or higher
- npm 7.0 or higher
- Git
- A Quip account for testing

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/quip-export.git
   cd quip-export
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Link for Development**
   ```bash
   npm link
   ```

6. **Test CLI**
   ```bash
   quip-export --help
   ```

## Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new functionality
- **Code Contributions**: Implement features or fix bugs
- **Documentation**: Improve or add documentation
- **Testing**: Add or improve test coverage

### Before Contributing

1. **Check Existing Issues**: Look for existing issues or discussions
2. **Create an Issue**: For new features or bugs, create an issue first
3. **Discuss Approach**: For significant changes, discuss your approach
4. **Follow Guidelines**: Ensure your contribution follows our guidelines

## Pull Request Process

### 1. Create a Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bug fix branch
git checkout -b fix/issue-description
```

### 2. Make Changes

- Write clean, readable code
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Check formatting
npm run format:check

# Build project
npm run build

# Test CLI functionality
npm run dev -- --help
```

### 4. Commit Changes

Use clear, descriptive commit messages:

```bash
# Good commit messages
git commit -m "feat: add support for custom export formats"
git commit -m "fix: handle rate limiting errors gracefully"
git commit -m "docs: update installation instructions"

# Follow conventional commits format
# type(scope): description
# Types: feat, fix, docs, style, refactor, test, chore
```

### 5. Push and Create PR

```bash
git push origin your-branch-name
```

Then create a pull request on GitHub with:
- Clear title and description
- Reference to related issues
- Description of changes made
- Testing instructions

### 6. Code Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Keep your branch up to date with main
- Once approved, your PR will be merged

## Issue Reporting

### Bug Reports

When reporting bugs, include:

- **Environment**: OS, Node.js version, tool version
- **Steps to Reproduce**: Clear, step-by-step instructions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Error Messages**: Complete error messages and stack traces
- **Additional Context**: Screenshots, logs, or other relevant information

**Bug Report Template:**
```markdown
## Bug Description
Brief description of the bug

## Environment
- OS: [e.g., macOS 12.0, Windows 11, Ubuntu 20.04]
- Node.js: [e.g., 18.17.0]
- Tool Version: [e.g., 1.0.0]

## Steps to Reproduce
1. Run command: `quip-export ...`
2. Enter configuration: ...
3. See error: ...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Error Messages
```
Complete error message here
```

## Additional Context
Any other relevant information
```

### Feature Requests

When requesting features, include:

- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions you've considered
- **Additional Context**: Examples, mockups, or references

## Development Workflow

### Project Structure

```
src/
├── auth/           # Authentication management
├── cli/            # Command-line interface
├── core/           # Core business logic
├── progress/       # Progress tracking and reporting
├── services/       # External service integrations
└── types/          # TypeScript type definitions

docs/               # Documentation
├── INSTALLATION.md
├── USAGE_GUIDE.md
├── TROUBLESHOOTING.md
└── CLOUD_UPLOAD_GUIDE.md

__tests__/          # Test files (mirrors src structure)
```

### Coding Standards

#### TypeScript Guidelines

- Use TypeScript strict mode
- Define interfaces for all data structures
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, avoid `var`

#### Code Style

- Use Prettier for formatting (configured in `.prettierrc`)
- Use ESLint for linting (configured in `.eslintrc.js`)
- Follow existing patterns and conventions
- Keep functions small and focused
- Use async/await over Promises where possible

#### Testing Guidelines

- Write tests for all new functionality
- Maintain or improve test coverage
- Use descriptive test names
- Mock external dependencies
- Test both success and error cases

**Test Structure:**
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case correctly', () => {
      // Test implementation
    });

    it('should handle error case gracefully', () => {
      // Error test implementation
    });
  });
});
```

### Documentation Standards

- Update README.md for user-facing changes
- Add JSDoc comments for new APIs
- Update relevant documentation files
- Include code examples where helpful
- Keep documentation current with code changes

### Release Process

1. **Version Bump**: Use semantic versioning (major.minor.patch)
2. **Changelog**: Update CHANGELOG.md with changes
3. **Testing**: Ensure all tests pass
4. **Documentation**: Update documentation as needed
5. **Tag Release**: Create git tag for version
6. **Publish**: Publish to npm registry

### Semantic Versioning

- **Major (1.0.0)**: Breaking changes
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.0.1)**: Bug fixes, backward compatible

## Development Tips

### Local Testing

```bash
# Test with different Quip instances
npm run dev -- auth setup --profile test

# Test export functionality
npm run dev -- export --limit 1 --output ./test-export

# Test with verbose logging
DEBUG=quip-export:* npm run dev -- export --output ./debug-test
```

### Debugging

```bash
# Run with Node.js debugger
node --inspect-brk dist/cli/index.js export --help

# Use VS Code debugger with launch configuration
# Add breakpoints and debug interactively
```

### Performance Testing

```bash
# Test with large document sets
npm run dev -- export --limit 100 --output ./perf-test

# Monitor memory usage
node --max-old-space-size=4096 dist/cli/index.js export --output ./memory-test
```

## Getting Help

### Communication Channels

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For code review discussions

### Resources

- **Documentation**: Check docs/ folder for detailed guides
- **Code Examples**: Look at existing code for patterns
- **Tests**: Examine test files for usage examples
- **Issues**: Browse existing issues for similar problems

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for their contributions
- GitHub contributors list
- Release notes for significant contributions

Thank you for contributing to the Quip Bulk Export Tool! Your contributions help make this tool better for everyone.