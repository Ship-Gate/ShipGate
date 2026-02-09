# @isl-lang/isl-policy-engine

Deterministic policy engine for ShipGate. Evaluates block/allow/warn decisions
based on claims, verdicts, confidence, and blast radius — with explainable output.

## Installation

```bash
pnpm add @isl-lang/isl-policy-engine
```

## Usage

```typescript
import { evaluate, starterPolicyPack, formatTerminal } from '@isl-lang/isl-policy-engine';

const result = evaluate([starterPolicyPack], {
  claims: extractedClaims,
  evidence: [],
  files: [{ path: 'src/api.ts', content: sourceCode }],
  verdict: 'NO_SHIP',
  confidence: 42,
});

console.log(formatTerminal(result));
// → POLICY CHECK: BLOCKED
//   [BLOCK] No Fake Endpoints (starter/no-fake-endpoints)
//           blocked because 3 API endpoint claim(s) found but evidence is missing
```

## Policy DSL

Policies are defined declaratively with conditions:

```typescript
const policy: PolicyDef = {
  id: 'custom/low-confidence-block',
  name: 'Low Confidence Block',
  description: 'Block when confidence is below 30%',
  severity: 'error',
  tier: 'hard_block',
  when: { kind: 'confidence', op: 'lt', threshold: 30 },
  action: 'block',
  explanation: 'blocked because confidence is {confidence}% (below 30%)',
};
```

### Condition Types

| Kind | Description |
|------|-------------|
| `verdict` | Match on SHIP/NO_SHIP verdict |
| `confidence` | Numeric comparison on confidence % |
| `blast_radius` | Count of files/claims/violations |
| `claim_type` | Filter by claim types present |
| `claim_field` | String match on claim value/context |
| `metric` | Compare trust_score, claim_count, etc. |
| `presence` | Check if a field exists |
| `logic` | Combine with `and`/`or`/`not` |

### Starter Policies

The built-in starter pack includes:

- **no-fake-endpoints** — blocks when API endpoint claims lack evidence
- **no-missing-env-vars** — blocks when env variable claims are unverified
- **no-swallowed-errors** — warns on empty catch blocks

## CLI

```bash
# Run policy engine on current directory
shipgate policy engine-check

# Run with specific pack
shipgate policy engine-check --pack starter

# CI mode (JSON stdout, summary to stderr)
shipgate policy engine-check --ci
```

## API

- `evaluate(packs, input)` — run all policies, returns `PolicyEngineResult`
- `evaluateCondition(condition, input)` — test a single condition
- `formatTerminal(result)` — ANSI-free terminal output
- `formatMarkdown(result)` — Markdown report
- `formatJSON(result)` — JSON output
- `formatCILine(result)` — one-line CI summary
- `explainDecision(decision)` — "blocked because X" string

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
