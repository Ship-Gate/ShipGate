# ISL Code Generation Conventions

## Overview

This document defines the conventions for deterministic code generation in ISL. Following these conventions ensures that generated code is **stable**, **predictable**, and produces **minimal diffs** between regeneration runs.

## Core Principles

### 1. Determinism First
Every code generation run with the same input MUST produce byte-for-byte identical output. This means:
- No timestamps in generated code (use `@generated` markers instead)
- No random identifiers
- Sorted collections (imports, properties, etc.)
- Consistent formatting

### 2. Stable Ordering
All collections in generated code follow deterministic ordering rules:

| Collection Type | Ordering Strategy |
|----------------|-------------------|
| Imports | Alphabetical by module path |
| Type definitions | Topological sort (dependencies first), then alphabetical |
| Interface properties | Declaration order from ISL, then alphabetical for computed |
| Enum values | Declaration order from ISL |
| Function parameters | Declaration order from ISL |

### 3. Stable File Naming

File names are derived deterministically from ISL domain elements:

```
{domain-kebab}/{element-type}/{element-kebab}.{ext}

Examples:
- auth-domain/types/user.ts
- auth-domain/behaviors/login.ts
- auth-domain/schemas/user.schema.ts
```

**Naming transformations:**
- `PascalCase` → `kebab-case` for file names
- Domain name becomes root directory
- Element type becomes subdirectory

## Generated File Structure

### Header Block (Required)

Every generated file MUST start with a deterministic header:

```typescript
/**
 * @generated - DO NOT EDIT
 * Source: {relative-path-to-isl-file}
 * Generator: @isl-lang/{generator-package}@{version}
 * Hash: {content-hash-of-input}
 */
```

The header includes:
- `@generated` marker for tooling detection
- Source ISL file path (relative to workspace root)
- Generator package and version
- Content hash for change detection

### Import Section

Imports are organized in groups with blank lines between:

```typescript
// 1. External packages (alphabetical)
import { z } from 'zod';

// 2. ISL runtime imports (alphabetical)
import type { Result } from '@isl-lang/runtime';

// 3. Generated siblings (alphabetical, relative paths)
import type { User } from './user.js';
import type { UserStatus } from './user-status.js';
```

### Type Declaration Section

Types are emitted in dependency order:

1. **Utility types** (UUID, Timestamp, etc.)
2. **Enums** (no dependencies)
3. **Type aliases** (simple → complex)
4. **Interfaces** (leaf → composite)
5. **Behavior types** (input → output → result)

## Formatting Rules

### Indentation
- 2 spaces for TypeScript/JavaScript
- 4 spaces for Python
- Tabs for Go

### Line Length
- Maximum 100 characters
- Break after opening bracket/brace for multi-line

### Trailing Commas
- Always use trailing commas in multi-line lists
- No trailing commas in single-line lists

### Blank Lines
- 1 blank line between top-level declarations
- No blank lines inside type bodies (unless grouping)
- 2 blank lines before major section comments

### Section Comments

Major sections are marked with comment blocks:

```typescript
// ============================================================================
// Section Name
// ============================================================================
```

## Deterministic Utilities

### Import Sorter

```typescript
import { sortImports } from '@isl-lang/codegen-core';

const sorted = sortImports(imports, {
  groups: ['external', 'isl', 'sibling', 'parent'],
  alphabetize: true,
  removeUnused: true,
});
```

### Type Sorter

```typescript
import { topologicalSort } from '@isl-lang/codegen-core';

const orderedTypes = topologicalSort(types, {
  getDependencies: (t) => t.references,
  tieBreaker: (a, b) => a.name.localeCompare(b.name),
});
```

### Content Hasher

```typescript
import { hashContent } from '@isl-lang/codegen-core';

const hash = hashContent(islSource, { algorithm: 'sha256', length: 8 });
// => "a1b2c3d4"
```

## Language-Specific Rules

### TypeScript

```typescript
// ✅ Good - deterministic
export interface User {
  readonly id: UUID;
  email: string;
  name: string;
  status: UserStatus;
}

// ❌ Bad - non-deterministic field order
export interface User {
  name: string;      // alphabetical, not declaration order
  email: string;
  id: UUID;
  status: UserStatus;
}
```

### Python

```python
# ✅ Good - deterministic
@dataclass
class User:
    id: UUID
    email: str
    name: str
    status: UserStatus
```

### Go

```go
// ✅ Good - deterministic
type User struct {
    ID     UUID       `json:"id"`
    Email  string     `json:"email"`
    Name   string     `json:"name"`
    Status UserStatus `json:"status"`
}
```

## Testing Determinism

### Golden Snapshot Testing

All generators must have golden snapshot tests:

```typescript
import { assertSnapshot } from '@isl-lang/test-utils';

test('generates deterministic output', async () => {
  const output = await generate(domain, options);
  
  // Snapshot comparison
  await assertSnapshot(output, 'auth-domain.snap');
  
  // Verify multiple runs produce same output
  const output2 = await generate(domain, options);
  expect(output).toEqual(output2);
});
```

### Diff Testing

Test that regeneration produces no diff:

```typescript
test('regeneration produces no diff', async () => {
  const first = await generate(domain);
  const second = await generate(domain);
  
  expect(diff(first, second)).toBe('');
});
```

## Generator Implementation Checklist

When implementing a new generator:

- [ ] Use `@isl-lang/codegen-core` for utilities
- [ ] Implement deterministic import sorting
- [ ] Implement topological type sorting
- [ ] Use content hashing for headers
- [ ] Add golden snapshot tests
- [ ] Add diff stability tests
- [ ] Follow language-specific formatting rules
- [ ] Document any language-specific ordering rules

## Migration Guide

### From Non-Deterministic Generators

1. Run the old generator and capture output
2. Implement deterministic sorting
3. Run new generator
4. Review diff and update snapshots
5. Add stability tests

### Breaking Changes

Changes that affect output ordering are considered **breaking**:
- Import group changes
- Type ordering algorithm changes
- Field ordering changes

Announce in changelog and bump major version.
