# ISL Discovery Engine

Automatic implementation discovery and binding generation for ISL (Intent Specification Language).

## Overview

The ISL Discovery Engine automatically maps ISL specifications (behaviors, entities, types) to implementation code (functions, routes, classes) using multiple discovery strategies:

- **Filesystem heuristics** - Matches symbols based on file paths and directory structure
- **AST scanning** - Analyzes code structure to find exports, handlers, and routes
- **Naming conventions** - Matches symbols using naming pattern variations (camelCase, snake_case, etc.)
- **Route matching** - Maps behaviors to HTTP routes (e.g., `Login` → `POST /api/login`)

## Features

- ✅ Automatic symbol extraction from ISL specs
- ✅ Codebase scanning for functions, routes, and exports
- ✅ Multi-strategy matching with confidence scores
- ✅ Bindings file generation (`.shipgate.bindings.json`)
- ✅ Evidence tracking for each binding

## Usage

### CLI Command

```bash
# Basic usage
isl bind specs/auth.isl

# With options
isl bind specs/auth.isl --impl ./src --min-confidence 0.5

# Multiple spec files
isl bind specs/auth.isl specs/users.isl

# Custom output location
isl bind specs/auth.isl --output .bindings.json
```

### Programmatic API

```typescript
import { discover, writeBindingsFile } from '@isl-lang/isl-discovery';

const result = await discover({
  rootDir: './src',
  specFiles: ['specs/auth.isl'],
  minConfidence: 0.3,
  verbose: true,
});

await writeBindingsFile('.shipgate.bindings.json', result, ['specs/auth.isl']);
```

## Bindings Format

The discovery engine generates `.shipgate.bindings.json` files with the following structure:

```json
{
  "version": "1.0.0",
  "timestamp": "2026-02-09T12:00:00.000Z",
  "specs": ["specs/auth.isl"],
  "bindings": [
    {
      "isl": {
        "type": "behavior",
        "name": "Login",
        "domain": "UserAuthentication",
        "specFile": "specs/auth.isl",
        "location": {
          "start": { "line": 30, "column": 1 },
          "end": { "line": 74, "column": 1 }
        }
      },
      "code": {
        "type": "route",
        "name": "POST /api/login",
        "file": "src/routes/auth.ts",
        "location": {
          "start": { "line": 45, "column": 1 },
          "end": { "line": 45, "column": 1 }
        },
        "metadata": {
          "method": "POST",
          "path": "/api/login"
        }
      },
      "confidence": 0.85,
      "evidence": [
        {
          "type": "route_matching",
          "description": "Route path contains behavior name: POST /api/login",
          "confidence": 0.80
        }
      ],
      "strategy": "route_matching"
    }
  ]
}
```

## Discovery Strategies

### 1. Filesystem Heuristics

Matches symbols based on file paths:
- `Login` behavior → `routes/login.ts` or `handlers/login.ts`
- `User` entity → `models/user.ts` or `entities/user.ts`

**Confidence**: 0.60-0.75

### 2. AST Scanning

Analyzes code structure to find:
- Fastify route registrations (`app.get()`, `app.post()`, etc.)
- Exported functions (`export function`, `export const`)
- Class exports (`export class`)

**Confidence**: 0.70-0.85

### 3. Naming Conventions

Matches using naming variations:
- `CreateUser` → `createUser`, `create_user`, `CreateUser`
- Handles camelCase, PascalCase, snake_case conversions

**Confidence**: 0.65-0.85

### 4. Route Matching

Maps behaviors to HTTP routes:
- `CreateUser` → `POST /api/users`
- `GetUser` → `GET /api/users/:id`
- `DeleteUser` → `DELETE /api/users/:id`

**Confidence**: 0.80-0.85

## Confidence Scores

Confidence scores range from 0.0 to 1.0:

- **0.9-1.0**: Very high confidence (exact matches)
- **0.8-0.9**: High confidence (strong patterns)
- **0.6-0.8**: Medium confidence (reasonable matches)
- **0.3-0.6**: Low confidence (weak patterns)
- **<0.3**: Filtered out by default

## Options

- `rootDir` - Root directory to search (default: current directory)
- `specFiles` - ISL spec file(s) to bind
- `codeDirs` - Code directories to search (default: all)
- `includePatterns` - File patterns to include (default: `**/*.ts`, `**/*.js`)
- `excludePatterns` - File patterns to exclude (default: `**/node_modules/**`, `**/dist/**`)
- `minConfidence` - Minimum confidence threshold (default: 0.3)
- `enableAST` - Enable AST scanning (default: true)
- `enableFilesystem` - Enable filesystem heuristics (default: true)
- `enableNaming` - Enable naming convention matching (default: true)
- `verbose` - Verbose output (default: false)

## Examples

### Fastify Project

```bash
# Discover bindings for auth domain
isl bind specs/auth.isl --impl ./src --code-dirs src/routes,src/handlers

# Output:
# ✓ Bindings generated successfully
#   Output: .shipgate.bindings.json
#
# Statistics:
#   ISL symbols: 4
#   Code symbols: 12
#   Bindings: 4
#   Coverage: 100.0%
#   Average confidence: 82.5%
```

### Multiple Specs

```bash
isl bind specs/auth.isl specs/users.isl specs/payments.isl
```

## Integration

The bindings file can be used by:

- **Verification tools** - To verify implementations against specs
- **Code generation** - To generate type-safe wrappers
- **Documentation** - To generate API documentation
- **Testing** - To generate test cases from specs

## Limitations

- Requires consistent naming conventions for best results
- May produce false positives for generic names
- Confidence scores are heuristic-based, not guaranteed
- Complex codebases may require manual binding adjustments

## Future Improvements

- [ ] AST-based semantic analysis
- [ ] Type signature matching
- [ ] Import graph analysis
- [ ] Machine learning-based matching
- [ ] Support for more frameworks (Express, Hono, etc.)
