# ISL Migration V2 Demo

Demo runner for the ISL Migration V2 module. Demonstrates converting various source formats (OpenAPI, Zod, TypeScript) to ISL AST with open questions tracking.

## Quick Start

```bash
# Run the demo (from project root)
npx tsx bench/isl-migrate-demo/run.ts

# Run with specific format
npx tsx bench/isl-migrate-demo/run.ts --format=openapi

# Run with verbose output (shows open questions)
npx tsx bench/isl-migrate-demo/run.ts --verbose
```

## Options

| Option | Description |
|--------|-------------|
| `--format=<type>` | Source format to demo: `openapi`, `zod`, `typescript`, or `all` (default) |
| `--verbose`, `-v` | Show detailed output including open questions |
| `--help`, `-h` | Show help message |

## Sample Files

The demo uses sample files from `packages/core/src/isl-migrate-v2/samples/`:

- `openapi.json` - OpenAPI 3.0 specification for a User Service API
- `zod.ts.fixture` - Zod schema definitions (text fixture)
- `types.ts.fixture` - TypeScript type definitions (text fixture)

## Output

The demo produces:

1. **Canonical ISL Output** - The generated ISL specification
2. **Summary Statistics**:
   - Types extracted
   - Behaviors created
   - Entities inferred
   - Open questions generated
   - Processing duration
3. **Open Questions** (with `--verbose`) - Items requiring human review

## Example Output

```
═══════════════════════════════════════════════════════════════
  ISL Migration V2 Demo
═══════════════════════════════════════════════════════════════

Loaded 3 sample(s):
  - OpenAPI Sample (openapi)
  - Zod Sample (zod)
  - TypeScript Sample (typescript)

───────────────────────────────────────────────────────────────
  Migrating: OpenAPI Sample (openapi)
───────────────────────────────────────────────────────────────

Generated ISL:
────────────────────────────────────────────────────────────────
domain Openapi version "1.0.0" {

  type User = {
    id: UUID,
    email: String,
    name?: String,
    role: enum { Admin | User | Guest },
    createdAt: Timestamp,
    updatedAt?: Timestamp
  }

  behavior ListUsers {
    input {
      limit?: Int
      offset?: Int
    }
    output {
      success: List<User>
      errors {
        Unauthorized
        InternalError
      }
    }
    post success {
      true // TODO: Define actual postconditions
    }
  }

  ...
}
────────────────────────────────────────────────────────────────

Summary:
  ✓ Types extracted: 3
  ✓ Behaviors created: 4
  ✓ Entities inferred: 1
  ? Open questions: 12
  ⏱ Duration: 5ms
```

## Integration with CI

The demo can be used in CI pipelines to verify migration functionality:

```bash
# Run demo and check exit code
npx tsx bench/isl-migrate-demo/run.ts --format=openapi || exit 1
```

## Related

- [ISL Migration V2 Module](../../packages/core/src/isl-migrate-v2/README.md)
- [ISL Language Specification](../../ISL-LANGUAGE-SPEC.md)
