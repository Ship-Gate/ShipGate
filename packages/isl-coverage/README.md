# ISL Coverage Analytics

Coverage analytics engine for ISL specifications. Provides metrics on:
- **Behavior binding coverage**: Which behaviors have implementations bound
- **Runtime verification coverage**: Which specs are exercised in runtime verification
- **Constraint unknown tracking**: Which constraints are always "unknown"

## Installation

```bash
pnpm add @isl-lang/isl-coverage
```

## Usage

### CLI Command

```bash
# Generate coverage report
shipgate coverage

# With custom spec patterns
shipgate coverage --specs "specs/**/*.isl"

# With bindings file
shipgate coverage --bindings .shipgate.bindings.json

# With verification traces
shipgate coverage --traces .verification-traces

# JSON output
shipgate coverage --json

# Detailed breakdown
shipgate coverage --detailed
```

### Programmatic API

```typescript
import { analyzeCoverage } from '@isl-lang/isl-coverage';

const report = await analyzeCoverage({
  specFiles: ['specs/**/*.isl'],
  bindingsFile: '.shipgate.bindings.json',
  verificationTracesDir: '.verification-traces',
  detailed: true,
});

console.log(`Bound behaviors: ${report.summary.boundBehaviors}/${report.summary.totalBehaviors}`);
console.log(`Always-unknown constraints: ${report.summary.alwaysUnknownConstraints}`);
```

## Coverage Metrics

### Behavior Coverage

- **Bound**: Behaviors with implementations discovered via `shipgate bind`
- **Exercised**: Behaviors executed during runtime verification
- **Unbound**: Behaviors without implementations (reported with file/line pointers)

### Constraint Coverage

- **Evaluated**: Constraints that were evaluated during verification
- **Always Unknown**: Constraints that always evaluate to `unknown` (reported with file/line pointers)
- **Results Breakdown**: Counts of `true`, `false`, and `unknown` evaluations

## Integration with Proof Bundles

Coverage reports are automatically included in proof bundles when available:

```typescript
import { ProofBundleWriter } from '@isl-lang/isl-proof';
import { analyzeCoverage } from '@isl-lang/isl-coverage';

const writer = new ProofBundleWriter({ ... });

// Generate coverage report
const coverage = await analyzeCoverage({ ... });

// Add to proof bundle
writer.setCoverage(coverage);
await writer.write();
```

The coverage report is stored in `manifest.json` under the `coverage` field.

## Report Format

### Summary

```json
{
  "summary": {
    "totalDomains": 2,
    "totalBehaviors": 15,
    "boundBehaviors": 12,
    "exercisedBehaviors": 10,
    "totalConstraints": 45,
    "evaluatedConstraints": 38,
    "alwaysUnknownConstraints": 3
  }
}
```

### Unbound Behaviors

```json
{
  "unboundBehaviors": [
    {
      "name": "CreateUser",
      "domain": "auth",
      "file": "specs/auth.isl",
      "line": 42
    }
  ]
}
```

### Unknown Constraints

```json
{
  "unknownConstraints": [
    {
      "expression": "user.email != null",
      "type": "postcondition",
      "behavior": "CreateUser",
      "domain": "auth",
      "file": "specs/auth.isl",
      "line": 45,
      "unknownReasons": ["MISSING_BINDING"],
      "evaluationCount": 5
    }
  ]
}
```

## Acceptance Test

The coverage report highlights:
- ✅ Unbound behaviors with file/line pointers
- ✅ Unknown-heavy constraints with file/line pointers
- ✅ Per-domain breakdown
- ✅ Overall summary statistics

## License

MIT
