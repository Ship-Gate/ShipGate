---
title: "CLI: init"
description: Initialize a new ISL project or add ShipGate to an existing project.
---

The `init` command sets up ShipGate for your project. It creates configuration files, directory structure, and optionally generates ISL specs from existing code.

## Usage

```bash
shipgate init [name] [options]
```

## Options

| Flag                      | Description                                   |
| ------------------------- | --------------------------------------------- |
| `-t, --template <type>`   | Project template: `minimal`, `full`, `api`    |
| `-d, --directory <dir>`   | Target directory                              |
| `--force`                 | Overwrite existing files                      |
| `--no-git`                | Skip git initialization                       |
| `-e, --examples`          | Include example ISL files                     |
| `--from-code <path>`      | Generate ISL specs from existing source code  |
| `--from-prompt <text>`    | Generate ISL spec from natural language       |
| `--ai`                    | Use AI for spec generation                    |
| `--api-key <key>`         | API key for AI provider                       |

## Templates

### Minimal (default)

Creates the minimum files needed:

```bash
shipgate init --template minimal
```

Output:

```
.shipgate.yml          # Project configuration
specs/                 # Directory for ISL files
  example.isl          # Example spec (if --examples)
```

### Full

Full setup with CI, team config, and examples:

```bash
shipgate init --template full
```

Output:

```
.shipgate.yml                    # Project configuration
.shipgate-team.yml               # Team policies
specs/                           # ISL specs directory
  example.isl                    # Example spec
.github/workflows/shipgate.yml  # GitHub Actions workflow
```

### API

Optimized for REST API projects:

```bash
shipgate init --template api
```

Output:

```
.shipgate.yml                    # Project configuration
specs/                           # ISL specs directory
  api-example.isl                # Example API spec
.github/workflows/shipgate.yml  # CI workflow
```

## Generate from existing code

If you already have source code, generate ISL specs from it:

```bash
# Analyze source code and generate specs
shipgate init --from-code ./src

# With AI enhancement for better spec quality
shipgate init --from-code ./src --ai

# From natural language description
shipgate init --from-prompt "User registration with email verification"
```

### AI-powered initialization

With the `--ai` flag, ShipGate uses LLM analysis to produce higher-quality specifications:

```bash
# Set your API key (or use ANTHROPIC_API_KEY env var)
export ANTHROPIC_API_KEY=your-key

# Generate AI-enhanced specs
shipgate init --from-code ./src --ai
```

## Interactive setup

The `shipgate init` command runs interactively. Without the `--from-code` flag, it asks:

1. What type of project (API, web app, library)?
2. Which template to use?
3. Include example files?
4. Set up CI workflow?

## Examples

```bash
# New project with examples
shipgate init my-project --examples

# Add to existing project
shipgate init --force

# API project with CI
shipgate init --template api

# Generate specs from code
shipgate init --from-code ./src --output specs/

# AI-powered setup
shipgate init --from-code ./src --ai
```

## What init creates

### `.shipgate.yml`

```yaml
# ShipGate configuration
version: "1.0"
specs: "specs/"
impl: "src/"
gate:
  threshold: 80
  fail-on: error
verification:
  pbt: true
  chaos: true
```

### GitHub Actions workflow

```yaml
name: ShipGate Verify
on:
  pull_request:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - uses: guardiavault-oss/isl-gate-action@v1
        with:
          mode: auto
          threshold: 80
```

## Exit codes

| Code | Meaning                   |
| ---- | ------------------------- |
| `0`  | Initialization successful |
| `1`  | Initialization error      |
