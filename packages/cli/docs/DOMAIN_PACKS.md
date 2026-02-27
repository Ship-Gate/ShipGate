# Domain Packs

Domain packs are distributable ISL domain specifications that can be shared, versioned, and installed across projects.

## Quick Start

### Create a Domain Pack

```bash
# Initialize a new domain pack
shipgate domain init --name my-auth-pack

# This creates:
# - pack.json          # Pack manifest
# - specs/             # ISL domain specifications
# - tests/             # Unit tests
# - .github/workflows/ # Publish workflow
```

### Validate a Domain Pack

```bash
# Validate pack structure and specs
shipgate domain validate

# Validate and run tests
shipgate domain validate --test
```

## Pack Structure

```
my-domain-pack/
├── pack.json              # Pack manifest
├── README.md              # Pack documentation
├── specs/                  # ISL domain specifications
│   └── my-domain.isl
├── tests/                  # Pack unit tests
│   └── my-domain.test.ts
└── .github/
    └── workflows/
        └── publish.yml     # Publish workflow
```

## pack.json Schema

```json
{
  "name": "my-domain-pack",
  "version": "0.1.0",
  "description": "Domain pack description",
  "author": "Your Name",
  "license": "MIT",
  "keywords": ["isl", "domain-pack"],
  "domain": {
    "name": "MyDomain",
    "version": "0.1.0",
    "specs": [
      "specs/*.isl"
    ],
    "dependencies": {
      "other-pack": "^1.0.0"
    }
  },
  "files": [
    "specs/**/*.isl",
    "tests/**/*.test.ts",
    "pack.json",
    "README.md"
  ],
  "publish": {
    "registry": "https://registry.shipgate.dev",
    "access": "public"
  }
}
```

## Commands

### `shipgate domain init`

Initialize a new domain pack.

**Options:**
- `-n, --name <name>` - Pack name (default: current directory name)
- `-d, --directory <dir>` - Target directory (default: current directory)
- `--force` - Overwrite existing files
- `--no-examples` - Skip example spec file

**Example:**
```bash
shipgate domain init --name auth-domain
```

### `shipgate domain validate`

Validate a domain pack structure and specs.

**Options:**
- `-d, --directory <dir>` - Pack directory (default: current directory)
- `-t, --test` - Run pack unit tests

**Example:**
```bash
shipgate domain validate --test
```

## Validation Rules

The validator checks:

1. **pack.json** - Valid manifest structure
2. **Specs Directory** - Exists and contains ISL files
3. **ISL Files** - Parse and type-check all specs
4. **Tests** - Test files exist (optional with `--test`)

## Publishing

Domain packs can be published to a registry using the GitHub Actions workflow:

```yaml
# .github/workflows/publish.yml
name: Publish Domain Pack

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish'
        required: true
        type: string

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install ShipGate CLI
        run: npm install -g @isl-lang/cli
      - name: Validate Pack
        run: shipgate domain validate --test
      - name: Publish Pack
        run: shipgate domain publish
```

## Testing

Pack tests verify:

1. **Parse Tests** - All specs parse correctly
2. **Type Check** - All specs type-check without errors
3. **Verification** - Sample behaviors verify correctly

Example test file:

```typescript
import { describe, it, expect } from 'vitest';
import { parse, check } from '@isl-lang/core';

describe('MyDomain Domain Pack', () => {
  it('should parse all specs', async () => {
    const specFiles = ['specs/my-domain.isl'];
    for (const specFile of specFiles) {
      const result = await parse(specFile);
      expect(result.success).toBe(true);
    }
  });

  it('should type-check all specs', async () => {
    const specFiles = ['specs/my-domain.isl'];
    for (const specFile of specFiles) {
      const result = await check([specFile]);
      expect(result.success).toBe(true);
      expect(result.totalErrors).toBe(0);
    }
  });
});
```

## Acceptance Test

A new pack can be created, validated, and installed in <5 minutes:

```bash
# 1. Create pack (30 seconds)
shipgate domain init --name quick-test-pack

# 2. Validate pack (10 seconds)
shipgate domain validate

# 3. Run tests (20 seconds)
shipgate domain validate --test

# Total: ~1 minute
```

## Examples

See the `demos/` directory for example domain packs.

## Learn More

- [ISL Documentation](https://intentos.dev/docs)
- [Domain Pack Registry](https://registry.shipgate.dev)
