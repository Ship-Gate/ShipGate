# @isl-lang/healer

> Self-healing pipeline for ISL specifications - fixes violations without weakening intents

## Overview

ISL Healer is a self-healing pipeline that:
1. Takes **natural language** → translates to **ISL spec** (locked/immutable)
2. Generates **code** from the spec
3. Runs **gate checks** to find violations
4. Applies **fix recipes** to resolve violations
5. Re-gates until **SHIP** (or bounded exit)
6. Produces **auditable proof** with iteration history

## Key Invariants

The healer **NEVER**:
- ❌ Weakens intents from the ISL spec
- ❌ Adds suppressions (`@ts-ignore`, `eslint-disable`, `isl-ignore`)
- ❌ Downgrades severity
- ❌ Modifies gate rules or policy packs
- ❌ Guesses fixes for unknown rules (aborts instead)
- ❌ Runs indefinitely (bounded iterations)

The healer **CAN**:
- ✅ Add missing rate limiting
- ✅ Add missing audit logging
- ✅ Remove console.log (PII risk)
- ✅ Add input validation
- ✅ Add intent anchor comments/exports
- ✅ Add idempotency handling

## Installation

```bash
pnpm add @isl-lang/healer
```

## Usage

### Basic Healing

```typescript
import { healUntilShip } from '@isl-lang/healer';

// Your ISL AST (from translator)
const ast = await translate("Build a login endpoint with rate limiting and audit");

// Initial generated code
const code = new Map([
  ['app/api/login/route.ts', `
    export async function POST(request: Request) {
      const body = await request.json();
      console.log('Login:', body); // PII violation!
      // Missing rate limit
      // Missing audit
      return Response.json({ success: true });
    }
  `],
]);

// Heal until SHIP
const result = await healUntilShip(ast, code, {
  maxIterations: 8,
  verbose: true,
});

if (result.ok) {
  console.log('✓ SHIP - All intents satisfied');
  console.log('Iterations:', result.iterations);
  console.log('Proof bundle:', result.proof.bundleId);
}
```

### Using the Healer Class

```typescript
import { ISLHealerV2, createHealer } from '@isl-lang/healer';

const healer = createHealer(ast, '/path/to/project', initialCode, {
  maxIterations: 8,
  stopOnRepeat: 2,
  verbose: true,
  onIteration: (snapshot) => {
    console.log(`Iteration ${snapshot.iteration}: ${snapshot.gateResult.score}/100`);
  },
});

const result = await healer.heal();
```

### Custom Fix Recipes

```typescript
import { FixRecipe, createHealer } from '@isl-lang/healer';

const customRecipe: FixRecipe = {
  ruleId: 'custom/my-rule',
  name: 'My Custom Fix',
  description: 'Fixes my custom rule',
  priority: 10,
  match: { textPattern: /someBadPattern/ },
  locate: { type: 'text_search', search: /someBadPattern/ },
  createPatches: (violation, ctx) => [{
    type: 'replace',
    file: violation.file,
    content: 'goodPattern',
    description: 'Replace bad pattern with good pattern',
  }],
  validations: [
    { type: 'not_contains', value: 'someBadPattern', errorMessage: 'Bad pattern still present' },
  ],
  rerunChecks: ['gate'],
};

const healer = createHealer(ast, projectRoot, code, {
  customRecipes: [customRecipe],
});
```

### SARIF Input

```typescript
import { GateIngester } from '@isl-lang/healer';

const ingester = new GateIngester();

// From JSON
const gateResult = ingester.parse({
  verdict: 'NO_SHIP',
  score: 65,
  violations: [...],
  fingerprint: '...',
});

// From SARIF
const sarifResult = ingester.parse({
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'isl-gate' } },
    results: [...],
  }],
});
```

## Exit Conditions

| Reason | `ok` | Description |
|--------|------|-------------|
| `ship` | ✅ | All violations resolved, gate passes |
| `unknown_rule` | ❌ | Violation with no registered fix |
| `stuck` | ❌ | Same fingerprint repeated N times |
| `max_iterations` | ❌ | Reached iteration limit |
| `weakening_detected` | ❌ | Patch would weaken intent |

## ProofBundle v2

The healer produces a `ProofBundleV2` with:
- Full iteration history
- Evidence linking ISL clauses to code
- Build/test proof (optional)
- Tamper-detection chain
- Cryptographic signature

```typescript
interface ProofBundleV2 {
  version: '2.0.0';
  bundleId: string;           // Deterministic hash
  source: { domain, hash };   // ISL spec info
  healing: {
    performed: boolean;
    iterations: number;
    reason: HealReason;
    history: IterationSnapshot[];
  };
  evidence: ClauseEvidence[];
  gate: { verdict, score };
  verdict: 'PROVEN' | 'HEALED' | 'VIOLATED' | 'UNPROVEN';
  chain: ProofChainEntry[];
  signature?: { algorithm, value };
}
```

## Framework Adapters

Built-in adapters for:
- **Next.js App Router** (default)
- **Next.js Pages Router**
- **Express.js**
- **Fastify**

```typescript
import { getFrameworkAdapter, detectFramework } from '@isl-lang/healer/adapters';

// Auto-detect
const adapter = await getFrameworkAdapter('/path/to/project');

// Override
const adapter = await getFrameworkAdapter('/path/to/project', 'express');
```

## Built-in Recipes

| Rule ID | Description |
|---------|-------------|
| `intent/rate-limit-required` | Add rate limiting middleware |
| `intent/audit-required` | Add audit logging |
| `intent/no-pii-logging` | Remove console.log |
| `intent/input-validation` | Add Zod validation |
| `intent/idempotency-required` | Add idempotency handling |
| `intent/server-side-amount` | Server-side amount calculation |
| `quality/no-stubbed-handlers` | Replace TODO stubs |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for:
- Component diagram
- Data flow
- Security model
- Invariants

## API Reference

### Functions

- `healUntilShip(ast, code, options)` - Convenience function
- `createHealer(ast, root, code, options)` - Create healer instance
- `getFrameworkAdapter(root, override?)` - Get framework adapter
- `detectFramework(root)` - Detect project framework

### Classes

- `ISLHealerV2` - Main healer class
- `GateIngester` - JSON/SARIF parser
- `FixRecipeRegistryImpl` - Recipe registry
- `WeakeningGuard` - Patch validator
- `ProofBundleV2Builder` - Proof builder

## License

MIT
