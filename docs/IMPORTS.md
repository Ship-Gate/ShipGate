# ISL Import System

This document explains how ISL resolves imports, bundles multiple files, and provides access to the standard library.

## Overview

ISL supports two modes of operation:

1. **Single-File Mode** (MVP) - No imports allowed
2. **Multi-File Mode** - Full import resolution with bundling

---

## Single-File Mode

When imports are disabled (default for simple use cases), any import statement produces an explicit error:

```isl
// spec.isl
import { User } from "./shared.isl"  // ERROR: Imports are not enabled

domain Auth {
  entity User { ... }
}
```

### Usage

```typescript
import { parseSingleFile } from '@isl-lang/import-resolver';

const result = parseSingleFile(source, 'spec.isl');

if (!result.success) {
  console.error(result.errors);
  // [{ code: 'IMPORTS_DISABLED', message: '...' }]
}
```

---

## Multi-File Mode

Enable imports to split specifications across files:

```isl
// main.isl
import { User, Session } from "./entities.isl"
import { LoginFlow } from "./flows.isl"

domain Auth {
  behavior Login {
    input { user: User }
    output { session: Session }
    preconditions { LoginFlow.allowed(user) }
  }
}
```

### Usage

```typescript
import { resolveAndBundle } from '@isl-lang/import-resolver';

const result = await resolveAndBundle('./main.isl', {
  enableImports: true,
  basePath: './specs',
});

if (result.success) {
  // result.bundle contains the merged AST
  console.log(result.bundle.entities);
}
```

---

## Standard Library

ISL provides a standard library of common specifications.

### Available Modules

| Module | Alias | Description |
|--------|-------|-------------|
| `@isl/auth` | `stdlib-auth` | Authentication patterns |
| `@isl/payments` | `stdlib-payments` | Payment processing |
| `@isl/uploads` | `stdlib-uploads` | File uploads |

### Using Stdlib

```isl
// Using canonical name
import { User, Session } from "@isl/auth"

// Using alias
use stdlib-auth

domain MyApp {
  // User and Session are now available
}
```

### Module Contents

#### @isl/auth

**Files:**
- `oauth-login.isl` - OAuth 2.0 login flow
- `password-reset.isl` - Password reset behavior
- `rate-limit-login.isl` - Rate-limited login
- `session-create.isl` - Session management

**Exports:**
```typescript
[
  'User',
  'Session', 
  'Role',
  'Permission',
  'Token',
  'Credential',
  'AuthResult',
  'LoginAttempt'
]
```

#### @isl/payments

**Files:**
- `process-payment.isl` - Payment processing
- `process-refund.isl` - Refund handling
- `subscription-create.isl` - Subscription management
- `webhook-handle.isl` - Payment webhooks

**Exports:**
```typescript
[
  'Payment',
  'Invoice',
  'Subscription',
  'Price',
  'Currency',
  'Transaction',
  'Refund',
  'Webhook'
]
```

#### @isl/uploads

**Files:**
- `store-blob.isl` - Blob storage
- `upload-image.isl` - Image uploads
- `validate-mime.isl` - MIME validation

**Exports:**
```typescript
[
  'File',
  'FileMetadata',
  'StorageProvider',
  'UploadResult',
  'MimeType',
  'Blob'
]
```

---

## Import Resolution Algorithm

### 1. Parse Entry File

```typescript
const ast = parse(source, filename);
```

### 2. Extract Imports

For each import statement:
- Validate import path syntax
- Resolve relative paths to absolute
- Resolve stdlib aliases to canonical names

### 3. Build Dependency Graph

```typescript
interface DependencyGraph {
  modules: Map<string, ResolvedModule>;
  entryPoint: string;
  sortedOrder: string[];  // Topological order
}
```

### 4. Detect Cycles

If A imports B and B imports A:
```
Error: CIRCULAR_DEPENDENCY
  A.isl → B.isl → A.isl
```

### 5. Topological Sort

Order modules from leaves to root for correct bundling.

### 6. Bundle Modules

Merge all modules into a single AST:
- Combine entities
- Combine behaviors
- Combine types
- Resolve naming conflicts

---

## Stdlib Registry

The stdlib registry maps module names to files and exports:

```typescript
// packages/import-resolver/src/stdlib-registry.ts

export interface StdlibModule {
  version: string;
  path: string;
  files: Record<string, string>;
  exports: string[];
  description: string;
}

export interface StdlibRegistry {
  version: string;
  modules: Record<string, StdlibModule>;
  aliases: Record<string, string>;
}
```

### Registry Manager

```typescript
import { getStdlibRegistry } from '@isl-lang/import-resolver';

const registry = getStdlibRegistry();

// Check if a module exists
if (registry.isStdlibModule('stdlib-auth')) {
  const resolved = registry.resolveModule('stdlib-auth');
  console.log(resolved.absolutePath);
  console.log(resolved.files);
}

// Resolve a specific file
const filePath = registry.resolveModuleFile('@isl/auth/oauth-login');
// → /path/to/stdlib/auth/oauth-login.isl

// Get module exports
const exports = registry.getModuleExports('@isl/auth');
// → ['User', 'Session', 'Role', ...]
```

---

## Import Path Rules

### Relative Imports

```isl
// Must start with ./ or ../
import { User } from "./entities.isl"      // ✓ Valid
import { Shared } from "../common/shared"  // ✓ Valid
import { User } from "entities.isl"        // ✗ Invalid
```

### Stdlib Imports

```isl
// Canonical form
import { User } from "@isl/auth"

// Alias form
use stdlib-auth

// Import specific file
import { OAuthLogin } from "@isl/auth/oauth-login"
```

### Invalid Characters

```isl
// These characters are not allowed in import paths
import { X } from "./file<name>.isl"  // ✗
import { X } from "./file|name.isl"   // ✗
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `IMPORTS_DISABLED` | Import used in single-file mode |
| `MODULE_NOT_FOUND` | Imported file doesn't exist |
| `PARSE_ERROR` | Imported file has syntax errors |
| `READ_ERROR` | File couldn't be read |
| `CIRCULAR_DEPENDENCY` | Import cycle detected |
| `MAX_DEPTH_EXCEEDED` | Too many nested imports |
| `DUPLICATE_TYPE` | Type defined in multiple files |
| `DUPLICATE_ENTITY` | Entity defined in multiple files |
| `DUPLICATE_BEHAVIOR` | Behavior defined in multiple files |
| `SYMBOL_NOT_FOUND` | Imported symbol doesn't exist in module |
| `AMBIGUOUS_IMPORT` | Symbol exists in multiple sources |
| `INVALID_IMPORT_PATH` | Path contains invalid characters |

### Error Examples

```
Error: CIRCULAR_DEPENDENCY
  Import cycle detected:
    main.isl → auth.isl → users.isl → main.isl
  
  Break the cycle by extracting shared types to a common file.
```

```
Error: SYMBOL_NOT_FOUND
  Cannot find 'UserRole' in module './entities.isl'
  
  Available exports: User, Session, Permission
  
  Did you mean 'Role'?
```

---

## Warning Codes

| Code | Description |
|------|-------------|
| `UNUSED_IMPORT` | Imported symbol never used |
| `SHADOWED_IMPORT` | Local definition shadows import |
| `DEPRECATED_MODULE` | Module is deprecated |

---

## Bundler Options

```typescript
interface BundlerOptions {
  /** Allow shadowing of imported symbols */
  allowShadowing?: boolean;
  
  /** Remove import statements from bundle */
  stripImports?: boolean;
  
  /** Override bundle domain name */
  bundleDomainName?: string;
  
  /** Override bundle version */
  bundleVersion?: string;
}
```

### Example: Bundle with Options

```typescript
const result = await resolveAndBundle('./main.isl', {
  enableImports: true,
  basePath: './specs',
  allowShadowing: true,  // Allow local definitions to shadow imports
  stripImports: true,    // Clean up bundle
  bundleDomainName: 'CombinedSpec',
  bundleVersion: '1.0.0',
});
```

---

## Virtual File System

For testing, use a virtual file system:

```typescript
import { createVirtualFS, resolveAndBundle } from '@isl-lang/import-resolver';

const fs = createVirtualFS({
  '/virtual/main.isl': `
    import { User } from "./user.isl"
    domain App { ... }
  `,
  '/virtual/user.isl': `
    domain UserTypes {
      entity User { id: ID, name: String }
    }
  `,
});

const result = await resolveAndBundle('/virtual/main.isl', {
  enableImports: true,
  basePath: '/virtual',
  readFile: fs.readFile,
  fileExists: fs.fileExists,
});
```

---

## Best Practices

### 1. Organize by Domain

```
specs/
├── main.isl           # Entry point
├── entities/
│   ├── user.isl
│   └── product.isl
├── behaviors/
│   ├── auth.isl
│   └── checkout.isl
└── types/
    └── common.isl
```

### 2. Use Selective Imports

```isl
// GOOD: Import only what you need
import { User, Session } from "./entities.isl"

// AVOID: Wildcard imports (not supported yet)
// import * from "./entities.isl"
```

### 3. Avoid Deep Nesting

```isl
// GOOD: Shallow imports
import { User } from "./entities/user.isl"

// AVOID: Deep chains that are hard to trace
import { User } from "../../shared/entities/user/types.isl"
```

### 4. Prefer Stdlib

```isl
// GOOD: Use standard patterns
use stdlib-auth

// AVOID: Reinventing standard patterns
entity User {
  id: ID
  email: Email
  // ... copying stdlib definitions
}
```

---

## Related Documentation

- [VERIFICATION.md](./VERIFICATION.md) - Proof bundle system
- [SEMANTICS.md](./SEMANTICS.md) - Semantic analysis
- [SYNTAX.md](./SYNTAX.md) - ISL syntax reference
