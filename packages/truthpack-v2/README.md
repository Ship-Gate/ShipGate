# Truthpack v2

Canonical "project reality snapshot" that every verifier/codegen uses, with drift detection and evidence.

## Features

- **Comprehensive Fact Extraction**: Routes, env vars, db schema hints, auth model, dependencies, runtime probes
- **Framework Adapters**: Fastify, Next.js App Router, Next.js Pages API, generic FS heuristics
- **Confidence Scoring**: Each extracted fact includes a confidence score (0-1)
- **Drift Detection**: Compare truthpacks and detect added/removed/changed items with impact assessment
- **Provenance Tracking**: Commit hash, Node/pnpm versions, timestamp for reproducibility
- **Deterministic Output**: Same repo state produces identical truthpack

## Usage

### Build Truthpack

```bash
shipgate truthpack build
```

Options:
- `-r, --repo-root <dir>` - Repository root (default: cwd)
- `-o, --output <dir>` - Output directory (default: .shipgate/truthpack)
- `--include <patterns>` - Include file patterns (comma-separated)
- `--exclude <patterns>` - Exclude file patterns (comma-separated)
- `--no-dependencies` - Skip dependency extraction
- `--no-db-schema` - Skip DB schema detection
- `--no-auth` - Skip auth model detection
- `--no-runtime-probes` - Skip runtime probe detection

### Diff Truthpack

```bash
shipgate truthpack diff
```

Options:
- `-r, --repo-root <dir>` - Repository root (default: cwd)
- `--old <dir>` - Old truthpack directory (default: .shipgate/truthpack/.previous)
- `--new <dir>` - New truthpack directory (default: .shipgate/truthpack)

## Schema

See `src/schema.ts` for the complete TruthpackV2 schema definition.

## Adapters

Adapters extract facts from different frameworks:

- **NextAppRouterAdapter**: Detects routes in Next.js App Router (`/app/**/route.ts`)
- **NextPagesApiAdapter**: Detects routes in Next.js Pages API (`/pages/api/**`)
- **FastifyAdapter**: Detects Fastify routes (`fastify.get()`, `fastify.route()`)
- **GenericFSAdapter**: Fallback adapter using generic patterns

## Drift Detection

Drift detection categorizes changes by impact:

- **Breaking**: Removed routes, changed auth, removed required env vars
- **High**: Added required env vars, changed route parameters
- **Medium**: Changed middleware, added optional env vars
- **Low**: Added optional routes, changed confidence scores

## Example Output

```json
{
  "version": "2.0.0",
  "provenance": {
    "commitHash": "abc123...",
    "nodeVersion": "v18.17.0",
    "packageManager": { "name": "pnpm", "version": "8.10.0" },
    "timestamp": "2026-02-09T12:00:00.000Z",
    "generatorVersion": "2.0.0",
    "repoRoot": "/path/to/repo"
  },
  "routes": [
    {
      "path": "/api/users",
      "method": "GET",
      "handler": "getUsers",
      "file": "src/routes/users.ts",
      "line": 10,
      "parameters": [],
      "middleware": ["auth"],
      "auth": { "required": true, "method": "bearer" },
      "confidence": 0.95,
      "adapter": "fastify"
    }
  ],
  "envVars": [
    {
      "name": "DATABASE_URL",
      "file": "src/config.ts",
      "line": 5,
      "hasDefault": false,
      "required": true,
      "sensitive": false,
      "confidence": 0.9,
      "source": "process.env"
    }
  ],
  "summary": {
    "routes": 1,
    "envVars": 1,
    "dbTables": 0,
    "dependencies": 0,
    "runtimeProbes": 0,
    "avgConfidence": 0.925
  }
}
```

## Testing

```bash
pnpm test
```

Tests include:
- Fastify route extraction
- Next.js App Router route extraction
- Env var extraction
- Provenance tracking
- Drift detection
