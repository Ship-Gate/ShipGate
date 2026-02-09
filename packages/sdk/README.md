# @shipgate/sdk

Programmatic access to ISL parsing, behavioral verification, and gate decisions.

Embed Shipgate into your own tools, CI pipelines, and developer workflows.

## Installation

```bash
npm install @shipgate/sdk
# or
pnpm add @shipgate/sdk
```

## Quick Start

```typescript
import {
  parseISL,
  verifySpec,
  decideGate,
  generateSpecFromSource,
  lintISL,
} from '@shipgate/sdk';

// 1. Parse ISL
const parsed = parseISL(`
  domain Auth version "1.0" {
    behavior Login {
      input { email: String, password: String }
      output { success: AuthToken }
      postconditions {
        success { result.token.length > 0 }
      }
    }
  }
`);

if (parsed.success) {
  console.log(parsed.domain.behaviors.map(b => b.name)); // ['Login']
}

// 2. Verify implementation against spec
const result = await verifySpec({
  specPath: 'src/auth/login.isl',
  implPath: 'src/auth/login.ts',
});

// 3. Make a gate decision
const verdict = decideGate(result);
console.log(verdict); // 'SHIP' | 'WARN' | 'NO_SHIP'

// 4. Generate a spec from source code
const spec = await generateSpecFromSource('src/auth/login.ts');
console.log(spec.isl); // domain Login version "0.1.0" { ... }

// 5. Lint ISL for quality
const report = lintISL(islSource);
console.log(report.score); // 0–100
```

## API Reference

### `parseISL(source: string): ParseResult`

Parse ISL source code synchronously. Returns a stable `ParseResult` with a
`DomainSummary` (no AST internals exposed).

**Pure function** — no I/O, no side effects.

```typescript
const result = parseISL(`
  domain Payments version "2.0" {
    behavior Charge {
      input { amount: Decimal }
      postconditions { success { result.charged == true } }
    }
  }
`);

if (result.success) {
  console.log(result.domain.name);       // 'Payments'
  console.log(result.domain.behaviors);  // [{ name: 'Charge', ... }]
} else {
  console.error(result.errors);
}
```

### `parseISLFile(path: string): Promise<ParseResult>`

Parse an ISL file from disk. Reads the file asynchronously, then parses.
File-read errors are returned as parse errors (never throws).

```typescript
const result = await parseISLFile('specs/auth.isl');
```

### `verifySpec(options: VerifyOptions): Promise<VerifyResult>`

Verify an implementation against its ISL specification using the
authoritative gate engine.

```typescript
const result = await verifySpec({
  specPath: 'src/auth/login.isl',
  implPath: 'src/auth/login.ts',
  projectRoot: '/path/to/project',  // optional, defaults to cwd
  thresholds: {                      // optional
    ship: 80,                        // minimum score for SHIP
    warn: 50,                        // minimum score for WARN
  },
});

console.log(result.verdict);     // 'SHIP' | 'WARN' | 'NO_SHIP'
console.log(result.score);       // 0–100
console.log(result.passed);      // true if verdict is SHIP
console.log(result.summary);     // human-readable summary
console.log(result.reasons);     // [{ label, impact }]
console.log(result.suggestions); // actionable improvements
```

### `decideGate(result: VerifyResult): GateVerdict`

Make an explicit gate decision from a verification result.

**Pure, deterministic function** — same input always produces the same output.

#### Decision Algorithm

| Condition | Verdict |
|---|---|
| Any reason with `impact: 'critical'` | `NO_SHIP` |
| `passed === true` AND `score >= 80` | `SHIP` |
| `score >= 50` | `WARN` |
| `score < 50` | `NO_SHIP` |

```typescript
const verdict = decideGate(result);

switch (verdict) {
  case 'SHIP':
    console.log('Safe to deploy');
    break;
  case 'WARN':
    console.log('Review recommended before deploy');
    break;
  case 'NO_SHIP':
    console.log('Critical issues — do NOT deploy');
    process.exitCode = 1;
    break;
}
```

### `generateSpecFromSource(sourcePath: string): Promise<GeneratedSpec>`

Generate a starter ISL specification from a TypeScript/JavaScript source file.
Uses static analysis (no AI, no runtime execution) to extract exported
functions and interfaces.

```typescript
const spec = await generateSpecFromSource('src/payments/charge.ts');

console.log(spec.isl);        // ISL source code
console.log(spec.confidence);  // 0–1 (higher = more complete)
console.log(spec.warnings);    // any generation caveats
```

### `lintISL(source: string): QualityReport`

Score an ISL specification across five quality dimensions.

```typescript
const report = lintISL(islSource);

console.log(report.score);                     // overall 0–100
console.log(report.dimensions.completeness);    // { score, findings }
console.log(report.dimensions.specificity);     // { score, findings }
console.log(report.dimensions.security);        // { score, findings }
console.log(report.dimensions.testability);     // { score, findings }
console.log(report.dimensions.consistency);     // { score, findings }
console.log(report.suggestions);                // actionable items
```

## Types

All public types are stable and documented:

| Type | Description |
|---|---|
| `ParseResult` | Result of parsing ISL (success, domain, errors) |
| `DomainSummary` | Simplified domain info (name, version, behaviors, entities) |
| `BehaviorSummary` | Behavior name + conditions as strings |
| `VerifyResult` | Verification result (verdict, score, reasons) |
| `GateVerdict` | `'SHIP'` \| `'WARN'` \| `'NO_SHIP'` |
| `VerifyOptions` | Input options for `verifySpec` |
| `GeneratedSpec` | Generated ISL with confidence and warnings |
| `QualityReport` | Quality scores across five dimensions |

## Stability Contract

- **AST internals** are never exposed in the public API
- All returned objects are **frozen** (read-only)
- **Breaking changes** require a major version bump
- Only **documented fields** are considered stable
- The SDK has **< 15 public exports** by design

## Gate Decision Explained

Shipgate's gate decision is the core value of the SDK. It answers one question:

> **Is this code safe to deploy?**

The `decideGate` function evaluates a `VerifyResult` and produces a
three-state verdict:

- **SHIP** — All behavioral checks pass, quality score is high. Safe to deploy.
- **WARN** — Some issues detected but not critical. Human review recommended.
- **NO_SHIP** — Critical issues found (security, correctness, compliance). Block deployment.

Critical failures (hardcoded secrets, auth bypass, contract violations) always
produce `NO_SHIP` regardless of the overall score.

## CI Integration

```typescript
import { parseISLFile, verifySpec, decideGate } from '@shipgate/sdk';

const result = await verifySpec({
  specPath: process.argv[2],
  implPath: process.argv[3],
});

const verdict = decideGate(result);

if (verdict === 'NO_SHIP') {
  console.error(`BLOCKED: ${result.summary}`);
  for (const reason of result.reasons) {
    console.error(`  [${reason.impact}] ${reason.label}`);
  }
  process.exitCode = 1;
} else if (verdict === 'WARN') {
  console.warn(`WARNING: ${result.summary}`);
} else {
  console.log(`SHIP: ${result.summary}`);
}
```

## License

MIT
