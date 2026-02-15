# Claims Verifier — Design Specification

## Purpose

The `@isl-lang/claims-verifier` package prevents generated copy (docs, landing pages, marketing) from containing invented or unverifiable numeric claims. Every quantitative assertion must trace to a known fact or be flagged/softened.

## Architecture

```
Content → Extractor → Claims[] → Verifier → VerificationResult[] → Linter → LintResult
                                                                         ↓
                                                                    Softener → SoftenResult
```

## Claim Types Supported

| Pattern | Example | Unit | Requires Verification |
|---------|---------|------|----------------------|
| percentage | `94%` | `%` | Yes |
| count | `25 built-in rules` | `rules` | Yes |
| time | `under 100ms` | `ms` | Yes |
| multiplier | `3x faster` | `faster` | Yes |
| money | `$29/user` | `dollars` | Yes |
| trust_score | `Score: 87%` | `%` | Yes |
| range | `85-95%` | `%` | Yes |
| average | `average of 94%` | `%` | Yes |
| version | `v1.0` | — | No |

## Extraction Rules

1. Patterns are applied per-line with global regex matching.
2. Count pattern allows up to N intervening alphabetic words between number and unit (e.g., "25 built-in rules"). Intervening tokens must start with a letter to prevent consuming other numbers.
3. Money pattern always assigns unit `dollars` regardless of `/per` suffix.
4. Hedged claims (containing "approximately", "about", "up to", etc.) are **skipped by default** (`includeHedged: false`).
5. Contextual claims ("in this example", "sample", etc.) are **skipped by default**.
6. Deduplication: same `file:line:value` tuple keeps only the first occurrence.

## Verification Algorithm

### Fact Matching (`findMatchingFact`)

Given a claim, find the best-matching known fact:

1. **Unit filter**: If both claim and fact have units and they differ → skip fact.
2. **Similarity score** = `contextSimilarity × 0.5 + unitBonus + valueBonus`
   - `contextSimilarity`: Jaccard word similarity between claim context and fact description (0–1).
   - `unitBonus`: 0.3 if claim.unit === fact.unit, else 0.
   - `valueBonus`: 0.2 if values match within tolerance, else 0.
3. Threshold: `minSimilarity = 0.3` (default). Best match above threshold wins.
4. Value match is a **bonus, not a requirement** — this enables mismatch detection (finding the right fact even when the claimed value is wrong).

### Verdict Rules (deterministic, in order)

| Condition | Status | Verified |
|-----------|--------|----------|
| Claim has pre-existing source | `outdated` | true |
| No matching fact found | `unverifiable` | false |
| Matching fact found, values match (within tolerance) | `verified` | true |
| Matching fact found, values differ | `mismatch` | false |

- **Tolerance**: default 5% relative difference. `|claimed - actual| / actual ≤ 0.05`.
- **Precedence**: FAIL (mismatch) dominates unless softened.

## Softening Algorithm

### Claim Type Detection (priority order)

1. Text contains "trust score" → `trust_score`
2. Text contains "average" → `average`
3. Text matches `\dx` → `multiplier`
4. Unit is `%` or `percent` → `percentage`
5. Unit matches `/rules?|features?|tests?/` → `count`
6. Unit matches `/ms|seconds?|minutes?/` → `time`

Text-based checks come **before** unit-based checks because they are more specific.

### Softening Modes

| Style | Percentage | Trust Score | Count |
|-------|-----------|-------------|-------|
| conservative | `approximately N%` | `trust scores typically around N%` | `over M units` |
| moderate | `around N%` | `trust scores can reach N%` | `N+ units` |
| aggressive | `up to N%` | `high trust scores` | `dozens of units` |

### Softening Guards

- **Verified claims are never softened.** Only claims in LintResult.issues (unverifiable/mismatch) are candidates.
- Claims with confidence ≥ threshold (default 0.5) are skipped.
- Softening never upgrades severity (FAIL stays FAIL unless the claim is explicitly soft-eligible).

## Diagnostic Codes

| Severity | Condition | Message Pattern |
|----------|-----------|----------------|
| warning (default) | Unverifiable claim | `Unverifiable claim: "..." at line N` |
| error (default) | Mismatched claim | `Claim mismatch: "..." at line N` |
| configurable | Both | Via `unverifiableSeverity`, `mismatchSeverity` options |

## Determinism Guarantees

- All outputs are deterministic for the same inputs.
- Claims are processed in document order (line number).
- Fact matching uses stable iteration over Map insertion order.
- No floating-point non-determinism: tolerance comparison uses `≤`.
