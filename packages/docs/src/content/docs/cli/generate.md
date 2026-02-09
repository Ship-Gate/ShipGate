---
title: "CLI: generate"
description: Generate TypeScript, Rust, Go, and OpenAPI code from ISL specifications.
---

The `gen` command generates code from ISL specifications. It produces type definitions, validators, and contract checkers for multiple target languages.

## Usage

```bash
shipgate gen <target> <file> [options]
```

## Targets

| Target       | Alias        | Output                                    |
| ------------ | ------------ | ----------------------------------------- |
| `typescript` | `ts`         | TypeScript interfaces, Zod validators     |
| `rust`       | `rust`       | Rust structs, enums, validators           |
| `go`         | `go`         | Go structs, interfaces                    |
| `openapi`    | `openapi`    | OpenAPI 3.0 specification                 |

## Options

| Flag                  | Description                              |
| --------------------- | ---------------------------------------- |
| `-o, --output <dir>`  | Output directory (default: stdout)       |
| `--force`             | Overwrite existing files                 |

## Examples

### TypeScript generation

```bash
# Generate TypeScript types
shipgate gen ts user-service.isl -o ./src/generated

# Short form
shipgate gen typescript user-service.isl -o ./src/generated
```

This produces:

```
src/generated/
  user-service.types.ts      # TypeScript interfaces
  user-service.validators.ts # Zod schemas
  user-service.contracts.ts  # Contract checkers
```

Example generated TypeScript:

```typescript
// user-service.types.ts
export interface User {
  id: string;          // UUID
  email: string;       // Email
  name: string;
  status: UserStatus;
  created_at: number;  // Timestamp
}

export enum UserStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export interface CreateUserInput {
  email: string;
  name: string;
}

export type CreateUserResult =
  | { success: true; data: User }
  | { success: false; error: "DUPLICATE_EMAIL" | "INVALID_INPUT" };
```

### Rust generation

```bash
shipgate gen rust user-service.isl -o ./src/generated
```

### Go generation

```bash
shipgate gen go user-service.isl -o ./generated
```

### OpenAPI generation

```bash
shipgate gen openapi api-service.isl -o ./docs/api
```

Produces an OpenAPI 3.0 YAML specification with:
- Path definitions from behaviors
- Schema definitions from entities
- Error response definitions
- Request/response body schemas

## Full build pipeline

The `build` command runs the complete pipeline: parse, check, generate, verify, and produce an evidence report.

```bash
shipgate build specs/*.isl [options]
```

### Build options

| Flag                        | Description                              |
| --------------------------- | ---------------------------------------- |
| `-o, --output <dir>`        | Output directory (default: `./generated`) |
| `-t, --target <target>`     | Code gen target (default: `typescript`)  |
| `--test-framework <fw>`     | Test framework: `vitest`, `jest` (default: `vitest`) |
| `--no-verify`               | Skip verification stage                  |
| `--no-html`                 | Skip HTML report generation              |
| `--no-chaos`                | Skip chaos test generation               |
| `--no-helpers`              | Skip helper file generation              |

### Build example

```bash
# Full build pipeline
shipgate build specs/*.isl -o ./src/generated

# Build for production
shipgate build specs/*.isl -o ./src/generated --target typescript --test-framework vitest
```

Build output structure:

```
generated/
  types/             # TypeScript interfaces
  validators/        # Zod schemas
  contracts/         # Contract checkers
  tests/             # Test stubs
  chaos/             # Chaos test files
  evidence/          # Verification evidence
  report.html        # HTML verification report
```

## ISL generation from code

Generate ISL specs from existing source code:

```bash
shipgate isl-generate <path> [options]
```

| Flag                        | Description                              |
| --------------------------- | ---------------------------------------- |
| `-o, --output <dir>`        | Output directory for `.isl` files        |
| `--dry-run`                 | Print to stdout instead of writing       |
| `--interactive`             | Confirm before writing each file         |
| `--overwrite`               | Overwrite existing `.isl` files          |
| `--confidence <threshold>`  | Minimum confidence 0-1 (default: `0.3`)  |
| `--ai`                      | Use AI enhancement                       |

```bash
# Generate specs from source code
shipgate isl-generate src/ -o specs/

# Preview without writing
shipgate isl-generate src/ --dry-run

# AI-enhanced generation
shipgate isl-generate src/ --ai -o specs/
```

## Exit codes

| Code | Meaning                |
| ---- | ---------------------- |
| `0`  | Generation successful  |
| `1`  | Generation error       |
| `2`  | Invalid arguments      |
