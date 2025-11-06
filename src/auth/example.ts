/**
 * Example usage of the Authentication Manager
 * This file demonstrates how to use the authentication system
 */

import { AuthManager, createQuipConfig } from './index';

async function exampleUsage() {
  // Create configuration with personal access token
  const quipConfig = createQuipConfig(
    process.env.QUIP_PERSONAL_ACCESS_TOKEN || 'your-personal-access-token'
  );

  // Create authentication manager
  const authManager = new AuthManager(quipConfig);

  try {
    // Check current authentication status
    const authStatus = await authManager.getAuthStatus();
    console.log('Current auth status:', authStatus);

    // Authenticate with Quip if not already authenticated
    if (!authStatus.quip) {
      console.log('Authenticating with Quip...');
      const quipResult = await authManager.authenticateQuip();
      if (!quipResult.success) {
        console.error('Quip authentication failed:', quipResult.error);
        return;
      }
      console.log('Quip authentication successful!');
    }

    // Validate that Quip is authenticated
    const validation = await authManager.validateAuthentication();
    if (!validation.valid) {
      console.error('Authentication validation failed:', validation.errors);
      return;
    }

    console.log('Quip authenticated successfully!');

    // Get valid token (automatically refreshes if needed)
    const quipToken = await authManager.getValidToken();

    console.log('Quip token available:', !!quipToken);

    // Example: Logout
    // await authManager.logout();

  } catch (error) {
    console.error('Authentication error:', error);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };