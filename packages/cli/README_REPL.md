# ISL REPL - Interactive Debugging Tool

A REPL (Read-Eval-Print Loop) for loading ISL domains and running core commands for fast debugging.

## Quick Start

```bash
# Start interactive REPL
shipgate repl
# or
isl repl

# Non-interactive mode
shipgate repl --eval ":load path/to/domain.isl; :verify"
```

## Commands

### Core Commands (Colon syntax)

- `:load <path>` - Load an ISL domain file
- `:ast` - Show AST of loaded domain
- `:types` - Show type information (entities, behaviors, types)
- `:verify` - Verify domain (typecheck subset)
- `:gen <target>` - Generate code (ts, rust, go, openapi)
- `:truthpack` - Show truthpack info (if available)

### Dot Commands (Legacy)

- `.help` - Show help message
- `.parse <isl>` - Parse ISL and show AST
- `.eval <expr>` - Evaluate expression against context
- `.check` - Type check (alias for :verify)
- `.load <file>` - Load an ISL file (alias for :load)
- `.context <json>` - Set evaluation context
- `.clear` - Clear the screen
- `.history` - Show command history
- `.exit` - Exit the REPL

## Examples

### Load and Inspect Domain

```bash
isl> :load examples/auth.isl
✓ Loaded: AuthDomain (2 entities, 3 behaviors, 1 types)

isl> :types
Entities:
  User { id: UUID, email: String }
  Session { id: UUID, userId: UUID }

Behaviors:
  login(email: String, password: String) -> Session
  logout(sessionId: UUID) -> Boolean
  validateSession(sessionId: UUID) -> Boolean

isl> :ast
{
  "kind": "Domain",
  "name": { "name": "AuthDomain" },
  ...
}
```

### Verify Domain

```bash
isl> :load examples/auth.isl
✓ Loaded: AuthDomain

isl> :verify
✓ Type check passed
```

### Generate Code

```bash
isl> :load examples/auth.isl
✓ Loaded: AuthDomain

isl> :gen ts
⚠ Filesystem writes disabled. Use --allow-writes flag or :write command.
Generated code preview:

// generated/ts/authdomain.ts
export interface User {
  id: string;
  email: string;
}

...

isl> :write
✓ Filesystem writes enabled

isl> :gen ts
✓ Generated 3 file(s)
  generated/ts/authdomain.ts
  generated/ts/authdomain.types.ts
  generated/ts/authdomain.behaviors.ts
```

### Non-Interactive Mode

```bash
# Execute commands and exit
shipgate repl --eval ":load examples/auth.isl; :verify; :types"

# With timeout
shipgate repl --eval ":load examples/auth.isl; :verify" --timeout 10000

# Allow writes
shipgate repl --eval ":load examples/auth.isl; :gen ts" --allow-writes
```

## Safety Features

### Timeouts

All commands have a default timeout of 30 seconds (configurable via `--timeout`):

```bash
shipgate repl --timeout 5000  # 5 second timeout
```

### Filesystem Protection

By default, the REPL **does not write files** unless explicitly enabled:

```bash
# Enable writes via flag
shipgate repl --allow-writes

# Or enable in REPL
isl> :write
✓ Filesystem writes enabled
```

## CI-Safe Usage

The REPL is designed to be CI-safe:

1. **No hangs**: Commands timeout automatically
2. **No accidental writes**: Filesystem writes disabled by default
3. **Deterministic output**: Same input produces same output
4. **Non-interactive mode**: Use `--eval` for scripts

### Example CI Usage

```bash
# In CI script
shipgate repl --eval ":load src/domain.isl; :verify" --timeout 5000
```

## Command Reference

### `:load <file>`

Load an ISL domain file and parse it.

```bash
isl> :load examples/auth.isl
✓ Loaded: AuthDomain (2 entities, 3 behaviors, 1 types)
```

### `:ast`

Show the parsed AST of the loaded domain.

```bash
isl> :ast
{
  "kind": "Domain",
  "name": { "name": "AuthDomain" },
  "entities": [...],
  "behaviors": [...]
}
```

### `:types`

Show type information: entities, custom types, and behavior signatures.

```bash
isl> :types
Entities:
  User { id: UUID, email: String }

Behaviors:
  login(email: String, password: String) -> Session
```

### `:verify`

Run typechecking on the loaded domain (subset verification).

```bash
isl> :verify
✓ Type check passed
```

### `:gen <target>`

Generate code from the loaded domain. Supported targets:
- `ts` / `typescript` - TypeScript types and interfaces
- `rust` - Rust code
- `go` - Go code
- `openapi` - OpenAPI specification

```bash
isl> :gen ts
⚠ Filesystem writes disabled...
Generated code preview:
...
```

### `:truthpack`

Show truthpack information if available (requires `.shipgate/truthpack/truthpack.json`).

```bash
isl> :truthpack
Truthpack Info:
  Routes: 12
  Env Vars: 5
  Dependencies: 23
  Commit: a1b2c3d4
```

## Exit Codes

- `0` - Success
- `1` - Error (parse/type/verification failures)
- `2` - Usage error (bad flags, missing file)

## Related

- [CLI Documentation](../README.md)
- [ISL Language Guide](../../docs/ISL.md)
- [Code Generation](../../docs/codegen/README.md)
