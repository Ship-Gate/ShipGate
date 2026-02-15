# @isl-lang/claims-verifier

**Claims Verification Agent** — Prevents generated copy from inventing numbers or claims.

## Problem

AI-generated documentation and landing pages often include invented metrics like:
- "94% trust score" (not based on actual data)
- "10x faster" (no benchmark)
- "100+ integrations" (not verified)

These unverifiable claims damage credibility and can lead to legal issues.

## Solution

This package provides:

1. **Claim Model** — Structured representation of numeric claims with source and verification method
2. **Linter** — Scans docs/landing content for unverifiable claims
3. **Auto-Softener** — Rewrites unverifiable claims with hedging language
4. **Known Facts Registry** — Verified metrics that claims can be checked against

## Installation

```bash
pnpm add @isl-lang/claims-verifier
```

## Usage

### CLI

```bash
# Lint documentation for unverifiable claims
npx claims-verifier docs/**/*.md README.md

# Auto-fix (soften) unverifiable claims
npx claims-verifier --fix

# Use custom known facts
npx claims-verifier --facts known-facts.json

# Output as SARIF for CI integration
npx claims-verifier --format sarif > claims.sarif
```

### Programmatic API

```typescript
import { 
  ClaimsLinter, 
  ClaimVerifier, 
  AutoSoftener,
  type KnownFact 
} from '@isl-lang/claims-verifier';

// Define known facts (verifiable metrics)
const knownFacts: KnownFact[] = [
  {
    id: 'builtin-rules',
    description: 'Number of built-in rules',
    value: 25,
    unit: 'rules',
    source: {
      type: 'repo_metadata',
      filePath: 'docs/PRICING.md',
      description: 'Pricing documentation',
    },
  },
];

// Create linter
const linter = new ClaimsLinter({ knownFacts });

// Lint content
const result = linter.lint(content, 'Landing.tsx');

// Check for issues
if (result.issues.length > 0) {
  console.log('Found unverifiable claims:');
  
  for (const issue of result.issues) {
    console.log(`  Line ${issue.claim.location.line}: ${issue.message}`);
    if (issue.suggestion) {
      console.log(`  Suggestion: ${issue.suggestion}`);
    }
  }
  
  // Auto-soften if desired
  const softener = new AutoSoftener();
  const softened = softener.soften(content, result);
  console.log(softened.softened);
}
```

## Claim Model

Every claim has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `text` | string | The claim text (e.g., "94%") |
| `value` | string \| number | The numeric value |
| `unit` | string? | Unit (e.g., "%", "rules") |
| `location` | ClaimLocation | File, line, column |
| `source` | ClaimSource? | Where the value comes from |
| `verificationMethod` | VerificationMethod | How to verify |
| `status` | VerificationStatus | verified, unverifiable, mismatch |
| `confidence` | number | 0-1 confidence score |

### Claim Sources

Claims must be derived from one of:

1. **Command Output** — `npx shipgate rules list`
2. **Repo Metadata** — package.json, file counts
3. **User Provided** — Explicit facts with attribution
4. **Computed** — Derived from other verified claims

## Patterns Detected

The linter detects:

- Percentages: `94%`, `up to 95%`
- Counts: `25 rules`, `100+ features`
- Times: `5 minutes`, `under 100ms`
- Multipliers: `3x faster`, `10x improvement`
- Money: `$29/user`, `costs $100`
- Trust scores: `Trust Score: 94%`
- Averages: `average of 94%`

## Auto-Softening

When a claim is unverifiable, the softener transforms it:

| Original | Softened |
|----------|----------|
| `94%` | `approximately 94%` |
| `Trust Score 94%` | `Trust scores can reach 94%` |
| `25 rules` | `over 20 rules` |
| `10x faster` | `up to 10x faster` |

Styles available: `conservative`, `moderate`, `aggressive`

## CI Integration

### GitHub Actions

```yaml
- name: Verify Claims
  run: npx claims-verifier --strict --format sarif > claims.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: claims.sarif
```

### Exit Codes

- `0` — No errors
- `1` — Errors found (or warnings with `--strict`)

## Example: Fixing Landing.tsx

Before:
```tsx
<div className="text-6xl font-bold">
  94%
</div>
<p>Across all verified contracts</p>
```

After linting:
```
Landing.tsx:
  ⚠️ Line 3: Unverifiable claim: "94%". No known fact matches.
     💡 Consider softening to: "typically around 94%"
```

After `--fix`:
```tsx
<div className="text-6xl font-bold">
  typically around 94%
</div>
<p>Across all verified contracts</p>
```

## Known Facts File

Create `known-facts.json`:

```json
[
  {
    "id": "builtin-rules",
    "description": "Built-in rules in ISL Studio",
    "value": 25,
    "unit": "rules",
    "source": {
      "type": "command_output",
      "command": "npx shipgate rules list --count"
    }
  },
  {
    "id": "team-price",
    "description": "Team tier monthly price",
    "value": 29,
    "unit": "dollars",
    "source": {
      "type": "repo_metadata",
      "filePath": "docs/PRICING.md",
      "description": "Official pricing"
    }
  }
]
```

## Tests

```bash
pnpm test
```

Key test scenarios:

1. **REFUSES invented percentage claims** — Flags `94%` without backing data
2. **REFUSES invented count claims** — Flags `100 integrations` without verification
3. **REFUSES invented performance claims** — Flags `10x faster` without benchmarks
4. **ACCEPTS verified claims** — Passes `25 rules` when backed by known fact

## Philosophy

From `docs/release/claims-and-nonclaims.md`:

> Any numeric claim must be derived from:
> - Command output (rules list)
> - Repo metadata
> - Explicitly provided user facts

The goal is **honest marketing**:
- ✅ "25 built-in rules" (verifiable)
- ❌ "94% average trust score" (invented)
- ✅ "Trust scores can reach 94%" (hedged)

## License

MIT
