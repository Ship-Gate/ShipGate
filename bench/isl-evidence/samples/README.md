# ISL Evidence Samples

This directory contains sample repositories for the ISL evidence bench harness.

## Structure

Each sample should be in its own subdirectory with the following structure:

```
samples/
├── <sample-id>/
│   ├── sample.json      # Required: Sample configuration
│   ├── prompt.json      # Required: Natural language prompt/intent
│   ├── context.json     # Optional: Additional context for translation
│   ├── expected.isl     # Optional: Expected ISL output for comparison
│   ├── package.json     # Optional: If sample needs its own dependencies
│   └── src/             # Optional: Generated code goes here
└── README.md            # This file
```

## Creating a New Sample

### Step 1: Create Directory

```bash
# Bash
mkdir -p samples/my-sample

# PowerShell
New-Item -ItemType Directory -Path samples/my-sample -Force
```

### Step 2: Create sample.json

```json
{
  "name": "Human-Readable Name",
  "promptFile": "prompt.json",
  "contextFile": "context.json",
  "expectedIslFile": "expected.isl",
  "testCommands": ["pnpm test"],
  "typecheckCommands": ["pnpm typecheck"],
  "enabled": true,
  "tags": ["category", "difficulty"]
}
```

### Step 3: Create prompt.json

```json
{
  "prompt": "Your natural language intent goes here",
  "metadata": {
    "version": "1.0.0",
    "createdAt": "2026-02-01T00:00:00Z",
    "author": "Your Name"
  }
}
```

### Step 4: Create context.json (Optional)

```json
{
  "domain": "auth|payments|crud|workflow",
  "existingTypes": {},
  "constraints": [],
  "examples": []
}
```

## Sample Categories

Suggested tags for organizing samples:

| Tag | Description |
|-----|-------------|
| `basic` | Simple, single-intent samples |
| `advanced` | Complex, multi-step intents |
| `auth` | Authentication/authorization |
| `payments` | Payment processing |
| `crud` | Create/Read/Update/Delete operations |
| `workflow` | Multi-step business workflows |
| `edge-case` | Edge cases and error handling |

## Placeholder Samples

The following placeholder samples are provided as examples:

### auth-basic (To Be Created)
- Basic user authentication flow
- Tags: `auth`, `basic`

### payments-checkout (To Be Created)
- E-commerce checkout workflow
- Tags: `payments`, `workflow`

### crud-users (To Be Created)
- User CRUD operations
- Tags: `crud`, `basic`

## Running Samples

```bash
# Run all enabled samples
npx tsx bench/isl-evidence/runner.ts

# Run specific sample
npx tsx bench/isl-evidence/runner.ts --sample auth-basic

# Run by tag
npx tsx bench/isl-evidence/runner.ts --tag payments
```

## Contributing Samples

When contributing new samples:

1. Use descriptive sample IDs (kebab-case)
2. Include comprehensive prompts
3. Add appropriate tags
4. Document expected behavior
5. Test locally before committing

## Notes

- Samples with `"enabled": false` in `sample.json` will be skipped
- The runner auto-discovers samples by looking for `sample.json` files
- Output from runs is stored in `../output/` (gitignored)
