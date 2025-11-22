import { QuipUrlInfo } from '../../types';

/**
 * Parse a Quip URL and extract the thread ID
 * Supports formats:
 * - https://quip.com/ThreadID/optional-title
 * - https://quip.com/ThreadID
 * - https://quip-amazon.com/ThreadID/optional-title
 * - https://custom-domain.com/ThreadID
 * - URLs with query parameters
 */
export function parseQuipUrl(url: string): QuipUrlInfo {
  try {
    const urlObj = new URL(url);

    // Extract path segments
    const pathSegments = urlObj.pathname.split('/').filter((s) => s.length > 0);

    if (pathSegments.length === 0) {
      return {
        threadId: '',
        domain: urlObj.hostname,
        isValid: false,
        error: 'URL does not contain a thread ID',
      };
    }

    // First path segment is the thread ID
    const threadId = pathSegments[0];

    // Validate thread ID format (alphanumeric, minimum 8 characters)
    if (!/^[a-zA-Z0-9]{8,}$/.test(threadId)) {
      return {
        threadId: '',
        domain: urlObj.hostname,
        isValid: false,
        error: 'Invalid thread ID format',
      };
    }

    return {
      threadId,
      domain: urlObj.hostname,
      isValid: true,
    };
  } catch (error) {
    return {
      threadId: '',
      domain: '',
      isValid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Validate that a URL is a Quip URL
 */
export function isQuipUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if domain contains 'quip'
    return urlObj.hostname.includes('quip');
  } catch {
    return false;
  }
}
