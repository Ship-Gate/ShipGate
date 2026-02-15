# Shipgate CLI

**ShipGate — Stop AI from shipping fake features. Define what your code should do. We enforce it.**

Command-line interface for ISL (Intent Specification Language).

## Installation

```bash
# Install globally (recommended)
npm install -g shipgate

# Or use npx (no installation required)
npx shipgate <command>
```

## Quick Start

```bash
# Initialize in the current directory (no args)
npx shipgate init

# Create a new project directory and init inside it
npx shipgate init my-project

# Skip prompts (use defaults)
npx shipgate init -y

# Overwrite existing ShipGate files
npx shipgate init --force

# Parse and validate ISL files
npx shipgate check specs/*.isl

# Generate code from ISL specs
npx shipgate generate --target typescript specs/

# Verify implementation against spec
npx shipgate verify specs/example.isl --impl ./src

# Get help
npx shipgate --help
```

## Commands

### `shipgate init [name]`

Initialize a new ISL project with recommended structure.

```bash
# Init in current directory (no args)
npx shipgate init

# Create ./my-api and init inside it
npx shipgate init my-api
cd my-api

# Skip prompts (use defaults)
npx shipgate init -y

# Overwrite existing ShipGate files (isl.config.json, .shipgate.yml)
npx shipgate init --force
```

Creates:
- `isl.config.json` - Project configuration
- `src/` - Directory for ISL specifications (with example `.isl` file)
- `generated/` - Output directory for generated code
- `package.json` - Node.js project file with scripts

### `shipgate check <files...>`

Parse and type-check ISL files.

```bash
npx shipgate check specs/*.isl
npx shipgate check --strict specs/
```

Options:
- `--strict` - Enable strict mode (all warnings become errors)
- `--format <format>` - Output format (pretty, json, quiet)

### `shipgate generate <files...>`

Generate code from ISL specifications.

```bash
# Generate TypeScript
npx shipgate generate --target typescript specs/

# Generate Python
npx shipgate generate --target python --output src/generated specs/

# Generate OpenAPI
npx shipgate generate --target openapi specs/api.isl
```

Options:
- `--target, -t` - Target language (typescript, python, rust, go, openapi, graphql)
- `--output, -o` - Output directory
- `--config, -c` - Config file path

### `shipgate verify <files...>`

Verify implementation against ISL specifications.

```bash
npx shipgate verify specs/critical-flow.isl --impl ./src
```

### `shipgate parse <file>`

Parse an ISL file and display the AST.

```bash
npx shipgate parse specs/example.isl
```

### `shipgate gate <files...>`

Run the ShipGate (SHIP/NO-SHIP gate) on ISL files.

```bash
npx shipgate gate specs/
npx shipgate gate --ci --output json
```

### `shipgate proof badge <bundle-path>`

Generate a badge (SVG or URL) from a proof bundle for display in README or CI.

```bash
# Generate SVG badge
npx shipgate proof badge ./proof-bundle -o badge.svg

# Generate badge URL
npx shipgate proof badge ./proof-bundle --format url --bundle-url https://example.com/bundle

# With custom badge service
npx shipgate proof badge ./proof-bundle --format url --badge-url-base https://badges.example.com
```

The badge displays the proof verdict (PROVEN, INCOMPLETE, VIOLATED, UNPROVEN) with color coding:
- 🟢 **PROVEN** - Green badge
- 🟡 **INCOMPLETE_PROOF** - Yellow badge
- 🔴 **VIOLATED** - Red badge
- ⚪ **UNPROVEN** - Grey badge

### `shipgate proof attest <bundle-path>`

Generate SLSA-style attestation JSON from a proof bundle for supply chain security.

```bash
# Output to stdout
npx shipgate proof attest ./proof-bundle

# Save to file
npx shipgate proof attest ./proof-bundle -o attestation.json

# Include full manifest
npx shipgate proof attest ./proof-bundle --include-manifest -o attestation.json
```

The attestation includes:
- Verdict and reason
- Spec information (domain, version, hash)
- Gate, build, and test results
- Toolchain versions
- Bundle fingerprint

### `shipgate proof comment <bundle-path>`

Generate GitHub PR comment from a proof bundle.

```bash
# Output to stdout (for GitHub Actions)
npx shipgate proof comment ./proof-bundle

# Save to file
npx shipgate proof comment ./proof-bundle -o pr-comment.md
```

The comment includes:
- Verdict summary with emoji indicators
- Phase-by-phase breakdown (Gate, Build, Tests, Verify)
- Spec and toolchain information
- Bundle ID and generation timestamp

### `shipgate repl`

Start an interactive REPL for exploring ISL.

```bash
npx shipgate repl
```

## Configuration

The `init` command creates `isl.config.json` in your project root:

```json
{
  "defaultTarget": "typescript",
  "strictMode": true,
  "outputDir": "./generated",
  "include": ["src/**/*.isl"],
  "exclude": ["src/drafts/**"],
  "output": {
    "types": true,
    "tests": true,
    "docs": false
  }
}
```

## Environment Variables

- `ISL_CONFIG` - Path to config file
- `ISL_DEBUG` - Enable debug output
- `ISL_NO_COLOR` - Disable colored output
- `ANTHROPIC_API_KEY` - API key for AI-enhanced features (optional)

## Examples

### Initialize a project

```bash
# In current directory
npx shipgate init

# Or create a new folder
npx shipgate init my-project
```

This creates:
- `src/my-project.isl` - Example ISL specification
- `isl.config.json` - Configuration file
- `package.json` - Node.js project file

### Check ISL files

```bash
npx shipgate check src/*.isl
```

### Generate TypeScript types

```bash
npx shipgate generate --target typescript src/
```

## Documentation

- Full documentation: https://shipgate.dev/docs
- GitHub: https://github.com/guardiavault-oss/ISL-LANG

## License

MIT
