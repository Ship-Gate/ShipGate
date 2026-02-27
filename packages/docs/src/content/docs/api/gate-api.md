---
title: Gate API
description: ShipGate decision engine — programmatic SHIP/NO_SHIP verification.
---

The Gate API is ShipGate's core decision engine. It takes ISL specifications and code implementations as input, runs verification, and returns a SHIP/NO_SHIP verdict with a trust score and evidence bundle.

## Programmatic usage

Install the gate package:

```bash
npm install @isl-lang/gate
```

### Authoritative Gate (recommended)

The authoritative gate is the primary entry point for verification:

```typescript
import { runAuthoritativeGate } from "@isl-lang/gate";

const result = await runAuthoritativeGate({
  specPath: "specs/user-service.isl",
  implPath: "src/user-service.ts",
  threshold: 80,
  options: {
    pbt: true,
    chaos: true,
    smt: false,
  },
});

if (result.verdict === "SHIP") {
  // Code is verified — deploy with confidence
}
```

### Gate result shape

```typescript
interface AuthoritativeGateResult {
  /** SHIP, NO_SHIP, or WARN */
  verdict: "SHIP" | "NO_SHIP" | "WARN";

  /** Process exit code: 0 = SHIP, 1 = NO_SHIP */
  exitCode: 0 | 1;

  /** Trust score 0-100 */
  score: number;

  /** Confidence level 0-100 */
  confidence: number;

  /** Human-readable verdict summary */
  summary: string;

  /** Aggregated verification signals */
  aggregation: {
    signals: Signal[];
    testResults: TestResult[];
    findings: Finding[];
  };

  /** Evidence bundle with proof artifacts */
  evidence: EvidenceBundle;

  /** Array of reasons for the verdict */
  reasons: VerdictReason[];

  /** Execution duration in milliseconds */
  durationMs: number;
}
```

### Quick gate check

For a simple pass/fail check without full evidence:

```typescript
import { quickGateCheck, wouldShip } from "@isl-lang/gate";

// Quick check returns boolean
const passed = await wouldShip({
  specPath: "specs/api.isl",
  implPath: "src/api.ts",
  threshold: 85,
});

// Quick check with more detail
const check = await quickGateCheck({
  specPath: "specs/api.isl",
  implPath: "src/api.ts",
});

console.log(check.verdict); // 'SHIP' | 'NO_SHIP' | 'WARN'
console.log(check.score);   // 0-100
```

## CLI: gate command

The `gate` CLI command wraps the Gate API:

```bash
shipgate gate <spec> --impl <file> [options]
```

### Options

| Flag                     | Description                              |
| ------------------------ | ---------------------------------------- |
| `-i, --impl <file>`     | Implementation file or directory (required) |
| `-t, --threshold <score>` | Minimum trust score to SHIP (default: `95`) |
| `-o, --output <dir>`     | Output directory for evidence bundle     |
| `--ci`                   | CI mode: minimal output, just the decision |

### Examples

```bash
# Basic gate check
shipgate gate specs/user-service.isl --impl src/user-service.ts

# Custom threshold
shipgate gate specs/api.isl --impl src/ --threshold 80

# CI mode with evidence output
shipgate gate specs/api.isl --impl src/ --ci --output evidence/
```

### Gate output

```
┌─────────────────────────────┐
│ Verdict: SHIP               │
│ Trust Score: 92/100         │
│ Confidence: 95%             │
│ Duration: 2.3s              │
└─────────────────────────────┘

Reasons:
  ✓ All preconditions verified (8/8)
  ✓ All postconditions verified (12/12)
  ✓ All invariants hold (4/4)
  ✓ All scenarios pass (6/6)
  ⚠ Temporal SLAs not measured (no runtime data)

Evidence bundle: evidence/proof-bundle-abc123.json
```

## Trust score calculation

The trust score is a weighted average of verification categories:

| Category        | Default Weight | What it measures                    |
| --------------- | -------------- | ----------------------------------- |
| Preconditions   | 20%            | Input validation checks pass        |
| Postconditions  | 25%            | Output correctness checks pass      |
| Invariants      | 20%            | Entity constraints hold             |
| Temporal        | 10%            | Latency SLAs met                    |
| Chaos           | 10%            | Resilience tests pass               |
| Coverage        | 15%            | Code coverage of spec assertions    |

### Custom weights

```bash
shipgate gate:trust-score spec.isl --impl src/ \
  --weights "preconditions=30,postconditions=25,invariants=20,temporal=10,chaos=5,coverage=10"
```

### Trust score history

```bash
# View history
shipgate gate:trust-score spec.isl --impl src/ --history

# Tag with commit hash
shipgate gate:trust-score spec.isl --impl src/ \
  --commit-hash $(git rev-parse HEAD)
```

## Evidence bundles

Every gate run produces an evidence bundle — a cryptographic proof of the verification results:

```json
{
  "bundleId": "proof-abc123",
  "timestamp": "2026-02-08T12:00:00Z",
  "verdict": "SHIP",
  "score": 92,
  "spec": {
    "hash": "sha256:abc...",
    "path": "specs/user-service.isl"
  },
  "impl": {
    "hash": "sha256:def...",
    "path": "src/user-service.ts"
  },
  "results": {
    "preconditions": { "passed": 8, "failed": 0 },
    "postconditions": { "passed": 12, "failed": 0 },
    "invariants": { "passed": 4, "failed": 0 },
    "scenarios": { "passed": 6, "failed": 0 }
  }
}
```

### Verify a proof bundle

```bash
shipgate proof verify evidence/proof-bundle-abc123.json
```

## Specless gate

The gate also works without ISL specs, using the firewall scanner:

```typescript
import { runAuthoritativeGate } from "@isl-lang/gate";

const result = await runAuthoritativeGate({
  implPath: "src/",
  // No specPath — runs specless checks
  threshold: 70,
});
```

Specless checks include:
- Security scanning (credentials, auth bypass, PII)
- Truthpack validation (ghost routes, imports, env vars)
- Hallucination detection (hardcoded values, fake APIs)

## Exit codes

| Code | Meaning                       |
| ---- | ----------------------------- |
| `0`  | SHIP — verification passed    |
| `1`  | NO_SHIP — verification failed |
