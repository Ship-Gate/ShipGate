# @isl-lang/import-resolver

ISL Import Resolution and Multi-File Bundling

## Overview

The Import Resolver package provides functionality for resolving local module imports in ISL specifications, detecting cycles, and bundling multiple ISL files into a single AST.

## Features

- **Local Module Imports**: Resolve `./foo.isl` and `../bar.isl` style relative imports
- **Cycle Detection**: Detect and report circular dependencies with clear error messages
- **Fragment Merging**: Merge types, entities, behaviors, and other fragments from multiple files
- **Conflict Detection**: Error on duplicate definitions (entities, types, behaviors with same name)
- **Stable Bundling**: Produce deterministic bundled AST with canonical ordering
- **MVP Mode Toggle**: Explicitly gate import resolution for single-file mode

## Installation

```bash
npm install @isl-lang/import-resolver
# or
pnpm add @isl-lang/import-resolver
```

## Quick Start

### Multi-File Mode (Imports Enabled)

```typescript
import { resolveAndBundle } from '@isl-lang/import-resolver';

const result = await resolveAndBundle('./main.isl', {
  basePath: './specs',
  enableImports: true,
});

if (result.success) {
  console.log('Bundled AST:', result.bundle);
} else {
  console.error('Errors:', result.errors);
}
```

### Single-File Mode (MVP Mode)

```typescript
import { parseSingleFile } from '@isl-lang/import-resolver';

const source = `
domain MyApp {
  version: "1.0.0"
  entity User { id: UUID }
}
`;

const result = parseSingleFile(source, 'spec.isl');

if (result.success) {
  console.log('Parsed AST:', result.bundle);
} else {
  // If the file has imports, this will fail with a clear error
  // explaining that single-file mode doesn't support imports
  console.error('Errors:', result.errors);
}
```

## Import Rules

### Supported Import Paths

Only relative paths are supported:

```isl
imports {
  User, Email from "./types.isl"       # Same directory
  Payment from "../billing/payment.isl" # Parent directory
  Config from "./config"                # Extension optional (.isl added)
}
```

### Unsupported Import Paths

The following import paths will result in errors:

```isl
imports {
  User from "types.isl"           # ❌ Not relative (missing ./)
  User from "/absolute/path.isl"  # ❌ Absolute paths not allowed
  User from "@stdlib/auth"        # ❌ Package imports not yet supported
}
```

### Import Items

Import specific symbols from a module:

```isl
imports {
  User from "./types.isl"                   # Single import
  User, Email, UserId from "./types.isl"    # Multiple imports
  User as AppUser from "./types.isl"        # Aliased import
}
```

## Merge Semantics

### What Gets Merged

When bundling multiple files, the following are merged:

| Fragment Type | Merge Behavior |
|--------------|----------------|
| Types        | Deduplicated by name (conflict if same name) |
| Entities     | Deduplicated by name (conflict if same name) |
| Behaviors    | Deduplicated by name (conflict if same name) |
| Invariants   | Deduplicated by name (conflict if same name) |
| Policies     | Deduplicated by name (conflict if same name) |
| Views        | Deduplicated by name (conflict if same name) |
| Scenarios    | All merged (duplicates allowed) |
| Chaos        | All merged (duplicates allowed) |

### Conflict Detection

By default, duplicate definitions result in errors:

```
[DUPLICATE_ENTITY] Duplicate entity "User" found:
  First defined in: types.isl (line 5)
  Also defined in: main.isl (line 10)

Each entity must have a unique name across all modules.
```

### Shadowing Mode

If you need to override definitions, enable shadowing:

```typescript
const result = await resolveAndBundle('./main.isl', {
  enableImports: true,
  allowShadowing: true,  // Last-write-wins
});
```

In shadowing mode:
- Later definitions override earlier ones (in topological order)
- Warnings are emitted for shadowed imports

### Canonical Ordering

The bundled AST maintains canonical ordering for deterministic output:

1. **Types**: Sorted alphabetically by name
2. **Entities**: Sorted alphabetically by name
3. **Behaviors**: Sorted alphabetically by name
4. **Invariants**: Sorted alphabetically by name
5. **Policies**: Sorted alphabetically by name
6. **Views**: Sorted alphabetically by name
7. **Scenarios**: Sorted by behavior name
8. **Chaos**: Sorted by behavior name

## Cycle Detection

Circular dependencies are detected and reported with clear paths:

```
[CIRCULAR_DEPENDENCY] Circular dependency detected:
  → /specs/a.isl
  → /specs/b.isl
  → /specs/c.isl
  → /specs/a.isl

Circular imports are not allowed.
Consider restructuring your modules to break the cycle.
```

### Diamond Dependencies

Diamond dependencies (multiple paths to the same module) are allowed:

```
main.isl
├── a.isl
│   └── shared.isl
└── b.isl
    └── shared.isl
```

The shared module is only included once in the bundle.

## MVP Mode Toggle

### Checking for Imports

```typescript
import { hasImports } from '@isl-lang/import-resolver';

const needsImportResolution = hasImports(source);
if (needsImportResolution) {
  // Use resolveAndBundle
} else {
  // Can use parseSingleFile
}
```

### Single-File Mode Error

When imports are disabled and a file has imports:

```
[IMPORTS_DISABLED] Import resolution is disabled (single-file mode).
Cannot import "./types.isl".
To enable multi-file imports, set 'enableImports: true' in resolver options.
Note: Multi-file mode requires all imported modules to be available.
```

## API Reference

### `resolveAndBundle(entryPoint, options)`

Resolve imports and bundle into a single AST.

```typescript
interface ResolveAndBundleOptions {
  basePath?: string;           // Base directory for imports
  enableImports?: boolean;     // Enable/disable import resolution
  allowShadowing?: boolean;    // Allow definition shadowing
  stripImports?: boolean;      // Remove import declarations from bundle
  bundleDomainName?: string;   // Custom domain name for bundle
  bundleVersion?: string;      // Custom version for bundle
  maxDepth?: number;           // Max import depth (default: 100)
}
```

### `parseSingleFile(source, filename)`

Parse a single file without import resolution.

```typescript
const result = parseSingleFile(source, 'spec.isl');
// Returns BundleResult
```

### `hasImports(source)`

Check if source has import declarations.

```typescript
const hasImports: boolean = hasImports(source);
```

### `validateImportPaths(source)`

Validate import paths without resolution.

```typescript
const { valid, errors } = validateImportPaths(source);
```

### `createVirtualFS(files, basePath)`

Create a virtual file system for testing.

```typescript
const vfs = createVirtualFS({
  'main.isl': 'domain Main { ... }',
  'types.isl': 'domain Types { ... }',
}, '/test');
```

## Limitations

### Current Limitations

1. **Only relative paths**: Package imports (`@stdlib/auth`) not yet supported
2. **No glob imports**: Cannot import `{ * } from "./module"`
3. **No re-exports**: Cannot re-export from modules
4. **No conditional imports**: All imports are unconditional

### Future Enhancements

- [ ] Package/workspace imports
- [ ] Glob imports (`import * as Types from "./types"`)
- [ ] Re-exports
- [ ] Import aliases at module level
- [ ] Lazy import resolution

## Error Codes

| Code | Description |
|------|-------------|
| `IMPORTS_DISABLED` | Import resolution disabled but file has imports |
| `MODULE_NOT_FOUND` | Import target file not found |
| `PARSE_ERROR` | Failed to parse imported module |
| `READ_ERROR` | Failed to read file |
| `CIRCULAR_DEPENDENCY` | Circular import detected |
| `MAX_DEPTH_EXCEEDED` | Import chain too deep |
| `DUPLICATE_TYPE` | Duplicate type definition |
| `DUPLICATE_ENTITY` | Duplicate entity definition |
| `DUPLICATE_BEHAVIOR` | Duplicate behavior definition |
| `SYMBOL_NOT_FOUND` | Imported symbol not exported |
| `INVALID_IMPORT_PATH` | Import path format invalid |

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

## License

MIT
