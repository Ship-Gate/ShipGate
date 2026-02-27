# ISL Healer - Folder Layout

## Package Location

```
packages/
└── isl-healer/                    # NEW PACKAGE
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── README.md
    ├── ARCHITECTURE.md            # Component diagram + invariants
    ├── FOLDER_LAYOUT.md           # This file
    │
    ├── src/
    │   ├── index.ts               # Public API exports
    │   ├── types.ts               # All TypeScript interfaces
    │   │
    │   ├── healer.ts              # ISLHealerV2 class - main entry
    │   ├── gate-ingester.ts       # JSON + SARIF parsing
    │   ├── recipe-registry.ts     # FixRecipeRegistry impl
    │   ├── weakening-guard.ts     # No-weakening validator
    │   ├── proof-builder.ts       # ProofBundleV2Builder
    │   ├── iteration-recorder.ts  # Audit trail recording
    │   │
    │   ├── adapters/              # Framework adapters
    │   │   ├── index.ts           # Adapter exports + detection
    │   │   ├── base.ts            # BaseFrameworkAdapter abstract class
    │   │   ├── nextjs-app.ts      # Next.js 13+ App Router
    │   │   ├── nextjs-pages.ts    # Next.js Pages Router
    │   │   ├── express.ts         # Express.js
    │   │   ├── fastify.ts         # Fastify
    │   │   ├── hono.ts            # Hono
    │   │   ├── remix.ts           # Remix
    │   │   └── sveltekit.ts       # SvelteKit
    │   │
    │   ├── recipes/               # Fix recipes by category
    │   │   ├── index.ts           # Recipe catalog exports
    │   │   ├── rate-limit.ts      # intent/rate-limit-required
    │   │   ├── audit.ts           # intent/audit-required
    │   │   ├── pii.ts             # intent/no-pii-logging
    │   │   ├── validation.ts      # intent/input-validation
    │   │   ├── auth.ts            # intent/auth-required
    │   │   ├── idempotency.ts     # intent/idempotency-required
    │   │   ├── encryption.ts      # intent/encryption-required
    │   │   ├── server-amount.ts   # intent/server-side-amount
    │   │   └── stubbed.ts         # quality/no-stubbed-handlers
    │   │
    │   ├── utils/                 # Utility functions
    │   │   ├── fingerprint.ts     # Deterministic hashing
    │   │   ├── span.ts            # Span manipulation
    │   │   ├── patch.ts           # Patch application
    │   │   └── ast.ts             # AST query helpers
    │   │
    │   └── cli.ts                 # CLI entry point (optional)
    │
    └── test/
        ├── healer.test.ts         # Main healer tests
        ├── gate-ingester.test.ts  # JSON/SARIF parsing tests
        ├── weakening-guard.test.ts# Weakening detection tests
        ├── adapters/
        │   ├── nextjs-app.test.ts
        │   └── express.test.ts
        ├── recipes/
        │   ├── rate-limit.test.ts
        │   ├── audit.test.ts
        │   └── ...
        └── fixtures/
            ├── sarif/             # Sample SARIF files
            ├── isl/               # Sample ISL specs
            └── code/              # Sample code for patching
```

## Integration with Existing Packages

```
packages/
├── isl-healer/        # NEW - Self-healing engine
│   └── depends on:
│       ├── @isl-lang/translator   # ISL AST types
│       ├── @isl-lang/generator    # Code generation
│       ├── @isl-lang/proof        # Proof bundle (extends v1)
│       └── @isl-lang/gate         # Gate types
│
├── isl-pipeline/      # EXISTING - Orchestration
│   └── will import:
│       └── @isl-lang/healer       # Healer v2
│
├── isl-gate/          # EXISTING - Gate runner
│   └── exports:
│       ├── GateResult
│       └── Finding
│
├── isl-proof/         # EXISTING - Proof bundle v1
│   └── extended by:
│       └── @isl-lang/healer       # ProofBundleV2
│
└── core/              # EXISTING - SARIF formatters
    └── formatters/
        └── sarif-isl/             # SARIF types
```

## File Responsibilities

### Core Files

| File | Responsibility |
|------|----------------|
| `healer.ts` | Main `ISLHealerV2` class, healing loop, exit conditions |
| `gate-ingester.ts` | Parse JSON and SARIF gate results into `Violation[]` |
| `recipe-registry.ts` | Map rule IDs to `FixRecipe`, detect unknown rules |
| `weakening-guard.ts` | Block patches that weaken intents |
| `proof-builder.ts` | Build `ProofBundleV2` with iteration history |
| `iteration-recorder.ts` | Record snapshots for audit trail |

### Adapter Files

| File | Framework | Key Patterns |
|------|-----------|--------------|
| `nextjs-app.ts` | Next.js 13+ App Router | `route.ts`, `NextResponse`, server components |
| `nextjs-pages.ts` | Next.js Pages Router | `pages/api/*.ts`, `NextApiHandler` |
| `express.ts` | Express.js | `app.get()`, `req/res`, middleware |
| `fastify.ts` | Fastify | `fastify.route()`, request/reply |
| `hono.ts` | Hono | `app.get()`, `c.json()` |
| `remix.ts` | Remix | `loader`, `action`, `json()` |
| `sveltekit.ts` | SvelteKit | `+server.ts`, `RequestHandler` |

### Recipe Files

| File | Rule ID | What It Fixes |
|------|---------|---------------|
| `rate-limit.ts` | `intent/rate-limit-required` | Add rate limiting middleware |
| `audit.ts` | `intent/audit-required` | Add audit logging on all exits |
| `pii.ts` | `intent/no-pii-logging` | Remove console.log, add safe logger |
| `validation.ts` | `intent/input-validation` | Add Zod schema validation |
| `auth.ts` | `intent/auth-required` | Add auth check |
| `idempotency.ts` | `intent/idempotency-required` | Add idempotency key handling |
| `encryption.ts` | `intent/encryption-required` | Add encryption markers |
| `server-amount.ts` | `intent/server-side-amount` | Remove client amount, add server calc |
| `stubbed.ts` | `quality/no-stubbed-handlers` | Replace TODO with implementation |

## Package.json

```json
{
  "name": "@isl-lang/healer",
  "version": "1.0.0",
  "description": "Self-healing pipeline for ISL specifications",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./adapters": {
      "import": "./dist/adapters/index.js",
      "types": "./dist/adapters/index.d.ts"
    },
    "./recipes": {
      "import": "./dist/recipes/index.js",
      "types": "./dist/recipes/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@isl-lang/translator": "workspace:*",
    "@isl-lang/generator": "workspace:*",
    "@isl-lang/proof": "workspace:*",
    "@isl-lang/gate": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "peerDependencies": {
    "zod": "^3.22.0"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "keywords": [
    "isl",
    "self-healing",
    "intent",
    "specification",
    "code-generation"
  ],
  "license": "MIT"
}
```

## Import Graph

```
@isl-lang/healer
├── types.ts                  # No imports (pure types)
├── utils/*                   # No cross-imports
├── adapters/*                # imports types
├── recipes/*                 # imports types, adapters
├── gate-ingester.ts          # imports types
├── weakening-guard.ts        # imports types
├── recipe-registry.ts        # imports types, recipes
├── iteration-recorder.ts     # imports types
├── proof-builder.ts          # imports types, @isl-lang/proof
├── healer.ts                 # imports all above
└── index.ts                  # re-exports public API
```

## Test Coverage Requirements

| Module | Coverage Target | Critical Paths |
|--------|-----------------|----------------|
| `healer.ts` | 90% | Healing loop, exit conditions |
| `gate-ingester.ts` | 95% | SARIF parsing edge cases |
| `weakening-guard.ts` | 100% | All weakening patterns |
| `recipe-registry.ts` | 95% | Unknown rule detection |
| `proof-builder.ts` | 90% | Chain integrity |
| `adapters/*` | 85% | Code generation correctness |
| `recipes/*` | 90% | Patch generation + validation |
