# Design Document

## Overview

This design implements automatic date prefixing for exported Quip document filenames. The feature extracts the `updated_usec` timestamp from Quip document metadata, converts it to ISO 8601 date format (YYYY-MM-DD), and prepends it to the filename before saving. This provides chronological organization and makes it easy to identify document modification dates at a glance.

The implementation integrates into the existing file writing pipeline, specifically in the `FileWriter` class where filenames are generated. The date prefix is applied consistently across all export formats (native/DOCX, HTML, markdown) and respects the existing filename sanitization and conflict resolution mechanisms.

## Architecture

### Component Integration

The date prefixing functionality integrates into the existing export pipeline at the filename generation stage:

```
QuipDocument (with updated_usec) 
  → FileWriter.createSafeFileName() 
  → Date extraction & formatting 
  → Prefix application 
  → Sanitization 
  → Conflict resolution 
  → File write
```

### Key Components Modified

1. **FileWriter** (`src/services/local/file-writer.ts`)
   - Add date prefix logic to `createSafeFileName()` method
   - Add date prefix logic to `createSafeFileNameForFormat()` method
   - Ensure date prefix is preserved during sanitization

2. **PathUtils** (`src/services/local/path-utils.ts`)
   - Update sanitization logic to preserve date prefix format
   - Ensure ISO date format (YYYY-MM-DD) is not corrupted during sanitization

## Components and Interfaces

### Date Formatting Utility

A new utility function will be added to handle timestamp conversion with configurable format:

```typescript
/**
 * Convert Quip microsecond timestamp to formatted date string
 * @param updated_usec - Quip timestamp in microseconds
 * @param format - Date format pattern (e.g., "YYYY-MM-DD", "YYYY-DD-MM")
 * @returns Formatted date string
 */
function formatQuipDate(updated_usec: number, format: string = 'YYYY-MM-DD'): string {
  // Convert microseconds to milliseconds
  const milliseconds = updated_usec / 1000;
  const date = new Date(milliseconds);
  
  // Extract date components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Replace tokens in format string
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day);
}

/**
 * Validate date format pattern
 * @param format - Date format pattern to validate
 * @returns true if valid, false otherwise
 */
function isValidDateFormat(format: string): boolean {
  // Must contain all three components
  const hasYear = format.includes('YYYY');
  const hasMonth = format.includes('MM');
  const hasDay = format.includes('DD');
  
  return hasYear && hasMonth && hasDay;
}
```

### FileWriter Method Updates

The `createSafeFileName()` and `createSafeFileNameForFormat()` methods will be updated to accept optional date parameters and configuration:

```typescript
createSafeFileName(
  documentTitle: string,
  documentType: string,
  exportFormat: 'docx' | 'html' | 'xlsx',
  updatedDate?: number,  // New parameter: Quip updated_usec timestamp
  datePrefixConfig?: { enabled: boolean; format: string }  // New parameter: date prefix config
): string {
  // Format date prefix if enabled and provided
  let baseTitle = documentTitle && documentTitle.trim() 
    ? documentTitle.trim() 
    : 'Untitled';
  
  if (updatedDate && datePrefixConfig?.enabled) {
    const dateFormat = datePrefixConfig.format || 'YYYY-MM-DD';
    const datePrefix = formatQuipDate(updatedDate, dateFormat);
    baseTitle = `${datePrefix} ${baseTitle}`;
  }
  
  // Rest of existing logic...
}
```

### Integration Points

The date prefix will be applied at all document export call sites:

1. **ExportOrchestrator** - Pass `updated_usec` when calling FileWriter methods
2. **DocumentExporter** - Include `updated_usec` in export metadata
3. **CLI export commands** - Ensure document metadata includes timestamp

## Data Models

### QuipDocument Interface

The existing `QuipDocument` interface already includes the required field:

```typescript
export interface QuipDocument {
  id: string;
  title: string;
  type: 'DOCUMENT' | 'SPREADSHEET' | 'CHAT';
  created_usec: number;
  updated_usec: number;  // ← Used for date prefix
  // ... other fields
}
```

### FileWriteOptions Extension

The `FileWriteOptions` interface will be extended to include the update timestamp and date prefix configuration:

```typescript
export interface FileWriteOptions {
  fileName: string;
  content: Buffer | string;
  documentType?: string;
  exportFormat?: 'docx' | 'html' | 'xlsx' | 'markdown';
  overwrite?: boolean;
  updatedDate?: number;  // New field: Quip updated_usec timestamp
  datePrefixConfig?: {    // New field: date prefix configuration
    enabled: boolean;
    format: string;
  };
}
```

### Export Configuration Type

A new configuration type will be added for date prefix settings:

```typescript
export interface DatePrefixConfig {
  enabled: boolean;
  format: string;  // e.g., "YYYY-MM-DD", "YYYY-DD-MM", "MM-DD-YYYY", "DD-MM-YYYY"
}

export interface ExportConfig {
  outputDirectory: string;
  exportFormat: string;
  datePrefix?: DatePrefixConfig;  // New field
  // ... other existing fields
}
```

## Error Handling

### Invalid Timestamp Handling

If `updated_usec` is invalid or missing:
- Log a warning message
- Skip date prefix and use original filename
- Continue with export process (non-blocking error)

```typescript
if (updatedDate) {
  try {
    const datePrefix = formatQuipDateToISO(updatedDate);
    baseTitle = `${datePrefix} ${baseTitle}`;
  } catch (error) {
    this.logger.warn(`Failed to format date for document "${documentTitle}": ${error.message}`);
    // Continue without date prefix
  }
}
```

### Sanitization Conflicts

The date prefix format (YYYY-MM-DD) uses only safe characters (digits and hyphens), so it should not be affected by filename sanitization. However, we'll add explicit handling to ensure the prefix is preserved:

```typescript
// In PathUtils.sanitizeFileNameEnhanced()
// Detect and preserve date prefix pattern at start of filename
const datePrefixPattern = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/;
const match = fileName.match(datePrefixPattern);

if (match) {
  const [, datePrefix, restOfName] = match;
  const sanitizedRest = sanitizeFilename(restOfName);
  return `${datePrefix} ${sanitizedRest}`;
}
```

### Filename Length Limits

Date prefix adds 11 characters (10 for date + 1 space). The existing path length validation in `PathUtils.ensurePathLength()` will handle any length issues by truncating the document title portion while preserving the date prefix.

## Testing Strategy

### Unit Tests

1. **Date Formatting Tests**
   - Test conversion of various `updated_usec` values
   - Test edge cases (very old dates, future dates, invalid timestamps)
   - Verify ISO format output (YYYY-MM-DD)

2. **Filename Generation Tests**
   - Test date prefix application with valid timestamps
   - Test filename generation without timestamps (backward compatibility)
   - Test date prefix with various document titles (special characters, long names, etc.)
   - Test date prefix preservation during sanitization

3. **Integration Tests**
   - Test complete export flow with date-prefixed filenames
   - Test multiple documents with same title but different dates
   - Test date prefix across all export formats (native, HTML, markdown)
   - Test conflict resolution with date-prefixed filenames

### Test Data

```typescript
const testCases = [
  {
    updated_usec: 1700000000000000, // Nov 14, 2023
    expected: '2023-11-14'
  },
  {
    updated_usec: 1609459200000000, // Jan 1, 2021
    expected: '2021-01-01'
  },
  {
    updated_usec: 946684800000000,  // Jan 1, 2000
    expected: '2000-01-01'
  }
];
```

### Manual Testing Scenarios

1. Export a single document and verify date prefix in filename
2. Export multiple documents with same title but different update dates
3. Export documents in all formats and verify consistent date prefixing
4. Export documents with very long titles and verify truncation preserves date
5. Export documents with special characters in titles and verify sanitization preserves date

## Configuration

### Export Configuration Extension

The `.export-config.json` file will be extended to include date prefix settings:

```json
{
  "export": {
    "outputDirectory": "./exported-documents",
    "exportFormat": "native",
    "datePrefix": {
      "enabled": true,
      "format": "YYYY-MM-DD"
    }
  }
}
```

### Configuration Options

- **enabled** (boolean, default: true): Enable or disable date prefixing
- **format** (string, default: "YYYY-MM-DD"): Date format pattern
  - Supported patterns: YYYY (year), MM (month), DD (day)
  - Examples: "YYYY-MM-DD", "YYYY-DD-MM", "MM-DD-YYYY", "DD-MM-YYYY"

### CLI Configuration Command

The `quip-export export configure` command will prompt for date prefix settings:

```
📅 Date Prefix Configuration:
Enable date prefix for filenames? (y/n, default: y): 
Date format (YYYY-MM-DD, YYYY-DD-MM, MM-DD-YYYY, DD-MM-YYYY, default: YYYY-MM-DD):
```

## Display Updates

### List Command Enhancement

The `quip-export list` command output will be updated to show both created and updated dates:

```
Title                                              Type        Created      Updated      Folder
──────────────────────────────────────────────────────────────────────────────────────────────
WBD                                                DOCUMENT    2023-01-15   2024-11-20   Documents
GPU-Accelerated Virtual Desktop...                 DOCUMENT    2023-03-10   2024-10-05   Documents
```

### Preview Command Enhancement

The `quip-export export preview` command will show the date-prefixed filename in the output:

```
1. 📄 WBD
   Type: DOCUMENT
   Folder: Documents
   Updated: 2024-11-20
   Output: exported-documents/Documents/2024-11-20 WBD.docx

2. 📄 GPU-Accelerated Virtual Desktop Infrastructure on Amazon EKS
   Type: DOCUMENT
   Folder: Documents
   Updated: 2024-10-05
   Output: exported-documents/Documents/2024-10-05 GPU-Accelerated Virtual Desktop Infrastructure on Amazon EKS.docx
```

## Implementation Notes

### Backward Compatibility

The date prefix feature is additive and does not break existing functionality:
- Date prefixing is enabled by default but can be disabled
- The `updatedDate` parameter is optional in all methods
- If not provided or disabled, filenames are generated as before
- Existing configurations without date prefix settings will use defaults

### Performance Considerations

- Date formatting is a simple operation with negligible performance impact
- No additional API calls required (timestamp already in document metadata)
- No impact on export speed or memory usage

### Timezone Handling

The date conversion uses the local system timezone. This is appropriate because:
- Users typically want dates in their local timezone
- The date is for organizational purposes, not precise timestamp tracking
- Consistent with how file system timestamps are displayed

### Date Format Validation

The configuration system will validate date format patterns:
- Must contain YYYY, MM, and DD tokens
- Must use valid separators (-, /, space)
- Invalid formats will fall back to default (YYYY-MM-DD)
