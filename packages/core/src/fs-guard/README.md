# Filesystem Guard Module

Provides secure filesystem operations that prevent directory traversal attacks, path injection vulnerabilities, and unauthorized writes.

## Overview

The fs-guard module offers two primary protections:

1. **Safe Path Operations** - Validates and sanitizes file paths to prevent:
   - Directory traversal (`../` attacks)
   - Absolute path injection
   - UNC path exploits (Windows network paths)
   - Null byte injection
   - Path escape attempts

2. **Write Guard** - Enforces allowlist-based directory restrictions:
   - Only allows writes to configured directories
   - Blocks sensitive files (`.env`, credentials, etc.)
   - Prevents dangerous file types
   - Tracks and reports blocked attempts

## Installation

The module is part of `@isl-lang/core`:

```typescript
import {
  safeJoin,
  createWriteGuard,
  WriteGuard,
} from '@isl-lang/core';
```

## Safe Path Operations

### `safeJoin(root, relPath, config?)`

Safely joins a root path with a relative path, ensuring the result stays within the root directory.

```typescript
import { safeJoin } from '@isl-lang/core';

// Valid paths
const result = safeJoin('/app/workspace', 'src/index.ts');
// {
//   valid: true,
//   resolvedPath: '/app/workspace/src/index.ts',
//   originalPath: 'src/index.ts'
// }

// Blocked: Directory traversal
safeJoin('/app/workspace', '../../../etc/passwd');
// { valid: false, errorCode: 'PATH_TRAVERSAL', errorMessage: '...' }

// Blocked: Absolute path
safeJoin('/app/workspace', '/etc/passwd');
// { valid: false, errorCode: 'ABSOLUTE_PATH', errorMessage: '...' }

// Blocked: UNC path (Windows)
safeJoin('/app/workspace', '\\\\server\\share\\file');
// { valid: false, errorCode: 'UNC_PATH', errorMessage: '...' }

// Blocked: Null byte injection
safeJoin('/app/workspace', 'file.txt\0.exe');
// { valid: false, errorCode: 'NULL_BYTE', errorMessage: '...' }
```

### `validateRelativePath(relPath)`

Validates a relative path without joining it to a root.

```typescript
import { validateRelativePath } from '@isl-lang/core';

validateRelativePath('src/utils/index.ts');
// { valid: true, originalPath: 'src/utils/index.ts' }

validateRelativePath('../secret.txt');
// { valid: false, errorCode: 'PATH_TRAVERSAL' }
```

### `isPathWithin(parent, child)`

Checks if a path is safely contained within another.

```typescript
import { isPathWithin } from '@isl-lang/core';

isPathWithin('/app', '/app/src/index.ts');  // true
isPathWithin('/app', '/app/../etc/passwd'); // false
isPathWithin('/app', '/other/file.txt');    // false
```

### `sanitizeFilename(filename)`

Sanitizes a filename by removing dangerous characters.

```typescript
import { sanitizeFilename } from '@isl-lang/core';

sanitizeFilename('file<>:name.txt');     // 'file___name.txt'
sanitizeFilename('../../../etc/passwd'); // '______etc_passwd'
sanitizeFilename('normal-file.ts');      // 'normal-file.ts'
```

## Write Guard

### Creating a Write Guard

```typescript
import { createWriteGuard, WriteGuard } from '@isl-lang/core';

// Using factory function with defaults
const guard = createWriteGuard('/app/workspace');

// Or with custom allowed directories
const customGuard = createWriteGuard('/app/workspace', [
  'src/',
  'app/',
  'generated/',
]);

// Or using the class directly for full control
const advancedGuard = new WriteGuard({
  root: '/app/workspace',
  allowedDirs: ['src/', 'app/', 'packages/'],
  allowedExtensions: ['.ts', '.tsx', '.js', '.json'],
  sensitivePatterns: [/\.env/i, /secrets/i],
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowOverwrite: true,
  dryRun: false,
});
```

### Validating Write Operations

```typescript
// Validate before writing
const result = guard.validate('src/components/Button.tsx');

if (result.allowed) {
  console.log('Safe to write to:', result.validatedPath);
} else {
  console.error('Blocked:', result.errorCode, result.reason);
}

// Examples of blocked paths
guard.validate('node_modules/package/index.js');
// { allowed: false, errorCode: 'DISALLOWED_DIR', reason: '...' }

guard.validate('src/.env');
// { allowed: false, errorCode: 'SENSITIVE_FILE', reason: '...' }

guard.validate('../../../etc/passwd');
// { allowed: false, errorCode: 'PATH_TRAVERSAL', reason: '...' }
```

### Writing Files

```typescript
// Write with full protection
const writeResult = await guard.write(
  'src/index.ts',
  'export default {};',
  { createDirs: true }
);

if (writeResult.allowed) {
  console.log('File written successfully');
} else {
  console.error('Write blocked:', writeResult.reason);
}
```

### Batch Validation

```typescript
const paths = [
  'src/index.ts',
  'src/utils/helpers.ts',
  'node_modules/bad.js',
  '../escape.txt',
];

const results = guard.validateBatch(paths);

for (const [path, result] of results) {
  console.log(`${path}: ${result.allowed ? 'OK' : result.errorCode}`);
}
```

### Statistics and Monitoring

```typescript
// Get write statistics
const stats = guard.getStats();
console.log(`Total attempts: ${stats.totalAttempts}`);
console.log(`Blocked: ${stats.blockedWrites}`);
console.log(`Last blocked: ${stats.lastBlockedPath}`);

// Reset statistics
guard.resetStats();
```

## Default Allowed Directories

The default allowlist includes common safe directories:

```typescript
const DEFAULT_ALLOWED_DIRS = [
  'src/',
  'app/',
  'packages/',
  'lib/',
  'components/',
  'generated/',
  '.vibecheck/',
];
```

## Sensitive File Patterns

These patterns are blocked by default:

- `.env` files (`.env`, `.env.local`, `.env.production`)
- Private keys (`.pem`, `.key`, `id_rsa`)
- Certificates (`.p12`)
- Credential files (`credentials.json`, `secrets.json`)
- System files (`passwd`, `shadow`, `.htpasswd`)

## Error Codes

| Code | Description |
|------|-------------|
| `PATH_TRAVERSAL` | Path contains `..` segments |
| `ABSOLUTE_PATH` | Path is absolute instead of relative |
| `UNC_PATH` | Windows UNC network path detected |
| `NULL_BYTE` | Path contains null bytes |
| `EMPTY_PATH` | Path is empty or whitespace |
| `INVALID_CHARS` | Path contains invalid characters |
| `OUTSIDE_ROOT` | Resolved path escapes root directory |
| `DISALLOWED_DIR` | Write to directory not in allowlist |
| `SENSITIVE_FILE` | Attempting to write sensitive file |
| `SYMLINK_ESCAPE` | Symlink points outside allowed area |

## Security Considerations

1. **Always validate user input** - Never trust paths from external sources
2. **Use allowlists, not blocklists** - Explicitly allow safe directories
3. **Check resolved paths** - Validate after path resolution, not before
4. **Consider symlinks** - They can be used to escape restrictions
5. **Handle encoding** - URL-encoded and double-encoded paths can bypass checks

## Example: Secure Code Generator

```typescript
import { createWriteGuard } from '@isl-lang/core';

async function generateCode(workspace: string, files: Map<string, string>) {
  const guard = createWriteGuard(workspace, ['generated/', 'src/']);
  
  const results = {
    written: [] as string[],
    blocked: [] as string[],
  };
  
  for (const [path, content] of files) {
    const result = await guard.write(path, content, { createDirs: true });
    
    if (result.allowed) {
      results.written.push(path);
    } else {
      results.blocked.push(`${path}: ${result.reason}`);
    }
  }
  
  return results;
}
```

## API Reference

### Safe Path Functions

| Function | Description |
|----------|-------------|
| `safeJoin(root, relPath, config?)` | Safely join paths |
| `safeJoinMultiple(root, segments, config?)` | Join multiple segments |
| `validateRelativePath(relPath)` | Validate a relative path |
| `isPathWithin(parent, child)` | Check path containment |
| `normalizePath(path, caseSensitive?)` | Normalize for comparison |
| `extractRelativePath(root, fullPath)` | Extract relative portion |
| `sanitizeFilename(filename)` | Remove dangerous characters |

### WriteGuard Methods

| Method | Description |
|--------|-------------|
| `validate(relPath, options?)` | Validate a write operation |
| `write(relPath, content, options?)` | Write with protection |
| `validateBatch(paths)` | Validate multiple paths |
| `getStats()` | Get operation statistics |
| `resetStats()` | Reset statistics |
| `isDirectoryAllowed(dir)` | Check if directory is allowed |
| `addAllowedDir(dir)` | Add to allowlist |
| `removeAllowedDir(dir)` | Remove from allowlist |
