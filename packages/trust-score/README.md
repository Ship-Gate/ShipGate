# @isl-lang/trust-score

Trust score computation from verification evidence. Computes a score ∈ [0,1] based on multiple verification signals to drive **SHIP/NO-SHIP** decisions.

## Overview

Gate decisions are meaningless without quantified confidence. This package provides a principled approach to computing trust scores from verification evidence:

- **Multi-signal aggregation**: Combines static checks, evaluator verdicts, SMT proofs, PBT results, and chaos outcomes
- **No single signal dominates**: Weights are capped and normalized to prevent any signal from overwhelming others
- **Unknown reduces trust**: Incomplete verification is penalized appropriately
- **Stable and explainable**: Same inputs produce same outputs with detailed breakdowns
- **Threshold-driven decisions**: Clear SHIP/NO_SHIP/REVIEW_REQUIRED outcomes

## Installation

```bash
pnpm add @isl-lang/trust-score
```

## Quick Start

```typescript
import { computeTrustScore, EvidenceBuilder, formatForTerminal } from '@isl-lang/trust-score';

// Build evidence from your verification results
const evidence = new EvidenceBuilder()
  .withStaticChecks([
    { checkId: 'type-check', name: 'Type Safety', verdict: 'pass' },
  ])
  .withEvaluatorVerdicts([
    { clauseId: 'post_1', type: 'postcondition', expression: 'result > 0', verdict: 'pass' },
    { clauseId: 'inv_1', type: 'invariant', expression: 'balance >= 0', verdict: 'pass' },
  ])
  .withPBTResults([
    { behaviorName: 'CreateUser', verdict: 'pass', iterations: 100, successes: 100, failures: 0, filtered: 0, violations: [] },
  ])
  .build();

// Compute trust score
const score = computeTrustScore(evidence);

console.log(formatForTerminal(score));
// Output:
// ═══════════════════════════════════════════════════════════════
//                         TRUST SCORE REPORT
// ═══════════════════════════════════════════════════════════════
//
//   Trust Score:     ████████████████░░░░ 82%
//   Confidence:      ████████░░░░░░░░░░░░ 40%
//   Decision:        REVIEW_REQUIRED
//   ...

// Use in CI/CD
if (score.decision === 'NO_SHIP') {
  process.exit(1);
}
```

## Signal Categories

The trust score aggregates evidence from five verification signals:

| Signal | Default Weight | Description |
|--------|---------------|-------------|
| **Static Checks** | 15% | Type checking, linting, null safety |
| **Evaluator Verdicts** | 30% | Postcondition and invariant evaluations |
| **SMT Proofs** | 25% | Formal verification via SMT solvers |
| **PBT Results** | 20% | Property-based testing outcomes |
| **Chaos Outcomes** | 10% | Resilience testing under fault injection |

### Why These Weights?

- **Evaluator verdicts** (30%): Direct contract verification is the core signal
- **SMT proofs** (25%): Formal proofs provide strong guarantees
- **PBT results** (20%): Randomized testing catches edge cases
- **Static checks** (15%): Early, fast feedback but less comprehensive
- **Chaos outcomes** (10%): Important for resilience but optional for many systems

## Scoring Rules

### No Single Signal Dominates

Weights are capped at `MAX_SINGLE_SIGNAL_WEIGHT` (default 40%) to prevent any signal from overwhelming the score:

```typescript
const score = computeTrustScore(evidence, {
  maxSingleSignalWeight: 0.35, // Cap at 35%
});
```

### Unknown Reduces Trust

Incomplete verification (unknown verdicts) incurs penalties:

```typescript
const penalties = {
  unknownPenalty: 0.15,      // Per-unknown penalty
  failurePenalty: 0.25,      // Per-failure penalty
  missingSignalPenalty: 0.10, // Missing signal category
  criticalFailureMultiplier: 2.0,
};
```

### Decision Thresholds

```typescript
const thresholds = {
  ship: 0.90,        // ≥90% → SHIP
  review: 0.70,      // ≥70% → REVIEW_REQUIRED
  minConfidence: 0.60, // Minimum confidence for SHIP
};
// Below review threshold → NO_SHIP
// Critical failures → NO_SHIP (regardless of score)
```

## API Reference

### `computeTrustScore(evidence, config?)`

Compute trust score from evidence.

```typescript
function computeTrustScore(
  evidence: TrustEvidenceInput,
  config?: TrustScoreConfig
): TrustScore;
```

### `TrustScore` Interface

```typescript
interface TrustScore {
  score: number;           // Overall score [0, 1]
  confidence: number;      // Confidence in score [0, 1]
  decision: ShipDecision;  // 'SHIP' | 'NO_SHIP' | 'REVIEW_REQUIRED'
  signals: SignalScore[];  // Breakdown by category
  summary: TrustSummary;   // Human-readable summary
  trustReducers: TrustReducer[]; // Factors that reduced trust
  recommendations: Recommendation[]; // How to improve
  computedAt: string;      // ISO timestamp
  algorithmVersion: string; // For tracking changes
}
```

### `EvidenceBuilder`

Fluent builder for constructing evidence:

```typescript
const evidence = new EvidenceBuilder()
  .withStaticChecks([...])
  .withEvaluatorVerdicts([...])
  .withSMTProofs([...])
  .withPBTResults([...])
  .withChaosOutcomes([...])
  .build();
```

### Formatters

```typescript
// JSON for CI/machine consumption
formatAsJSON(score: TrustScore, pretty?: boolean): string;

// Terminal output with ANSI colors
formatForTerminal(score: TrustScore, useColor?: boolean): string;

// Markdown for reports/PRs
formatAsMarkdown(score: TrustScore): string;
```

### Adapters

Convert from existing ISL verification packages:

```typescript
// From @isl-lang/verify-pipeline
fromVerifyPipelineResult(result): Partial<TrustEvidenceInput>;

// From @isl-lang/isl-pbt
fromPBTReport(report): PBTEvidence;

// From @isl-lang/verifier-chaos
fromChaosResult(result): ChaosEvidence;
```

## Configuration

```typescript
interface TrustScoreConfig {
  weights?: {
    static_checks?: number;
    evaluator_verdicts?: number;
    smt_proofs?: number;
    pbt_results?: number;
    chaos_outcomes?: number;
  };
  thresholds?: {
    ship?: number;     // Default: 0.90
    review?: number;   // Default: 0.70
    minConfidence?: number; // Default: 0.60
  };
  penalties?: {
    unknownPenalty?: number;      // Default: 0.15
    failurePenalty?: number;      // Default: 0.25
    missingSignalPenalty?: number; // Default: 0.10
    criticalFailureMultiplier?: number; // Default: 2.0
  };
  maxSingleSignalWeight?: number; // Default: 0.40
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Compute Trust Score
  run: |
    pnpm isl verify --output=evidence.json
    pnpm isl trust-score --input=evidence.json --format=json > trust.json
    
- name: Gate on Trust Score
  run: |
    DECISION=$(jq -r '.decision' trust.json)
    if [ "$DECISION" = "NO_SHIP" ]; then
      echo "❌ Trust score too low to ship"
      exit 1
    fi
```

### Programmatic Usage

```typescript
import { computeTrustScore } from '@isl-lang/trust-score';

const score = computeTrustScore(evidence);

switch (score.decision) {
  case 'SHIP':
    console.log('✅ Ready to deploy');
    break;
  case 'REVIEW_REQUIRED':
    console.log('⚠️ Manual review needed');
    // Create PR comment with score.summary
    break;
  case 'NO_SHIP':
    console.log('❌ Cannot ship');
    console.log('Concerns:', score.summary.concerns);
    process.exit(1);
}
```

## Understanding the Output

### Trust Reducers

Factors that lowered the score:

```typescript
interface TrustReducer {
  id: string;           // e.g., 'violated_postconditions'
  description: string;  // Human-readable explanation
  impact: number;       // How much this reduced score
  severity: 'critical' | 'major' | 'minor';
  category: SignalCategory | 'overall';
}
```

Critical reducers force `NO_SHIP` regardless of score:
- Violated postconditions
- SMT counterexamples found
- Chaos invariant violations
- Critical static analysis errors

### Recommendations

Actionable steps to improve trust:

```typescript
interface Recommendation {
  id: string;
  description: string;
  expectedImpact: number;  // Estimated score improvement
  priority: 'high' | 'medium' | 'low';
  category: SignalCategory | 'overall';
}
```

## Algorithm Stability

The trust score algorithm is versioned (`algorithmVersion` field) to ensure:

1. **Reproducibility**: Same evidence always produces same score
2. **Tracking**: Changes to the algorithm are versioned
3. **Comparison**: Scores from different versions can be flagged

## License

MIT
