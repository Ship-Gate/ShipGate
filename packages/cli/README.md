# @isl-lang/cli

Command-line interface for ISL (Intent Specification Language).

## Installation

```bash
# Global installation (recommended)
npm install -g @isl-lang/cli

# Or use npx
npx @isl-lang/cli <command>
```

## Quick Start

```bash
# Initialize a new ISL project
isl init my-project

# Parse and validate ISL files
isl check specs/*.isl

# Generate code
isl generate --target typescript specs/

# Start the REPL
isl repl

# Get help
isl --help
```

## Commands

### `isl init [name]`

Initialize a new ISL project with recommended structure.

```bash
isl init my-api
cd my-api
```

Creates:
- `isl.config.yaml` - Project configuration
- `specs/` - Directory for ISL specifications
- `generated/` - Output directory for generated code

### `isl check <files...>`

Parse and type-check ISL files.

```bash
isl check specs/*.isl
isl check --strict specs/
```

Options:
- `--strict` - Enable strict mode (all warnings become errors)
- `--format <format>` - Output format (text, json, sarif)

### `isl generate <files...>`

Generate code from ISL specifications.

```bash
# Generate TypeScript
isl generate --target typescript specs/

# Generate Python
isl generate --target python --output src/generated specs/

# Generate OpenAPI
isl generate --target openapi specs/api.isl
```

Options:
- `--target, -t` - Target language (typescript, python, rust, go, openapi, graphql)
- `--output, -o` - Output directory
- `--config, -c` - Config file path

### `isl verify <files...>`

Formally verify ISL specifications.

```bash
isl verify specs/critical-flow.isl
```

### `isl repl`

Start an interactive REPL for exploring ISL.

```bash
isl repl
```

### `isl format <files...>`

Format ISL files.

```bash
isl format specs/*.isl --write
```

### `isl lsp`

Start the Language Server Protocol server.

```bash
isl lsp --stdio
```

## Configuration

Create `isl.config.yaml` in your project root:

```yaml
version: 1

# Default generation target
target: typescript

# Output directory
output: ./generated

# Include paths for imports
include:
  - ./specs
  - ./node_modules/@company/shared-specs

# Generation options
codegen:
  typescript:
    runtime: true
    validators: true
  python:
    framework: fastapi
    pydantic: v2
```

## Environment Variables

- `ISL_CONFIG` - Path to config file
- `ISL_DEBUG` - Enable debug output
- `ISL_NO_COLOR` - Disable colored output

## Documentation

Full documentation: https://isl-lang.dev/docs/cli

## Related Packages

- [@isl-lang/parser](https://npm.im/@isl-lang/parser) - ISL parser
- [@isl-lang/codegen](https://npm.im/@isl-lang/codegen) - Code generators
- [@isl-lang/repl](https://npm.im/@isl-lang/repl) - Interactive REPL

## License

MIT
