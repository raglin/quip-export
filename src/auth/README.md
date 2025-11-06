# Authentication Module

This module provides personal access token authentication for Quip API with secure token storage.

## Features

- **Personal Access Token**: Simple and secure authentication using Quip personal access tokens
- **Secure Token Storage**: Uses system keychain (preferred) with encrypted file fallback
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Type-Safe**: Full TypeScript support with comprehensive interfaces

## Components

### AuthManager
Main orchestrator that handles authentication and token management.

```typescript
import { AuthManager, createQuipConfig } from './auth';

const authManager = new AuthManager(quipConfig);
```

### TokenStorage
Secure token storage using system keychain with encrypted file fallback.

- **Primary**: System keychain (keytar)
- **Fallback**: AES-256 encrypted files in `~/.quip-migration/`

## Configuration

### Environment Variables

```bash
# Quip Personal Access Token Configuration
QUIP_PERSONAL_ACCESS_TOKEN=your-personal-access-token
QUIP_DOMAIN=quip.com  # Optional, defaults to quip.com
```

### Programmatic Configuration

```typescript
import { createQuipConfig } from './auth';

const quipConfig = createQuipConfig(
  'your-personal-access-token',
  'quip.com'  // Optional domain
);
```

## Usage Examples

### Basic Authentication

```typescript
import { AuthManager, loadConfigFromEnv } from './auth';

const { quip } = loadConfigFromEnv();
const authManager = new AuthManager(quip!);

// Authenticate with Quip
await authManager.authenticateQuip();

// Validate authentication
const validation = await authManager.validateAuthentication();
if (validation.valid) {
  console.log('Ready to proceed with export!');
}
```

### Getting Valid Tokens

```typescript
// Get valid token
const quipToken = await authManager.getValidToken();

// Use token in API calls
const response = await axios.get('https://platform.quip.com/1/users/current', {
  headers: { Authorization: `Bearer ${quipToken}` }
});
```

### Token Management

```typescript
// Check authentication status
const status = await authManager.getAuthStatus();
console.log('Quip authenticated:', status.quip);

// Logout
await authManager.logout();
```

## Security Features

### Token Storage Security
- **Keychain**: Uses system keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)
- **Encryption**: Fallback files encrypted with AES-256-CBC using machine-specific keys
- **Permissions**: File permissions set to 0600 (owner read/write only)

### Personal Access Token Security
- **Token Validation**: Validates token by making test API calls
- **Secure Storage**: Tokens stored securely in system keychain or encrypted files

## Error Handling

The module provides comprehensive error handling:

```typescript
const result = await authManager.authenticateQuip();
if (!result.success) {
  console.error('Authentication failed:', result.error);
  // Handle specific error cases
}
```

Common error scenarios:
- Network connectivity issues
- Invalid personal access token
- Token revoked or expired
- Keychain access denied

## Requirements

### Dependencies
- `keytar`: System keychain access

### Personal Access Token Setup

#### Quip
1. Visit https://quip.com/dev/token (or your enterprise domain)
2. Generate a new personal access token
3. Copy the token and set it in your environment variables

## Testing

Run the example to test authentication:

```bash
npm run dev -- auth-example
```

Or programmatically:

```typescript
import { exampleUsage } from './auth/example';
await exampleUsage();
```