// Path utilities for cross-platform compatibility and safe file naming

import * as path from 'path';
import { PathSanitizationResult } from './types';

/**
 * Characters that are invalid in file names across different operating systems
 */
const INVALID_FILENAME_CHARS = /[<>:"|?*\x00-\x1f]/g;
const INVALID_FILENAME_CHARS_WINDOWS = /[<>:"|?*\x00-\x1f\\\/]/g;

/**
 * Comprehensive filesystem reserved characters for all platforms
 */
const FILESYSTEM_RESERVED_CHARS = /[<>:"|?*\/\\\x00-\x1f]/g;

/**
 * Reserved file names on Windows
 */
const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

/**
 * Maximum path length for different operating systems
 */
const MAX_PATH_LENGTH = {
  windows: 260,
  unix: 4096
};

/**
 * Maximum filename length (conservative across platforms)
 */
const MAX_FILENAME_LENGTH = 255;

export class PathUtils {
  /**
   * Sanitize a filename to be safe across all operating systems
   */
  static sanitizeFileName(fileName: string): PathSanitizationResult {
    const original = fileName;
    let sanitized = fileName;
    const unsafeChars: string[] = [];

    // Remove or replace invalid characters
    const invalidChars = process.platform === 'win32' ? INVALID_FILENAME_CHARS_WINDOWS : INVALID_FILENAME_CHARS;
    
    sanitized = sanitized.replace(invalidChars, (match) => {
      unsafeChars.push(match);
      return '_';
    });

    // Handle Windows reserved names
    if (process.platform === 'win32') {
      const nameWithoutExt = path.parse(sanitized).name.toUpperCase();
      if (WINDOWS_RESERVED_NAMES.includes(nameWithoutExt)) {
        sanitized = `_${sanitized}`;
      }
    }

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

    // Ensure filename is not empty
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'untitled';
    }

    // Truncate if too long
    if (sanitized.length > MAX_FILENAME_LENGTH) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.parse(sanitized).name;
      const maxNameLength = MAX_FILENAME_LENGTH - ext.length;
      sanitized = nameWithoutExt.substring(0, maxNameLength) + ext;
    }

    return {
      sanitized,
      changed: sanitized !== original,
      originalUnsafeChars: unsafeChars.length > 0 ? [...new Set(unsafeChars)] : undefined
    };
  }

  /**
   * Sanitize a directory path to be safe across all operating systems
   */
  static sanitizeDirectoryPath(dirPath: string): string {
    return dirPath
      .split(path.sep)
      .map(segment => this.sanitizeFilenameComponent(segment))
      .join(path.sep);
  }

  /**
   * Create a safe relative path from Quip folder structure
   */
  static createSafeRelativePath(quipFolderPath: string): string {
    // Remove leading/trailing slashes and normalize
    const normalized = quipFolderPath.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    
    if (!normalized) {
      return 'Root';
    }

    // Split by forward slashes (Quip uses forward slashes)
    const segments = normalized.split('/');
    
    // Sanitize each segment using enhanced sanitization
    // This ensures forward slashes within folder names are replaced with hyphens
    const safeSegments = segments.map(segment => {
      const sanitized = this.sanitizeFilenameComponent(segment);
      return sanitized || 'Unnamed';
    });

    return safeSegments.join(path.sep);
  }

  /**
   * Sanitize individual path component (folder name)
   * Ensures forward slashes in folder names don't create unintended nesting
   */
  static sanitizeFilenameComponent(component: string): string {
    const unsafeChars: string[] = [];
    let sanitized = component;

    // Character-specific replacement strategy for folder names
    // Step 1: Replace forward slashes with hyphens
    sanitized = sanitized.replace(/\//g, (match) => {
      unsafeChars.push(match);
      return '-';
    });

    // Step 2: Replace backslashes with hyphens
    sanitized = sanitized.replace(/\\/g, (match) => {
      unsafeChars.push(match);
      return '-';
    });

    // Step 3: Replace colons with hyphens
    sanitized = sanitized.replace(/:/g, (match) => {
      unsafeChars.push(match);
      return '-';
    });

    // Step 4: Replace other reserved characters with underscores
    sanitized = sanitized.replace(/[<>"|?*\x00-\x1f]/g, (match) => {
      unsafeChars.push(match);
      return '_';
    });

    // Step 5: Collapse multiple consecutive separators
    sanitized = sanitized.replace(/[-_]+/g, (match) => {
      if (match.match(/^-+$/)) return '-';
      if (match.match(/^_+$/)) return '_';
      return '-';
    });

    // Step 6: Remove leading separators
    sanitized = sanitized.replace(/^[-_]+/g, '');
    
    // Remove leading/trailing dots and spaces (but not hyphens/underscores yet)
    sanitized = sanitized.replace(/^[.\s]+/g, '');
    sanitized = sanitized.replace(/[.\s]+$/g, '');
    
    // Step 7: Remove trailing separators only if followed by dots/spaces originally
    // For folder names, we keep trailing separators that resulted from sanitization
    // to maintain distinction between "Projects" and "Projects<>:|?*"
    // Only remove if the component would be empty otherwise
    if (sanitized.match(/^[-_]+$/)) {
      sanitized = '';
    }

    // Handle Windows reserved names
    if (process.platform === 'win32' && sanitized) {
      const upperName = sanitized.toUpperCase();
      if (WINDOWS_RESERVED_NAMES.includes(upperName)) {
        sanitized = `_${sanitized}`;
      }
    }

    // Ensure component is not empty
    if (!sanitized || sanitized.length === 0) {
      return 'Unnamed';
    }

    // Truncate if too long (folder names should also respect length limits)
    if (sanitized.length > MAX_FILENAME_LENGTH) {
      sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH);
    }

    return sanitized;
  }

  /**
   * Ensure path length is within system limits
   */
  static ensurePathLength(fullPath: string): string {
    const maxLength = process.platform === 'win32' ? MAX_PATH_LENGTH.windows : MAX_PATH_LENGTH.unix;
    
    if (fullPath.length <= maxLength) {
      return fullPath;
    }

    // Try to shorten by truncating the filename
    const dir = path.dirname(fullPath);
    const ext = path.extname(fullPath);
    const nameWithoutExt = path.parse(fullPath).name;
    
    const availableLength = maxLength - dir.length - ext.length - 1; // -1 for path separator
    
    if (availableLength > 10) { // Ensure we have reasonable space for filename
      const truncatedName = nameWithoutExt.substring(0, availableLength - 3) + '...';
      return path.join(dir, truncatedName + ext);
    }

    // If still too long, use a hash-based approach
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(fullPath).digest('hex').substring(0, 8);
    const shortDir = dir.length > 50 ? path.dirname(dir) : dir;
    return path.join(shortDir, `file_${hash}${ext}`);
  }

  /**
   * Check if a path is safe and valid
   */
  static isValidPath(filePath: string): boolean {
    try {
      // Check for null bytes
      if (filePath.includes('\0')) {
        return false;
      }

      // Check path length
      const maxLength = process.platform === 'win32' ? MAX_PATH_LENGTH.windows : MAX_PATH_LENGTH.unix;
      if (filePath.length > maxLength) {
        return false;
      }

      // Try to resolve the path
      path.resolve(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file extension from Quip document type
   */
  static getFileExtension(documentType: string, exportFormat: 'docx' | 'html' | 'xlsx'): string {
    if (documentType === 'SPREADSHEET') {
      return '.xlsx';
    }
    
    switch (exportFormat) {
      case 'docx':
        return '.docx';
      case 'html':
        return '.html';
      case 'xlsx':
        return '.xlsx';
      default:
        return '.docx';
    }
  }

  /**
   * Get file extension for any export format including new formats
   */
  static getFileExtensionForFormat(format: string, documentType?: string): string {
    switch (format.toLowerCase()) {
      case 'native':
        // Resolve native format based on document type
        if (documentType) {
          switch (documentType.toUpperCase()) {
            case 'DOCUMENT':
              return '.docx';
            case 'SPREADSHEET':
              return '.xlsx';
            case 'CHAT':
            default:
              return '.html';
          }
        }
        return '.html'; // Fallback when document type is not provided
      case 'docx':
        return '.docx';
      case 'xlsx':
        return '.xlsx';
      case 'html':
        return '.html';
      case 'pdf':
        return '.pdf';
      case 'markdown':
      case 'md':
        return '.md';
      default:
        return '.txt';
    }
  }

  /**
   * Enhanced filename sanitization for cross-platform compatibility
   */
  static sanitizeFileNameEnhanced(fileName: string, format?: string, documentType?: string): PathSanitizationResult {
    const original = fileName;
    let sanitized = fileName;
    const unsafeChars: string[] = [];

    // Character-specific replacement strategy
    // Step 1: Replace forward slashes with hyphens
    sanitized = sanitized.replace(/\//g, (match) => {
      unsafeChars.push(match);
      return '-';
    });

    // Step 2: Replace backslashes with hyphens
    sanitized = sanitized.replace(/\\/g, (match) => {
      unsafeChars.push(match);
      return '-';
    });

    // Step 3: Replace colons with hyphens
    sanitized = sanitized.replace(/:/g, (match) => {
      unsafeChars.push(match);
      return '-';
    });

    // Step 4: Replace other reserved characters with underscores
    sanitized = sanitized.replace(/[<>"|?*\x00-\x1f]/g, (match) => {
      unsafeChars.push(match);
      return '_';
    });

    // Step 5: Collapse multiple consecutive separators (hyphens and underscores)
    sanitized = sanitized.replace(/[-_]+/g, (match) => {
      // If it's all hyphens, return single hyphen
      if (match.match(/^-+$/)) return '-';
      // If it's all underscores, return single underscore
      if (match.match(/^_+$/)) return '_';
      // If mixed, prefer hyphen
      return '-';
    });

    // Step 6: Remove leading and trailing separators
    // First, extract extension if present
    const tempExt = path.extname(sanitized);
    const tempName = tempExt ? sanitized.slice(0, -tempExt.length) : sanitized;
    
    // Remove leading and trailing separators from the name part
    const cleanedName = tempName.replace(/^[-_]+|[-_]+$/g, '');
    
    // Reconstruct with extension
    sanitized = cleanedName + tempExt;

    // Handle Windows reserved names
    if (process.platform === 'win32') {
      const nameWithoutExt = path.parse(sanitized).name.toUpperCase();
      if (WINDOWS_RESERVED_NAMES.includes(nameWithoutExt)) {
        sanitized = `_${sanitized}`;
      }
    }

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

    // Step 7: Handle empty filenames after sanitization
    if (!sanitized || sanitized.length === 0) {
      sanitized = format ? `untitled${this.getFileExtensionForFormat(format, documentType)}` : 'untitled';
    } else if (format) {
      // Add format extension if not present
      const expectedExt = this.getFileExtensionForFormat(format, documentType);
      const currentExt = path.extname(sanitized);
      
      // Check if current extension matches the expected format extension
      if (currentExt.toLowerCase() !== expectedExt.toLowerCase()) {
        // Check if the current extension is a known format extension
        const knownExtensions = ['.docx', '.xlsx', '.html', '.pdf', '.md'];
        const isKnownExtension = knownExtensions.includes(currentExt.toLowerCase());
        
        if (isKnownExtension) {
          // Replace the known extension with the format extension
          sanitized = sanitized.slice(0, -currentExt.length) + expectedExt;
        } else {
          // Unknown or no extension, just append the format extension
          sanitized = sanitized + expectedExt;
        }
      }
    }

    // Truncate if too long, preserving extension
    if (sanitized.length > MAX_FILENAME_LENGTH) {
      const extension = path.extname(sanitized);
      const nameOnly = path.parse(sanitized).name;
      const maxNameLength = MAX_FILENAME_LENGTH - extension.length;
      sanitized = nameOnly.substring(0, maxNameLength) + extension;
    }

    // Calculate significant change (>30% of characters modified)
    const originalLength = original.length;
    const changedChars = unsafeChars.length;
    const changePercentage = originalLength > 0 ? (changedChars / originalLength) * 100 : 0;
    const significantChange = changePercentage > 30;

    return {
      sanitized,
      changed: sanitized !== original,
      originalUnsafeChars: unsafeChars.length > 0 ? [...new Set(unsafeChars)] : undefined,
      significantChange: significantChange ? true : undefined
    };
  }

  /**
   * Generate unique filename with format-specific handling
   */
  static generateUniqueFileName(
    basePath: string, 
    fileName: string, 
    format: string,
    strategy: 'number' | 'timestamp' = 'number',
    documentType?: string
  ): string {
    // First sanitize the filename with format context
    const sanitized = this.sanitizeFileNameEnhanced(fileName, format, documentType);
    let finalName = sanitized.sanitized;

    // Check for conflicts and resolve
    if (strategy === 'timestamp') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const nameWithoutExt = path.parse(finalName).name;
      const ext = path.extname(finalName);
      return `${nameWithoutExt}_${timestamp}${ext}`;
    } else {
      // Number strategy - find next available number
      let counter = 1;
      let testName = finalName;
      
      while (require('fs').existsSync(path.join(basePath, testName)) && counter < 1000) {
        const nameWithoutExt = path.parse(finalName).name;
        const ext = path.extname(finalName);
        testName = `${nameWithoutExt}_${counter}${ext}`;
        counter++;
      }
      
      return testName;
    }
  }

  /**
   * Create a unique filename by adding numbers or timestamps
   */
  static createUniqueFileName(basePath: string, fileName: string, strategy: 'number' | 'timestamp'): string {
    const ext = path.extname(fileName);
    const nameWithoutExt = path.parse(fileName).name;
    
    if (strategy === 'timestamp') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return `${nameWithoutExt}_${timestamp}${ext}`;
    } else {
      // Number strategy - find next available number
      let counter = 1;
      let newFileName: string;
      
      do {
        newFileName = `${nameWithoutExt}_${counter}${ext}`;
        counter++;
      } while (require('fs').existsSync(path.join(basePath, newFileName)) && counter < 1000);
      
      return newFileName;
    }
  }

  /**
   * Validate if a filename is safe for filesystem operations
   * Checks for presence of reserved characters and length limits
   * 
   * @param fileName - The filename to validate
   * @returns true if the filename is safe, false otherwise
   */
  static isFilenameSafe(fileName: string): boolean {
    // Check for null or empty filename
    if (!fileName || fileName.length === 0) {
      return false;
    }

    // Check for null bytes
    if (fileName.includes('\0')) {
      return false;
    }

    // Check for reserved characters
    if (FILESYSTEM_RESERVED_CHARS.test(fileName)) {
      return false;
    }

    // Check filename length
    if (fileName.length > MAX_FILENAME_LENGTH) {
      return false;
    }

    // Check for Windows reserved names
    if (process.platform === 'win32') {
      const nameWithoutExt = path.parse(fileName).name.toUpperCase();
      if (WINDOWS_RESERVED_NAMES.includes(nameWithoutExt)) {
        return false;
      }
    }

    // Check for leading/trailing dots or spaces
    if (/^[.\s]+|[.\s]+$/.test(fileName)) {
      return false;
    }

    return true;
  }
}