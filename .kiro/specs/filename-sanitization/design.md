# Design Document

## Overview

The current implementation has **two critical flaws**:

### Issue 1: Forward Slash Sanitization

`PathUtils.sanitizeFileName()` handles many reserved characters, but **does not replace forward slashes (/)** on non-Windows platforms. The regex `INVALID_FILENAME_CHARS` excludes forward slashes on Unix-like systems (macOS, Linux), causing documents with titles like "24/07/2023 - Amazon Connect" to fail with ENOENT errors.

### Issue 2: Hardcoded Folder Names

`DocumentDiscovery.parseFolderResponse()` creates folder objects with a **hardcoded title "Subfolder"** instead of fetching the actual folder name from Quip. This causes all subfolders to appear as "Subfolder" or "Subfolder/Subfolder" in the exported directory structure, making it impossible to navigate the exported content using familiar folder names.

### Root Causes

**Issue 1 - Forward Slashes:**
1. Forward slashes in document titles are not sanitized on macOS/Linux
2. These slashes are interpreted as directory separators by the filesystem
3. The code attempts to write to non-existent nested directories (e.g., `exported-documents/Subfolder/24/07/2023 - Amazon Connect.docx`)
4. The `mkdir` call with `recursive: true` doesn't help because the slash is in the filename itself, not the directory path

**Issue 2 - Hardcoded Folder Names:**
1. In `parseFolderResponse()`, when encountering a `folder_id`, the code creates a minimal folder object
2. The title is hardcoded as `'Subfolder'` instead of fetching actual metadata
3. This results in folder paths like `"Subfolder/Subfolder"` instead of actual names like `"Projects/2024"`
4. Users cannot navigate exported content using familiar folder structures

This design addresses both root causes by:
1. Ensuring all filesystem-reserved characters are replaced consistently across all platforms
2. Fetching actual folder metadata to populate real folder names in the directory structure

## Architecture

### Component Interaction

```
DocumentExporter
    ↓
FileWriter.writeFormatDocument()
    ↓
FileWriter.createSafeFileNameForFormat()
    ↓
PathUtils.sanitizeFileNameEnhanced() ← ENHANCEMENT POINT
    ↓
FileWriter.writeDocument()
```

### Key Design Decisions

1. **Centralized Sanitization**: All filename sanitization happens in `PathUtils`, ensuring consistency
2. **Platform-Agnostic**: Replace forward slashes on ALL platforms, not just Windows
3. **Hyphen Replacement**: Use hyphens instead of underscores for better readability (dates like "24/07/2023" become "24-07-2023")
4. **Preserve Readability**: Maintain as much of the original title structure as possible
5. **Backward Compatible**: Existing sanitization logic remains intact; we're enhancing it

## Components and Interfaces

### DocumentDiscovery Enhancement

**Current Issue:**
```typescript
// In parseFolderResponse() around line 700
folders.push({
  id: child.folder_id,
  title: 'Subfolder', // ← HARDCODED! Should fetch actual name
  created_usec: Date.now() * 1000,
  updated_usec: Date.now() * 1000,
  children: [],
  member_ids: []
});
```

**Solution:**
```typescript
// Fetch actual folder metadata
try {
  const folderMetadata = await this.getFolderMetadata(child.folder_id);
  folders.push(folderMetadata);
} catch (error) {
  // Fallback to folder ID if metadata fetch fails
  this.logger.warn(`Failed to get metadata for folder ${child.folder_id}, using ID as name`);
  folders.push({
    id: child.folder_id,
    title: child.folder_id, // Use ID as fallback, not "Subfolder"
    created_usec: Date.now() * 1000,
    updated_usec: Date.now() * 1000,
    children: [],
    member_ids: []
  });
}
```

### PathUtils Enhancement

**Current Issue:**
```typescript
// Current regex on non-Windows platforms
const INVALID_FILENAME_CHARS = /[<>:"|?*\x00-\x1f]/g;  // Missing / and \
```

**Solution:**
```typescript
// New comprehensive regex for all platforms
const FILESYSTEM_RESERVED_CHARS = /[<>:"|?*\/\\\x00-\x1f]/g;
```

### New Function: `DocumentDiscovery.getFolderMetadata()`

**Purpose:** Fetch actual folder metadata from Quip API

**Signature:**
```typescript
private async getFolderMetadata(folderId: string): Promise<QuipFolder>
```

**Implementation:**
1. Check folderCache first for performance
2. Call Quip API to get folder details
3. Extract folder title and metadata
4. Cache the result
5. Return QuipFolder object with actual title

**Error Handling:**
- Throw error if API call fails (caller will handle fallback)
- Log warning for debugging

### Modified Functions

#### 1. `DocumentDiscovery.parseFolderResponse()`

**Current Behavior:**
- Creates folders with hardcoded "Subfolder" title
- No attempt to fetch actual folder metadata

**Enhanced Behavior:**
- Calls `getFolderMetadata()` to get actual folder name
- Falls back to folder ID if metadata fetch fails
- Logs warning when fallback is used
- Caches folder metadata for performance

#### 2. `PathUtils.sanitizeFileNameEnhanced()`

**Current Behavior:**
- Uses platform-specific regex
- Replaces invalid chars with underscores
- Handles Windows reserved names

**Enhanced Behavior:**
- Uses comprehensive regex on all platforms
- Replaces slashes and colons with hyphens (better for dates/times)
- Replaces other reserved chars with underscores
- Collapses multiple consecutive separators
- Removes leading/trailing separators

**Signature:**
```typescript
static sanitizeFileNameEnhanced(
  fileName: string, 
  format?: string, 
  documentType?: string
): PathSanitizationResult
```

**Algorithm:**
1. Replace forward slashes with hyphens
2. Replace backslashes with hyphens
3. Replace colons with hyphens
4. Replace other reserved characters with underscores
5. Collapse multiple consecutive hyphens/underscores
6. Remove leading/trailing hyphens/underscores
7. Handle Windows reserved names
8. Ensure non-empty result (fallback to document ID if needed)
9. Truncate to max length while preserving extension
10. Add format-specific extension if needed

#### 3. `FileWriter.createSafeFileNameForFormat()`

**Current Behavior:**
- Removes existing extension
- Adds format-specific extension
- Calls sanitization if configured

**Enhanced Behavior:**
- Same as current, but sanitization now properly handles slashes
- Add warning log when sanitization changes the filename significantly

#### 4. New Helper: `PathUtils.sanitizeFilenameComponent()`

**Purpose:** Sanitize individual path components (for folder names)

**Signature:**
```typescript
static sanitizeFilenameComponent(component: string): string
```

**Use Case:** When creating folder structures from Quip folder paths that may contain slashes

## Data Models

### PathSanitizationResult (Existing)

```typescript
interface PathSanitizationResult {
  sanitized: string;           // The sanitized filename
  changed: boolean;            // Whether sanitization modified the name
  originalUnsafeChars?: string[]; // List of unsafe characters found
}
```

**Enhancement:** Add optional field for tracking significant changes

```typescript
interface PathSanitizationResult {
  sanitized: string;
  changed: boolean;
  originalUnsafeChars?: string[];
  significantChange?: boolean;  // NEW: true if >30% of chars changed
}
```

## Error Handling

### Current Error Scenario

```
[ERROR] FILE_SYSTEM error in document_export
{
  "message": "File write error: ENOENT: no such file or directory, 
              open 'exported-documents/Subfolder/24/07/2023 - Amazon Connect.docx'"
}
```

### After Fix

```
[INFO] Sanitized filename: "24/07/2023 - Amazon Connect.docx" 
       -> "24-07-2023 - Amazon Connect.docx"
[INFO] Successfully exported 24/07/2023 - Amazon Connect as DOCX
```

### Error Prevention Strategy

1. **Proactive Sanitization**: Sanitize before any filesystem operations
2. **Validation**: Add optional validation step to verify sanitized names are safe
3. **Logging**: Log all sanitization changes at INFO level for user awareness
4. **Fallback**: Use document ID as filename if sanitization results in empty string

### Retry Logic

The existing retry logic in `document-exporter.ts` will still work, but should rarely be needed for filename issues after this fix.

## Testing Strategy

### Unit Tests

**File:** `src/__tests__/services/local/path-utils.test.ts`

Test cases to add:

1. **Forward Slash Sanitization**
   - Input: `"24/07/2023 - Meeting Notes.docx"`
   - Expected: `"24-07-2023 - Meeting Notes.docx"`

2. **Multiple Slashes**
   - Input: `"Project/Phase/Task.docx"`
   - Expected: `"Project-Phase-Task.docx"`

3. **Mixed Reserved Characters**
   - Input: `"File: Name/With\\Many*Bad?Chars.docx"`
   - Expected: `"File- Name-With-Many_Bad_Chars.docx"`

4. **Colon in Time Format**
   - Input: `"Meeting 14:30 - 15:00.docx"`
   - Expected: `"Meeting 14-30 - 15-00.docx"`

5. **Consecutive Separators**
   - Input: `"File///Name.docx"`
   - Expected: `"File-Name.docx"`

6. **Leading/Trailing Separators**
   - Input: `"/Leading and Trailing/.docx"`
   - Expected: `"Leading and Trailing.docx"`

7. **Empty After Sanitization**
   - Input: `"////.docx"`
   - Expected: `"untitled.docx"` (or use document ID)

8. **Windows Reserved Names**
   - Input: `"CON.docx"` (on Windows)
   - Expected: `"_CON.docx"`

9. **Length Truncation**
   - Input: Very long filename with slashes
   - Expected: Truncated to 255 chars, preserving extension

10. **Folder Path Sanitization**
    - Input: `"Parent/Child/Grandchild"`
    - Expected: Each component sanitized separately

### Integration Tests

**File:** `src/__tests__/integration/filename-sanitization.test.ts`

Test scenarios:

1. **End-to-End Export with Problematic Filenames**
   - Mock Quip API to return documents with slash-containing titles
   - Verify successful export without ENOENT errors
   - Verify files exist with sanitized names

2. **Folder Structure with Slashes**
   - Mock folder paths containing slashes
   - Verify folder structure is created correctly
   - Verify files are placed in correct sanitized folders

3. **Conflict Resolution with Sanitized Names**
   - Create scenario where sanitization causes name collision
   - Verify numbered suffix strategy works correctly

### Manual Testing Checklist

- [ ] Export document titled "24/07/2023 - Meeting"
- [ ] Export document titled "Project: Phase 1"
- [ ] Export document titled "File\\With\\Backslashes"
- [ ] Export document with folder path "Parent/Child"
- [ ] Export 300+ documents to verify no regression
- [ ] Test on macOS (primary issue platform)
- [ ] Test on Windows (verify no regression)
- [ ] Test on Linux (verify no regression)

## Implementation Notes

### Character Replacement Strategy

| Character | Replacement | Reason |
|-----------|-------------|--------|
| `/` | `-` | Common in dates, hyphen preserves readability |
| `\` | `-` | Consistency with forward slash |
| `:` | `-` | Common in times, hyphen preserves readability |
| `*` | `_` | Less common, underscore is safe |
| `?` | `_` | Less common, underscore is safe |
| `"` | `_` | Less common, underscore is safe |
| `<` | `_` | Less common, underscore is safe |
| `>` | `_` | Less common, underscore is safe |
| `\|` | `_` | Less common, underscore is safe |

### Performance Considerations

- Sanitization is O(n) where n is filename length
- Regex replacement is efficient for small strings (typical filenames)
- No significant performance impact expected
- Sanitization happens once per document during export

### Backward Compatibility

- Existing exports with underscores will continue to work
- New exports will use hyphens for slashes/colons
- Users may see different naming patterns between old and new exports
- Document this in CHANGELOG.md

## Migration Path

### For Existing Users

1. **No Action Required**: Existing exported files are not affected
2. **Re-export Option**: Users can re-export to get consistent naming
3. **Documentation**: Update USAGE_GUIDE.md with examples of sanitization

### Configuration Option (Future Enhancement)

Consider adding configuration for sanitization strategy:

```typescript
interface LocalDirectoryConfig {
  sanitizeFileNames: boolean;
  sanitizationStrategy?: {
    slashReplacement: '-' | '_';
    colonReplacement: '-' | '_';
    otherReplacement: '_';
  };
}
```

## Security Considerations

1. **Path Traversal Prevention**: Sanitization prevents `../` attacks
2. **Null Byte Injection**: Existing check for `\0` remains
3. **Reserved Names**: Windows reserved names are handled
4. **Length Limits**: Filenames truncated to prevent buffer issues

## Monitoring and Logging

### Log Levels

- **DEBUG**: Every sanitization operation with before/after
- **INFO**: Significant sanitization changes (>30% chars changed)
- **WARN**: Fallback to document ID due to empty result
- **ERROR**: Sanitization failures (should never happen)

### Metrics to Track

- Number of documents with sanitized filenames
- Most common problematic characters
- Sanitization failures (should be zero)

## Future Enhancements

1. **Configurable Replacement Strategy**: Let users choose hyphen vs underscore
2. **Preserve Original Mapping**: Store mapping of original to sanitized names
3. **Smart Date Detection**: Recognize date patterns and format consistently
4. **Unicode Normalization**: Handle accented characters and emoji
5. **Collision Detection**: Warn when sanitization causes name collisions
