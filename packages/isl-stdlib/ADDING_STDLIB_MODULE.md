# Adding a New Stdlib Module

This guide explains how to add a new standard library module to the ISL ecosystem.

## Overview

Stdlib modules are reusable ISL domain definitions that provide common patterns like authentication, payments, rate limiting, etc. They are published as npm packages under the `@isl-lang/stdlib-*` namespace.

## Prerequisites

- Understanding of ISL domain syntax
- Familiarity with the existing stdlib modules
- Node.js 18+ and pnpm installed

## Quick Start

1. Create ISL files in `stdlib/{module-name}/`
2. Add metadata to `src/generate-registry.ts`
3. Run `pnpm run generate-registry` to update the registry
4. Run tests to verify

## Step 1: Create the ISL Files

Create a new directory under `stdlib/` for your module:

```bash
mkdir -p stdlib/mymodule
```

Create your main ISL file(s) in `stdlib/mymodule/`. For example, `stdlib/mymodule/domain.isl`:

```isl
# My Module Domain
# Version: 1.0.0

module MyModule version "1.0.0"

# ============================================
# Types
# ============================================

type MyId = UUID

type MyStatus = enum { ACTIVE, INACTIVE }

# ============================================
# Entities
# ============================================

entity MyEntity {
  id: MyId [immutable, unique, indexed]
  status: MyStatus [default: ACTIVE]
  created_at: Timestamp [immutable]
  
  invariants {
    status != null
  }
}

# ============================================
# Behaviors
# ============================================

behavior CreateMyEntity {
  description: "Create a new entity"
  
  input {
    name: String
  }
  
  output {
    success: MyEntity
    
    errors {
      VALIDATION_ERROR {
        when: "Input validation failed"
        retriable: false
      }
    }
  }
  
  pre {
    name.length > 0
  }
  
  post success {
    MyEntity.exists(result.id)
    result.status == ACTIVE
  }
}
```

## Step 2: Add Module Metadata

Edit `src/generate-registry.ts` to add your module's metadata:

```typescript
const MODULE_METADATA: Record<string, {...}> = {
  // ... existing modules ...
  
  'stdlib-mymodule': {
    name: '@isl-lang/stdlib-mymodule',
    description: 'Description of what this module does',
    category: 'infrastructure', // One of: security, compliance, business, communication, storage, infrastructure, architecture, data, operations, ai
    dependencies: [],
    peerDependencies: [],
    keywords: ['mymodule', 'keyword1', 'keyword2'],
  },
};

// Also update the module mapping
const moduleMapping = {
  // ... existing mappings ...
  'mymodule': 'stdlib-mymodule',
};
```

## Step 3: Generate the Registry

Run the registry generation script to create hashes and update the registry:

```bash
cd packages/isl-stdlib
pnpm run generate-registry
```

This will:
1. Scan your ISL files in `stdlib/mymodule/`
2. Compute SHA-256 content hashes for each file
3. Compute an aggregate module hash
4. Extract entities, behaviors, types, and enums from the ISL files
5. Update `registry.json` with the new module
6. Update `src/registry-data.ts` for build-time inclusion

## Step 4: Verify the Registry

Check that your module is correctly registered:

```bash
pnpm run validate-registry
```

Run the smoke tests:

```bash
pnpm test
```

## Step 5: Add Tests (Recommended)

Create tests for your module in `tests/`:

```typescript
// tests/mymodule.test.ts
import { describe, it, expect } from 'vitest';
import { getModule, resolveStdlibImport } from '../src/index.js';

describe('stdlib-mymodule', () => {
  it('resolves stdlib-mymodule module', () => {
    const module = getModule('stdlib-mymodule');
    expect(module).toBeDefined();
    expect(module?.name).toBe('@isl-lang/stdlib-mymodule');
    expect(module?.status).toBe('implemented');
  });

  it('provides MyEntity entity', () => {
    const module = getModule('stdlib-mymodule');
    expect(module?.provides.entities).toContain('MyEntity');
  });

  it('has module hash for integrity', () => {
    const module = getModule('stdlib-mymodule');
    expect(module?.moduleHash).toHaveLength(64);
  });
});
```

## Module Categories

Choose the appropriate category for your module:

| Category | Description | Examples |
|----------|-------------|----------|
| `security` | Auth, rate limiting, security | stdlib-auth |
| `compliance` | Audit, logging, compliance | stdlib-audit (planned) |
| `business` | Business logic patterns | stdlib-payments |
| `communication` | Messaging, notifications | (planned) |
| `storage` | File storage, data | stdlib-uploads |
| `infrastructure` | Caching, queues, scheduling | (planned) |
| `architecture` | Event sourcing, workflows | (planned) |
| `data` | Search, analytics | (planned) |
| `operations` | Observability, metrics | (planned) |
| `ai` | AI/ML integrations | (planned) |

## Registry Format

Each module in the registry has the following structure:

```json
{
  "stdlib-mymodule": {
    "name": "@isl-lang/stdlib-mymodule",
    "version": "1.0.0",
    "description": "Description of what this module does",
    "category": "infrastructure",
    "status": "implemented",
    "entryPoint": "mymodule/domain.isl",
    "exports": {
      ".": "mymodule/domain.isl",
      "/domain": "mymodule/domain.isl"
    },
    "files": [
      {
        "path": "mymodule/domain.isl",
        "contentHash": "sha256-hash-of-file-content"
      }
    ],
    "moduleHash": "sha256-aggregate-of-all-file-hashes",
    "provides": {
      "entities": ["MyEntity"],
      "behaviors": ["CreateMyEntity"],
      "enums": ["MyStatus"],
      "types": ["MyId"]
    },
    "dependencies": [],
    "peerDependencies": [],
    "keywords": ["mymodule", "keyword1", "keyword2"]
  }
}
```

## Content Hashes

Each module has:

1. **File Content Hashes**: SHA-256 hash of each ISL file's content
2. **Module Hash**: Aggregate hash computed from sorted file hashes

These hashes enable:
- **Integrity verification**: Detect tampering or corruption
- **Version pinning**: Record exact stdlib versions used during verification
- **Reproducibility**: Ensure the same stdlib was used across builds

### Verifying Hashes

You can verify file hashes manually:

```bash
# On Linux/Mac
sha256sum stdlib/mymodule/domain.isl

# On Windows (PowerShell)
Get-FileHash stdlib/mymodule/domain.isl -Algorithm SHA256
```

## Version Pinning

When verifying ISL specs that import stdlib modules, the verification system records:

```typescript
interface StdlibVersionPin {
  moduleName: string;    // 'stdlib-mymodule'
  version: string;       // '1.0.0'
  moduleHash: string;    // SHA-256 aggregate hash
  entryPoint: string;    // 'mymodule/domain.isl'
}
```

This is included in proof bundles for reproducibility and audit trails.

## Best Practices

1. **Naming**: Use `stdlib-{noun}` format (e.g., `stdlib-auth`, not `stdlib-authentication`)

2. **File Organization**: 
   - One file per major concern
   - Use descriptive filenames like `oauth-login.isl`, `password-reset.isl`

3. **Dependencies**: Minimize dependencies. Only add if truly required.

4. **Keywords**: Add relevant keywords for discoverability

5. **Version**: Start at `1.0.0` for new modules

6. **Documentation**: Add comments in ISL files explaining complex behaviors

## Import Aliases

Users can import your module using various aliases:

```isl
# All these work:
use @isl/stdlib-mymodule
use @isl/mymodule
use stdlib-mymodule
```

The registry automatically creates these aliases when you run `generate-registry`.

## Checklist

Before submitting:

- [ ] ISL files created in `stdlib/{module}/`
- [ ] Metadata added to `generate-registry.ts`
- [ ] Registry regenerated with `pnpm run generate-registry`
- [ ] Registry validates (`pnpm run validate-registry`)
- [ ] Tests pass (`pnpm test`)
- [ ] Module has correct category
- [ ] Module has meaningful keywords
- [ ] Files follow ISL syntax conventions
- [ ] Content hashes are valid (auto-generated)

## Troubleshooting

### "Module not found in registry"

Run `pnpm run generate-registry` to regenerate the registry.

### "Hash mismatch"

If file hashes don't match, the ISL files may have been modified after registry generation. Regenerate the registry.

### "Category not found"

Ensure you're using one of the valid categories listed in the Categories section.

### "Missing entries in provides"

The generator extracts symbols automatically. Ensure your ISL files use correct syntax:
- `entity Name {` for entities
- `behavior Name {` for behaviors
- `type Name = enum {` for enums
- `type Name = ...` for types
