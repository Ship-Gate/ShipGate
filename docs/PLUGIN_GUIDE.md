# ShipGate Plugin Guide — Building Third-Party SpeclessChecks

> Build custom checks that plug directly into ShipGate's gate pipeline.  
> No ISL spec required — your check runs automatically on every `shipgate gate` invocation.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [SpeclessCheck Interface](#speclesscheck-interface)
4. [Tutorial: Build a "No Console.log" Check](#tutorial-build-a-no-consolelog-check)
5. [Critical Failure Patterns](#critical-failure-patterns)
6. [Publishing Your Check](#publishing-your-check)
7. [Reference: Built-in Adapters](#reference-built-in-adapters)

---

## Introduction

**SpeclessChecks** are pluggable analysis passes that run inside ShipGate's gate pipeline
when no ISL specification is present (specless mode). They allow third-party authors to
extend the gate with custom security, quality, and compliance checks — without requiring
users to write ISL specs.

Every SpeclessCheck:

- Receives the implementation source code and file path
- Returns an array of `GateEvidence` entries (pass / fail / warn / skip)
- Integrates with the verdict engine's scoring and critical-failure detection
- Installs as an optional peer dependency of `@isl-lang/gate`

When the gate runs in specless mode, it iterates over all registered checks, collects
their evidence, and feeds it into the **Verdict Engine** to produce a SHIP / WARN / NO_SHIP
decision.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Gate Pipeline                                 │
│                                                                      │
│  ┌──────────────┐    ┌──────────────────────┐    ┌────────────────┐  │
│  │ Input        │    │ Specless Registry     │    │ Verdict Engine │  │
│  │ Resolution   │───►│                      │───►│                │  │
│  │              │    │  ┌─────────────────┐  │    │  Score ───► SHIP │
│  │ spec?        │    │  │ Security Check  │  │    │  Score ───► WARN │
│  │ impl source  │    │  │ Hallucination   │  │    │  Critical ► NO_SHIP
│  └──────────────┘    │  │ Mock Detector   │  │    └────────────────┘  │
│                      │  │ Firewall        │  │                       │
│                      │  │ Taint Tracker   │  │                       │
│                      │  │ Auth Drift      │  │                       │
│                      │  │ Supply Chain    │  │                       │
│                      │  │ Phantom Deps    │  │                       │
│                      │  │ Semgrep         │  │                       │
│                      │  │ Fake Success    │  │                       │
│                      │  │ ─ ─ ─ ─ ─ ─ ─  │  │                       │
│                      │  │ YOUR CHECK HERE │  │                       │
│                      │  └─────────────────┘  │                       │
│                      └──────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────┘
```

### How checks are registered and discovered

1. Each check is a separate npm package that exports a `SpeclessCheck` object.
2. An **adapter file** calls `registerSpeclessCheck(check)` as a module side-effect.
3. The adapter is imported from `@isl-lang/gate`'s specless entry point (`specless/index.ts`).
4. At gate runtime, `runSpeclessChecks()` iterates every registered check in order.
5. Evidence from all checks is aggregated and fed to `produceVerdict()`.

Registration is idempotent — calling `registerSpeclessCheck` with a duplicate name is a no-op.

---

## SpeclessCheck Interface

All types are exported from `@isl-lang/gate/authoritative/specless-registry` and
`@isl-lang/gate/authoritative/verdict-engine`.

### SpeclessCheck

```typescript
interface SpeclessCheck {
  /** Unique human-readable name, e.g. "no-console-log" */
  name: string;

  /** Run the check against a single file within the given context. */
  run(file: string, context: GateContext): Promise<GateEvidence[]>;
}
```

### GateContext

```typescript
interface GateContext {
  /** Absolute path to project root */
  projectRoot: string;

  /** Implementation source code (concatenated if directory) */
  implementation: string;

  /** Whether spec was explicitly marked optional */
  specOptional: boolean;
}
```

### GateEvidence

```typescript
type GateEvidenceSource =
  | 'isl-spec'
  | 'static-analysis'
  | 'runtime-eval'
  | 'test-execution'
  | 'specless-scanner';

interface GateEvidence {
  /** Where this evidence came from — use 'specless-scanner' for plugins */
  source: GateEvidenceSource;

  /** What was checked, e.g. 'security_violation: SQL injection in query()' */
  check: string;

  /** Outcome: pass | fail | warn | skip */
  result: 'pass' | 'fail' | 'warn' | 'skip';

  /** Confidence in this result, 0–1 */
  confidence: number;

  /** Human-readable explanation */
  details: string;
}
```

### Scoring Rules

| Result | Factor | Effect                            |
| ------ | ------ | --------------------------------- |
| pass   | 1.0    | Full positive contribution        |
| warn   | 0.5    | Half contribution                 |
| fail   | 0.0    | No positive contribution          |
| skip   | —      | Excluded from score entirely      |

The aggregate score is:

```
Score = Σ(confidence × resultFactor × sourceWeight) / Σ(sourceWeight)
```

- `specless-scanner` evidence has weight 1.
- `isl-spec` evidence has weight 2 (ISL-verified evidence is trusted more).
- Score ≥ 0.85 → SHIP, ≥ 0.50 → WARN, below → NO_SHIP.
- Any **critical failure** forces NO_SHIP regardless of score.

---

## Tutorial: Build a "No Console.log" Check

This tutorial walks through building a check that flags `console.log` statements
in production TypeScript/JavaScript files.

### Step 1: Create the package

```bash
mkdir shipgate-check-no-console && cd shipgate-check-no-console
npm init -y
```

Or use the scaffolding CLI:

```bash
npx create-shipgate-check no-console
```

**package.json**:

```json
{
  "name": "shipgate-check-no-console",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./adapter": {
      "import": "./dist/adapter.js",
      "types": "./dist/adapter.d.ts"
    }
  },
  "peerDependencies": {
    "@isl-lang/gate": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "@isl-lang/gate": { "optional": false }
  },
  "devDependencies": {
    "@isl-lang/gate": "workspace:*",
    "typescript": "^5.3.3",
    "tsup": "^8.0.1",
    "vitest": "^1.2.0"
  },
  "scripts": {
    "build": "tsup src/index.ts src/adapter.ts --format esm --dts --clean",
    "test": "vitest run"
  }
}
```

### Step 2: Implement the check

**src/index.ts**:

```typescript
import type { GateEvidence } from '@isl-lang/gate/authoritative/verdict-engine';
import type { SpeclessCheck, GateContext } from '@isl-lang/gate/authoritative/specless-registry';

const CONSOLE_PATTERN = /\bconsole\.(log|debug|info|warn|error|trace|dir|table)\s*\(/g;

function isProductionFile(file: string): boolean {
  const lower = file.toLowerCase();
  if (lower.includes('.test.') || lower.includes('.spec.')) return false;
  if (lower.includes('__tests__') || lower.includes('__mocks__')) return false;
  if (lower.includes('/test/') || lower.includes('/tests/')) return false;
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower);
}

export const noConsoleCheck: SpeclessCheck = {
  name: 'no-console-log',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isProductionFile(file)) {
      return [];
    }

    const lines = context.implementation.split('\n');
    const matches: Array<{ line: number; content: string; method: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      let match: RegExpExecArray | null;
      CONSOLE_PATTERN.lastIndex = 0;
      while ((match = CONSOLE_PATTERN.exec(lines[i])) !== null) {
        matches.push({
          line: i + 1,
          content: lines[i].trim(),
          method: match[1],
        });
      }
    }

    if (matches.length === 0) {
      return [{
        source: 'specless-scanner',
        check: 'no-console-log: clean',
        result: 'pass',
        confidence: 0.90,
        details: `No console statements found in ${file}`,
      }];
    }

    return matches.map((m) => ({
      source: 'specless-scanner' as const,
      check: `console-usage: console.${m.method} at line ${m.line}`,
      result: 'warn' as const,
      confidence: 0.85,
      details: `console.${m.method}() found at line ${m.line}: "${m.content.substring(0, 100)}"`,
    }));
  },
};

export type { SpeclessCheck, GateContext, GateEvidence };
```

### Step 3: Register via adapter

**src/adapter.ts**:

```typescript
import { registerSpeclessCheck } from '@isl-lang/gate/authoritative/specless-registry';
import { noConsoleCheck } from './index.js';

registerSpeclessCheck(noConsoleCheck);
```

The adapter file is imported as a side-effect. When `@isl-lang/gate` loads
the specless module, it imports all registered adapter files.

### Step 4: Add as optional peer dep in isl-gate

To integrate into the main gate, add your package to `@isl-lang/gate`'s
`peerDependencies` and `peerDependenciesMeta` (optional: true), then add
an import in `packages/isl-gate/src/specless/index.ts`:

```typescript
import 'shipgate-check-no-console/adapter';
```

For third-party checks that aren't part of the monorepo, users install
the package and the adapter self-registers on import.

### Step 5: Test with vitest

**tests/check.test.ts**:

```typescript
import { describe, it, expect } from 'vitest';
import { noConsoleCheck } from '../src/index.js';
import type { GateContext } from '../src/index.js';

function makeContext(impl: string): GateContext {
  return { projectRoot: '/tmp/test', implementation: impl, specOptional: true };
}

describe('noConsoleCheck', () => {
  it('passes clean files', async () => {
    const evidence = await noConsoleCheck.run(
      'src/service.ts',
      makeContext('export function add(a: number, b: number) { return a + b; }'),
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].result).toBe('pass');
  });

  it('warns on console.log', async () => {
    const evidence = await noConsoleCheck.run(
      'src/handler.ts',
      makeContext('function handle(req) {\n  console.log("debug", req);\n  return req;\n}'),
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].result).toBe('warn');
    expect(evidence[0].check).toContain('console.log');
  });

  it('skips test files', async () => {
    const evidence = await noConsoleCheck.run(
      'src/handler.test.ts',
      makeContext('console.log("test output");'),
    );
    expect(evidence).toHaveLength(0);
  });

  it('detects multiple console methods', async () => {
    const code = [
      'console.log("a");',
      'console.error("b");',
      'console.warn("c");',
    ].join('\n');
    const evidence = await noConsoleCheck.run('src/app.ts', makeContext(code));
    expect(evidence).toHaveLength(3);
    expect(evidence.every(e => e.result === 'warn')).toBe(true);
  });
});
```

---

## Critical Failure Patterns

The verdict engine scans each evidence entry's `check` field for **critical failure
prefixes**. When a `fail` result contains one of these prefixes, it forces an
immediate **NO_SHIP** verdict regardless of the aggregate score.

| Prefix                     | Meaning                                | Example                                          |
| -------------------------- | -------------------------------------- | ------------------------------------------------ |
| `security_violation`       | Auth bypass, secret exposure, injection | `security_violation: SQL injection in query()`   |
| `critical_vulnerability`   | CVE with CVSS ≥ 9.0                   | `critical_vulnerability: CVE-2024-1234`          |
| `fake_feature_detected`    | Code compiles but doesn't work         | `fake_feature_detected: hardcoded return true`   |
| `verification_blocked`     | Tests couldn't execute                 | `verification_blocked: import error in suite`    |
| `postcondition_violation`  | Spec says X, code does Y               | `postcondition_violation: User.exists(result.id)`|

### How to map findings to these prefixes

Use the prefix as the start of your `check` string when the finding is severe enough
to block shipping:

```typescript
// High-severity → use critical prefix → forces NO_SHIP
check: `security_violation: ${finding.id} ${finding.title}`

// Medium-severity → use descriptive prefix → contributes to score
check: `security: ${finding.id} ${finding.title}`
```

The verdict engine matches with `check.includes(prefix)`, so the prefix can appear
anywhere in the check string, but convention is to place it at the start.

### Confidence guidelines

| Severity  | Recommended confidence | Result   |
| --------- | ---------------------- | -------- |
| Critical  | 0.90–0.95              | `fail`   |
| High      | 0.80–0.90              | `fail`   |
| Medium    | 0.65–0.80              | `warn`   |
| Low       | 0.50–0.65              | `warn`   |
| Info      | 0.40–0.50              | `pass`   |

---

## Publishing Your Check

### npm naming convention

Use the prefix `shipgate-check-` for community checks:

```
shipgate-check-no-console
shipgate-check-no-any
shipgate-check-license-audit
shipgate-check-api-versioning
```

Official checks use the `@isl-lang/` scope:

```
@isl-lang/security-scanner
@isl-lang/hallucination-scanner
@isl-lang/mock-detector
```

### package.json structure

```json
{
  "name": "shipgate-check-your-check",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./adapter": {
      "import": "./dist/adapter.js",
      "types": "./dist/adapter.d.ts"
    }
  },
  "keywords": ["shipgate", "shipgate-check", "isl", "specless"],
  "peerDependencies": {
    "@isl-lang/gate": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "@isl-lang/gate": { "optional": false }
  }
}
```

### Peer dependency setup

Your check declares `@isl-lang/gate` as a peer dependency so it shares the same
registry instance. The gate loads your adapter file, which calls
`registerSpeclessCheck()` — this ensures your check participates in the gate
pipeline without version conflicts.

Users install your check alongside the gate:

```bash
npm install shipgate-check-your-check
```

Then import the adapter in their gate configuration or entry point:

```typescript
import 'shipgate-check-your-check/adapter';
```

---

## Reference: Built-in Adapters

These adapters ship with `@isl-lang/gate` and serve as canonical examples.
Each wraps an external scanner package as a `SpeclessCheck`.

| Adapter                  | Package                              | Detects                                |
| ------------------------ | ------------------------------------ | -------------------------------------- |
| `security-adapter`       | `@isl-lang/security-scanner`         | SQL injection, hardcoded secrets, auth bypass, insecure crypto |
| `hallucination-adapter`  | `@isl-lang/hallucination-scanner`    | Hallucinated APIs, phantom imports, fabricated types |
| `firewall-adapter`       | `@isl-lang/firewall`                 | Runtime firewall violations, blocked hosts |
| `mock-detector-adapter`  | `@isl-lang/mock-detector`            | Hardcoded success returns, placeholder data |
| `fake-success-adapter`   | `@isl-lang/fake-success-ui-detector` | UI components that fake success states |
| `phantom-deps-adapter`   | `@isl-lang/phantom-dependency-scanner`| Dependencies used but not in package.json |
| `auth-drift-adapter`     | `@isl-lang/security-verifier-enhancer`| Auth middleware drift between spec and impl |
| `taint-adapter`          | `@isl-lang/taint-tracker`            | Tainted data flow from user input to sinks |
| `supply-chain-adapter`   | `@isl-lang/supply-chain-verifier`    | Supply chain attack patterns |
| `semgrep-adapter`        | `@isl-lang/semgrep-integration`      | Semgrep rule violations |

Source code: [`packages/isl-gate/src/specless/`](../packages/isl-gate/src/specless/)

Each adapter follows the same pattern:

1. Detect supported file extensions
2. Dynamically import the scanner package (`await import(...)`)
3. Map scanner-specific findings to `GateEvidence[]`
4. Return `skip` evidence if the scanner package isn't installed
5. Call `registerSpeclessCheck(check)` at module scope

Study [`security-adapter.ts`](../packages/isl-gate/src/specless/security-adapter.ts)
for the reference implementation.
