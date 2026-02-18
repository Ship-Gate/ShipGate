# Shipgate CLI v2.1.0

[![npm version](https://badge.fury.io/js/shipgate.svg)](https://badge.fury.io/js/shipgate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/shipgate)](https://www.npmjs.com/package/shipgate)

> **ShipGate — Stop AI from shipping fake features. Define what your code should do. We enforce it.**

The Shipgate CLI is your command-line gateway to **Intent Specification Language (ISL)** — a formal language for specifying what your code *must* do. With ISL, you can define behavioral contracts, generate code, and verify that AI-generated implementations match your intentions.

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g shipgate

# Or use npx (no installation required)
npx shipgate <command>

# Verify installation
shipgate --version
```

### Your First Project

```bash
# Initialize a new project
npx shipgate init my-api
cd my-api

# Check the generated spec
npx shipgate check src/*.isl

# Generate TypeScript code
npx shipgate generate --target typescript src/

# Verify implementation
npx shipgate verify src/my-api.isl --impl ./src
```

## 📋 Commands Overview

| Command | Purpose | Key Features |
|---------|---------|--------------|
| `init` | Create new ISL project | Auto-configuration, templates |
| `check` | Parse & validate ISL files | Type checking, syntax validation |
| `generate` | Code from ISL specs | TypeScript, Python, Rust, Go, OpenAPI |
| `verify` | Verify implementation | Behavioral verification, evidence |
| `gate` | SHIP/NO-SHIP decision | CI integration, trust scoring |
| `parse` | Inspect ISL AST | Debug specifications |
| `repl` | Interactive ISL shell | Explore ISL interactively |

## 🛠️ Detailed Command Reference

### `shipgate init [name]`

Initialize a new ISL project with recommended structure and configuration.

```bash
# Initialize in current directory
npx shipgate init

# Create new project directory
npx shipgate init my-project
cd my-project

# Skip prompts (use defaults)
npx shipgate init -y

# Overwrite existing config
npx shipgate init --force
```

**Creates:**
```
my-project/
├── src/
│   └── my-project.isl     # Example specification
├── generated/             # Code output directory
├── isl.config.json        # Project configuration
├── package.json           # Node.js project setup
└── README.md              # Project documentation
```

### `shipgate check <files...>`

Parse and type-check ISL files with comprehensive error reporting.

```bash
# Check all ISL files
npx shipgate check src/**/*.isl

# Strict mode (warnings become errors)
npx shipgate check --strict src/

# JSON output for CI
npx shipgate check --format json src/ > results.json

# Quiet mode (minimal output)
npx shipgate check --quiet src/
```

**Options:**
- `--strict` - Enable strict mode (all warnings become errors)
- `--format <format>` - Output format: `pretty`, `json`, `quiet`
- `--config <path>` - Custom config file path

**Exit Codes:**
- `0` - All checks passed
- `1` - Errors found

### `shipgate generate <files...>`

Generate production-ready code from ISL specifications.

```bash
# Generate TypeScript
npx shipgate generate --target typescript src/

# Generate Python with custom output
npx shipgate generate --target python --output src/generated src/

# Generate OpenAPI spec
npx shipgate generate --target openapi src/api.isl

# Generate Rust types
npx shipgate generate --target rust --output src/types src/
```

**Supported Targets:**
- `typescript` - TypeScript types and interfaces
- `python` - Python dataclasses and type hints
- `rust` - Rust structs and enums
- `go` - Go structs and interfaces
- `openapi` - OpenAPI 3.0 specifications
- `graphql` - GraphQL schemas

**Options:**
- `--target, -t` - Target language (required)
- `--output, -o` - Output directory (default: `generated/`)
- `--config, -c` - Config file path
- `--watch` - Watch for changes and regenerate

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
- GitHub: https://github.com/Ship-Gate/ShipGate

## License

MIT
