# ISL Module Resolution

This document specifies how ISL resolves module references in `use` statements.

## Syntax

ISL supports two syntaxes for importing modules:

### Use Statements (Whole Module)

```isl
use stdlib-auth                    # Import entire module
use stdlib-auth as auth            # Import with alias
use stdlib-auth@1.0.0              # Import specific version
use stdlib-auth@1.0.0 as auth      # Version + alias
use "./local/module"               # Relative import
```

### Import Statements (Selective)

```isl
imports {
  { User, Session } from "stdlib-auth"
  { Payment } from "stdlib-payments"
}
```

## Search Path Precedence

When resolving a module specifier, ISL searches in the following order (highest to lowest priority):

1. **Explicit/Relative Paths** - Specifiers starting with `./` or `../`
   - Resolved relative to the importing file's directory
   - Extensions tried: `.isl`, `/index.isl`

2. **Project Modules** - Bare specifiers (e.g., `my-domain`)
   - Search paths: project root, `intents/`, `specs/`
   - Extensions tried: `.isl`, `/index.isl`

3. **Stdlib Modules** - Specifiers starting with `stdlib-`
   - Mapped to `@isl-lang/stdlib/<category>/<module>.isl`
   - See [Stdlib Mapping](#stdlib-mapping) below

4. **External Packages** - Specifiers starting with `@`
   - Resolved from `node_modules`
   - Follows Node.js resolution algorithm

## Resolution Algorithm

```
resolve(specifier: string, fromFile: string): ResolvedModule

1. Parse specifier to extract:
   - moduleName: base module name
   - version: optional version constraint (after @)
   - alias: optional alias (after "as")

2. If specifier starts with "./" or "../":
   a. basePath = dirname(fromFile)
   b. candidate = join(basePath, specifier)
   c. Try extensions in order: ["", ".isl", "/index.isl"]
   d. Return first existing file, or error MODULE_NOT_FOUND

3. If specifier starts with "stdlib-":
   a. category = inferCategory(specifier)  # auth, payments, uploads
   b. moduleName = specifier.replace("stdlib-", "")
   c. path = "@isl-lang/stdlib/{category}/{moduleName}.isl"
   d. Resolve from node_modules
   e. Return resolved path, or error MODULE_NOT_FOUND

4. If specifier starts with "@":
   a. Resolve using Node.js module resolution
   b. Return resolved path, or error MODULE_NOT_FOUND

5. Else (bare specifier):
   a. For each searchPath in [".", "intents/", "specs/"]:
      i.  candidate = join(projectRoot, searchPath, specifier)
      ii. Try extensions: ["", ".isl", "/index.isl"]
      iii. Return first existing file
   b. Error MODULE_NOT_FOUND
```

## Stdlib Mapping

The `stdlib-*` prefix maps to the `@isl-lang/stdlib` package:

| Specifier | Resolved Path |
|-----------|---------------|
| `stdlib-auth` | `@isl-lang/stdlib/auth/index.isl` |
| `stdlib-auth/session` | `@isl-lang/stdlib/auth/session-create.isl` |
| `stdlib-payments` | `@isl-lang/stdlib/payments/index.isl` |
| `stdlib-payments/refund` | `@isl-lang/stdlib/payments/process-refund.isl` |
| `stdlib-uploads` | `@isl-lang/stdlib/uploads/index.isl` |

### Available Stdlib Modules

```
stdlib-auth
├── oauth-login
├── password-reset
├── session-create
└── rate-limit-login

stdlib-payments
├── process-payment
├── process-refund
├── subscription-create
└── webhook-handle

stdlib-uploads
├── upload-image
├── store-blob
└── validate-mime
```

## Versioning

### Version Specifiers

- **No version**: `use stdlib-auth` - Resolves to latest compatible version
- **Exact version**: `use stdlib-auth@1.0.0` - Must match exactly
- **Future**: Semver ranges (`@^1.0.0`, `@~1.2.0`) may be supported

### Version Conflict Resolution

When the same module is imported with different versions:

1. If versions are identical → OK
2. If one import has no version → use the versioned one
3. If versions conflict → Error `E0712: VERSION_CONFLICT`

Example conflict:
```isl
# file-a.isl
use stdlib-auth@1.0.0

# file-b.isl  
use stdlib-auth@2.0.0  # ERROR: conflicts with file-a.isl
```

## Module Identity

A module's identity (`ModuleId`) is determined by its **normalized absolute path**:

- All path separators normalized to `/`
- Symlinks resolved to real paths
- Version included if specified: `@isl-lang/stdlib/auth@1.0.0`

This ensures the same module is never loaded twice.

## Circular Import Detection

ISL detects circular imports during module graph construction:

1. Build directed graph: nodes = modules, edges = imports
2. Run Tarjan's algorithm to find strongly connected components
3. Any SCC with size > 1 is a cycle
4. Report error `E0711: CIRCULAR_IMPORT` with full cycle chain

Example error message:
```
E0711: Circular import detected

  auth.isl
    └─► session.isl
        └─► user.isl
            └─► auth.isl  (cycle back)

To fix: Extract shared types to a common module that both can import.
```

## Caching

Parsed ASTs are cached per module to avoid repeated parsing:

- **Cache key**: ModuleId (normalized absolute path)
- **Invalidation**: File modification time (mtime) changes
- **Scope**: Per-process (not persisted to disk)

The cache is automatically invalidated when:
- File mtime changes
- `clear()` is called explicitly
- Process restarts

## Examples

### Basic Usage

```isl
domain MyApp {
  version: "1.0.0"
  
  # Use stdlib modules
  use stdlib-auth
  use stdlib-payments as pay
  
  # Use local modules
  use "./shared/types"
  
  # Selective imports
  imports {
    { User } from "stdlib-auth"
  }
  
  entity Order {
    user: User           # From stdlib-auth
    payment: pay.Payment # Aliased access
  }
}
```

### Project Structure

```
my-project/
├── intents/
│   ├── domain.isl      # use stdlib-auth
│   └── billing.isl     # use stdlib-payments
├── specs/
│   └── api.isl         # use "../intents/domain"
└── shared/
    └── types.isl       # Common types
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| E0710 | MODULE_NOT_FOUND | Module specifier could not be resolved |
| E0711 | CIRCULAR_IMPORT | Circular dependency detected in module graph |
| E0712 | VERSION_CONFLICT | Same module imported with incompatible versions |

See the [Error Catalog](../../errors/src/catalog.ts) for detailed explanations.
