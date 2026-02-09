# Unknown Reduction System (Agent 31)

## Overview

The Unknown Reduction System categorizes unknown verification results and provides actionable remediation strategies to reduce the unknown rate.

## Components

### 1. Unknown Classifier (`unknown-classifier.ts`)

Categorizes unknown results into actionable categories:

- **missing_bindings**: Required variables/inputs not available
- **unsupported_smt_fragment**: Expression cannot be encoded for SMT
- **runtime_data_unavailable**: Traces or runtime data missing
- **evaluation_error**: Error during evaluation
- **timeout**: Evaluation timed out
- **smt_unknown**: SMT solver returned unknown

Each classification includes:
- Explanation of why the unknown occurred
- Actionable remediation steps
- Whether the unknown can be mitigated automatically
- Suggested mitigation strategies

### 2. Mitigation Strategies (`unknown-mitigations.ts`)

Implements best-effort strategies to resolve unknowns:

- **runtime_sampling**: Extract partial data from available traces
- **fallback_check**: Try simpler versions of expressions
- **constraint_slicing**: Break complex expressions into parts
- **smt_retry**: Retry SMT with different solver/timeout
- **add_bindings**: Suggest adding explicit bindings (manual)

### 3. Formatter (`unknown-formatter.ts`)

Formats unknown results for CLI output with:
- Category summaries
- Remediation steps
- Mitigation suggestions
- Detailed breakdowns

## Usage

### In Verification Pipeline

The classifier is automatically integrated into `runVerification()`:

```typescript
import { runVerification } from '@isl-lang/verify-pipeline';

const result = await runVerification({
  specPath: './login.isl',
  traceDir: './traces',
});

// Unknown reasons are automatically classified
for (const reason of result.unknownReasons) {
  console.log(`Category: ${reason.category}`);
  console.log(`Message: ${reason.message}`);
  if (reason.remediation) {
    console.log('To Fix:');
    reason.remediation.forEach(step => console.log(`  • ${step}`));
  }
  if (reason.mitigatable) {
    console.log(`Can be mitigated: Yes`);
    console.log(`Strategies: ${reason.suggestedMitigations?.join(', ')}`);
  }
}
```

### Manual Classification

```typescript
import { classifyUnknown, classifyAllUnknowns } from '@isl-lang/verify-pipeline';

// Classify a single unknown clause
const classification = classifyUnknown(clauseResult, {
  hasTraces: true,
  traceCount: 5,
  smtAttempted: false,
});

console.log(classification.category); // e.g., 'missing_bindings'
console.log(classification.remediation); // ['Add binding for...', ...]

// Classify all unknowns
const classifications = classifyAllUnknowns(clauseResults, {
  hasTraces: true,
  traceCount: 10,
});
```

### Formatting for CLI

```typescript
import { formatUnknownSummary } from '@isl-lang/verify-pipeline';

const output = formatUnknownSummary(result, {
  colors: true,
  detailed: true,
});
console.log(output);
```

## Example Output

```
? Unknown Clauses
────────────────────────────────────────────────────────────────────────────────
Total: 3 unknown clause(s)

By Category:
  Missing Bindings: 2
  Runtime Data Unavailable: 1

2 unknown(s) can potentially be resolved with mitigation strategies

Missing Bindings
────────────────────────────────────────────────────────────────────────────────
  Clause: Login_post_success_1
  Reason: Missing binding for variable 'session_id'
  To Fix:
    • Add binding for 'session_id' in test cases or trace data
    • Ensure 'session_id' is provided as input to the behavior
  Suggested Mitigations: add_bindings, runtime_sampling
```

## Integration Points

1. **Verification Pipeline**: Automatically classifies unknowns after SMT resolution
2. **CLI Output**: Formats unknown reasons with remediation in `isl verify`
3. **Proof Bundles**: Unknown reasons are included with remediation steps

## Acceptance Criteria

✅ Unknown results are categorized into actionable categories
✅ Each category includes remediation steps
✅ Mitigation strategies are suggested for mitigatable unknowns
✅ CLI output shows categorized unknowns with fixes
✅ Unknown rate can be reduced by following remediation steps

## Future Enhancements

- Automatic mitigation execution (currently suggestions only)
- Learning from resolved unknowns to improve classification
- Integration with healer to auto-fix missing bindings
- Constraint slicing implementation with AST manipulation
- Runtime sampling with actual re-evaluation
