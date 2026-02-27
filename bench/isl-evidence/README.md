# ISL Evidence Bench Harness

A CLI-like runner that executes the **translate → generate → verify** pipeline on sample repositories and generates evidence reports.

## Overview

The bench harness is designed to:

1. **Translate**: Convert natural language prompts/intents into ISL specifications
2. **Generate**: Compile ISL specs into TypeScript types and test scaffolds  
3. **Verify**: Run `pnpm test` and `pnpm typecheck` to validate the generated code

Results are captured in `evidence-report.json` for analysis.

## Directory Structure

```
bench/isl-evidence/
├── runner.ts          # Main CLI runner
├── config.ts          # Configuration types and loaders
├── report.ts          # Report generation utilities
├── README.md          # This file
├── output/            # Generated reports (gitignored)
└── samples/           # Sample repositories to test
    └── <sample-name>/
        ├── sample.json     # Sample configuration
        ├── prompt.json     # Natural language prompt
        ├── context.json    # Additional context
        └── ...             # Generated files
```

## Quick Start

### Prerequisites

```bash
# Ensure you're in the repo root
cd IntentOS

# Install dependencies
pnpm install
```

### Running the Bench

#### Bash (Linux/macOS)

```bash
# Run all samples
npx tsx bench/isl-evidence/runner.ts

# Run with verbose output
npx tsx bench/isl-evidence/runner.ts --verbose

# Run a specific sample
npx tsx bench/isl-evidence/runner.ts --sample auth-basic

# Run samples with a specific tag
npx tsx bench/isl-evidence/runner.ts --tag payments

# Run with bail-on-failure
npx tsx bench/isl-evidence/runner.ts --bail --verbose

# Custom output directory
npx tsx bench/isl-evidence/runner.ts --output ./my-reports
```

#### PowerShell (Windows)

```powershell
# Run all samples
npx tsx bench/isl-evidence/runner.ts

# Run with verbose output
npx tsx bench/isl-evidence/runner.ts --verbose

# Run a specific sample
npx tsx bench/isl-evidence/runner.ts --sample auth-basic

# Run samples with a specific tag
npx tsx bench/isl-evidence/runner.ts --tag payments

# Run with bail-on-failure
npx tsx bench/isl-evidence/runner.ts --bail --verbose

# Custom output directory
npx tsx bench/isl-evidence/runner.ts --output .\my-reports
```

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--config <path>` | `-c` | Path to custom config file |
| `--sample <id>` | `-s` | Run only a specific sample |
| `--tag <tag>` | `-t` | Run only samples with a specific tag |
| `--verbose` | `-v` | Enable verbose output |
| `--bail` | `-b` | Stop on first failure |
| `--output <dir>` | `-o` | Output directory for reports |
| `--help` | `-h` | Show help message |

## Creating Samples

### 1. Create Sample Directory

```bash
# Bash
mkdir -p bench/isl-evidence/samples/my-sample

# PowerShell
New-Item -ItemType Directory -Path bench/isl-evidence/samples/my-sample -Force
```

### 2. Create `sample.json`

```json
{
  "name": "My Sample",
  "promptFile": "prompt.json",
  "contextFile": "context.json",
  "testCommands": ["pnpm test"],
  "typecheckCommands": ["pnpm typecheck"],
  "enabled": true,
  "tags": ["example", "basic"]
}
```

### 3. Create `prompt.json`

```json
{
  "prompt": "Create a user registration endpoint that validates email format and password strength",
  "metadata": {
    "version": "1.0.0",
    "createdAt": "2026-02-01T00:00:00Z",
    "author": "Agent 07"
  }
}
```

### 4. Create `context.json`

```json
{
  "domain": "auth",
  "existingTypes": {
    "User": {
      "id": "string",
      "email": "string",
      "createdAt": "Date"
    }
  },
  "constraints": [
    "Email must be valid RFC 5322 format",
    "Password must be at least 8 characters",
    "Password must contain uppercase, lowercase, and number"
  ],
  "examples": [
    {
      "input": { "email": "user@example.com", "password": "SecurePass123" },
      "expectedOutput": { "success": true, "userId": "uuid" }
    }
  ]
}
```

### 5. Initialize Package (if needed)

If your sample needs its own test setup:

```bash
cd bench/isl-evidence/samples/my-sample
pnpm init
pnpm add -D typescript vitest
```

## Output

### evidence-report.json

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-02-01T12:00:00.000Z",
  "summary": {
    "totalSamples": 3,
    "passed": 2,
    "failed": 1,
    "skipped": 0,
    "totalDurationMs": 5432
  },
  "samples": [
    {
      "sampleId": "auth-basic",
      "sampleName": "Basic Auth",
      "status": "passed",
      "steps": {
        "translate": { "status": "passed", "durationMs": 1234 },
        "generate": { "status": "passed", "durationMs": 567 },
        "verify": { "status": "passed", "durationMs": 890 }
      },
      "trustScore": 95
    }
  ],
  "environment": {
    "nodeVersion": "v20.0.0",
    "platform": "win32",
    "arch": "x64"
  }
}
```

### evidence-report.md

A human-readable markdown version is also generated alongside the JSON report.

## Integration Points

The runner currently uses **stubs** for the translate and generate steps. To integrate with actual ISL tooling:

### Translator Integration

In `runner.ts`, find the `runTranslateStep` function:

```typescript
// TODO: Replace with actual translator integration
// import { translate } from '@isl-lang/translator';
// const isl = await translate(prompt, context);
```

### Generator Integration

In `runner.ts`, find the `runGenerateStep` function:

```typescript
// TODO: Replace with actual generator integration  
// import { generate } from '@isl-lang/isl-compiler';
// const output = await generate(islSpec, options);
```

## Configuration

### Custom Config File

Create a `bench.config.json`:

```json
{
  "timeouts": {
    "translate": 60000,
    "generate": 120000,
    "verify": 180000
  },
  "verbose": false,
  "bailOnFailure": false
}
```

Then run with:

```bash
npx tsx bench/isl-evidence/runner.ts --config ./bench.config.json
```

## Troubleshooting

### Windows Path Issues

If you encounter path issues on Windows, ensure you're using forward slashes or properly escaped backslashes in configuration files.

### Permission Errors

```powershell
# Run PowerShell as Administrator if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Module Resolution

If TypeScript modules fail to resolve:

```bash
# Ensure dependencies are installed
pnpm install

# Try with explicit tsx
npx tsx --tsconfig tsconfig.json bench/isl-evidence/runner.ts
```

## Development

### Adding New Report Formats

Extend `report.ts` to add new output formats (e.g., JUnit XML, HTML).

### Custom Step Implementations

Override step implementations by creating a custom runner that imports and extends the base functions.

## License

MIT - See LICENSE in repo root.
