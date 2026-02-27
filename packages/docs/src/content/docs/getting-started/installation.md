---
title: Installation
description: Install ShipGate CLI and set up ISL in your project.
---

## Prerequisites

- **Node.js** 18 or later
- **npm**, **pnpm**, or **yarn**

## Install the CLI

Install the ShipGate CLI globally:

```bash
npm install -g shipgate
```

Or with pnpm:

```bash
pnpm add -g shipgate
```

Verify the installation:

```bash
shipgate --version
```

When using the published CLI you'll use `shipgate`; when running from source (e.g. `pnpm --filter @isl-lang/cli exec isl ...`) the binary may be available as `isl`.

## Project-level installation

For team projects, install as a dev dependency so everyone uses the same version:

```bash
npm install --save-dev shipgate
```

Then add scripts to your `package.json`:

```json
{
  "scripts": {
    "verify": "shipgate verify",
    "gate": "shipgate gate",
    "lint:isl": "shipgate lint specs/"
  }
}
```

## Initialize a project

Run the interactive setup to create your project configuration:

```bash
shipgate init
```

This creates:

- **`.shipgate.yml`** — project configuration
- **`specs/`** — directory for your ISL specification files
- **`.github/workflows/shipgate.yml`** — CI workflow (if GitHub is detected)

For a specific template:

```bash
# Minimal setup (just config + one example spec)
shipgate init --template minimal

# Full setup (config, examples, CI, team policies)
shipgate init --template full

# API-focused setup (REST API specs with OpenAPI generation)
shipgate init --template api
```

## Generate specs from existing code

If you already have source code, ShipGate can generate ISL specs from it:

```bash
# Generate specs from a source directory
shipgate init --from-code ./src

# Generate specs with AI enhancement (requires ANTHROPIC_API_KEY)
shipgate init --from-code ./src --ai
```

## VS Code extension

Install the ShipGate ISL extension for syntax highlighting, inline diagnostics, and verification commands:

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for **"ShipGate ISL"**
4. Click Install

See the [VS Code extension guide](/vscode/installation/) for details.

## What's next?

- [Quick Start](/getting-started/quickstart/) — verify your first spec in 5 minutes
- [Your First Spec](/getting-started/your-first-spec/) — learn ISL by writing a real specification
