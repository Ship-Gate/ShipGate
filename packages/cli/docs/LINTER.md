# ISL Linter

A comprehensive linter for ISL (Intent Specification Language) with 10 high-signal rules.

## Usage

```bash
isl lint <file.isl>
isl lint <file.isl> --format json
isl lint <file.isl> --strict  # Treat warnings as errors
```

## Rules

### 1. unused-symbols (warning)
Detects entities, types, enums, and behaviors that are declared but never referenced.

**Example:**
```isl
domain Test {
  entity UnusedEntity {  // ⚠️ Warning: unused
    id: UUID
  }
  
  behavior CreateUser {
    input { name: String }
    output { success: String }
  }
}
```

### 2. duplicate-behaviors (error)
Detects behaviors with duplicate names in the same domain.

**Example:**
```isl
domain Test {
  behavior CreateUser { ... }
  behavior CreateUser { ... }  // ❌ Error: duplicate
}
```

### 3. overly-broad-invariants (warning)
Detects invariants that are too generic (e.g., `true`, `x == x`).

**Example:**
```isl
domain Test {
  invariants {
    true  // ⚠️ Warning: overly broad
  }
}
```

### 4. ambiguous-imports (warning)
Detects imports that could resolve to multiple symbols.

**Example:**
```isl
imports {
  { User } from "./types1.isl"
  { User } from "./types2.isl"  // ⚠️ Warning: ambiguous
}
```

### 5. unreachable-constraints (warning)
Detects postconditions that can never be satisfied due to preconditions.

**Example:**
```isl
behavior Test {
  pre { x == 0 }
  post success { x == 1 }  // ⚠️ Warning: unreachable
}
```

### 6. missing-preconditions (warning)
Behaviors should have preconditions to specify valid inputs.

**Example:**
```isl
behavior CreateUser {
  input { email: String }
  // ⚠️ Warning: no preconditions
  output { success: User }
}
```

### 7. unused-imports (warning)
Detects imported symbols that are never used.

**Example:**
```isl
imports {
  { User, UnusedType } from "./types.isl"  // ⚠️ Warning: UnusedType unused
}
```

### 8. missing-error-handling (info)
Behaviors should define error outputs for failure cases.

**Example:**
```isl
behavior CreateUser {
  output {
    success: User
    // ℹ️ Info: no error outputs
  }
}
```

### 9. circular-dependencies (error)
Detects circular import dependencies.

**Example:**
```isl
// file1.isl
imports { { User } from "./file2.isl" }

// file2.isl
imports { { Order } from "./file1.isl" }  // ❌ Error: circular
```

### 10. inconsistent-naming (info)
Detects inconsistent naming conventions (PascalCase vs camelCase).

**Example:**
```isl
domain Test {
  entity user {  // ℹ️ Info: should be PascalCase
    id: UUID
    UserName: String  // ℹ️ Info: should be camelCase
  }
}
```

## Output Formats

### Pretty (default)
```
Errors:
  ✗ Duplicate behavior 'CreateUser' [duplicate-behaviors]

Warnings:
  ⚠ Entity 'UnusedEntity' is declared but never referenced [unused-symbols]

Completed in 45ms
```

### JSON
```json
{
  "success": false,
  "file": "/path/to/file.isl",
  "issues": [
    {
      "rule": "duplicate-behaviors",
      "severity": "error",
      "message": "Duplicate behavior 'CreateUser'",
      "file": "/path/to/file.isl",
      "line": 10,
      "column": 3,
      "suggestion": "Rename or remove duplicate behavior"
    }
  ],
  "stats": {
    "errors": 1,
    "warnings": 1,
    "info": 0
  },
  "duration": 45
}
```

### Quiet
```
/path/to/file.isl:10:3: Duplicate behavior 'CreateUser'
```

## Integration

The linter integrates with the ISL CLI and can be used in CI/CD pipelines:

```bash
# CI usage
isl lint spec.isl --format json | jq '.success'
```

## Rule Configuration

Rules can be enabled/disabled via semantic analysis passes. See `@isl-lang/semantic-analysis` for details.
