# @isl-lang/evidence

Evidence schema with Zod validation and stable canonical serialization for ISL verification reports.

## Installation

```bash
pnpm add @isl-lang/evidence
```

## Features

- **Zod Validation**: Runtime validation of evidence reports
- **TypeScript Types**: Full type definitions for all evidence structures
- **Canonical Serialization**: Deterministic JSON output for caching and hashing
- **Builder Helpers**: Programmatic report construction

## Usage

### Validating Evidence Reports

```typescript
import { validateEvidenceReport, safeValidateEvidenceReport } from '@isl-lang/evidence';

// Throws on invalid data
const report = validateEvidenceReport(jsonData);

// Returns result object
const result = safeValidateEvidenceReport(jsonData);
if (result.success) {
  console.log(result.data.verdict);
} else {
  console.error(result.error);
}
```

### Serializing Reports

```typescript
import { serialize, deserialize, computeHash } from '@isl-lang/evidence';

// Canonical JSON serialization (deterministic output)
const json = serialize(report);

// Compact serialization
const compact = serialize(report, { pretty: false });

// Compute content hash
const hash = await computeHash(report);
```

### Building Reports Programmatically

```typescript
import { 
  createReport, 
  createClause, 
  createEvidence,
  addClause,
  finalizeReport 
} from '@isl-lang/evidence';

// Create a new report
let report = createReport({
  contractName: 'UserAuthentication',
  contractFile: 'contracts/auth.isl',
  gitCommit: 'abc1234',
});

// Add clauses
const clause = createClause({
  id: 'auth-001',
  name: 'Valid credentials return token',
  status: 'PASS',
  durationMs: 50,
});

// Add evidence to clause
clause.evidence.push(createEvidence({
  type: 'assertion',
  description: 'Response contains valid JWT',
  location: {
    file: 'src/auth/login.ts',
    line: 42,
    snippet: 'return { token: jwt.sign(payload, secret) }',
  },
}));

// Add clause to report (updates summary and verdict)
report = addClause(report, clause);

// Or finalize manually
report = finalizeReport(report);
```

### Comparing Reports

```typescript
import { areEqual, diff, stripTimestamps } from '@isl-lang/evidence';

// Check equality (ignores property order)
const equal = areEqual(report1, report2);

// Get detailed diff
const changes = diff(before, after);
if (changes.verdictChanged) {
  console.log('Verdict changed!');
}

// Strip timestamps for snapshot testing
const stripped = stripTimestamps(report);
```

## Schema Version

The current schema version is `1.0.0`. Reports include a `schemaVersion` field for forward compatibility.

## Types

### Core Types

- `EvidenceReport` - Complete verification report
- `ClauseResult` - Individual clause verification result
- `EvidenceItem` - Supporting evidence for a clause
- `Assumption` - Documented assumption
- `OpenQuestion` - Unresolved question
- `ReproCommand` - Reproduction command

### Enums

- `Verdict`: `'SHIP' | 'NO_SHIP'`
- `ClauseStatus`: `'PASS' | 'PARTIAL' | 'FAIL'`

## API Reference

### Validation

| Function | Description |
|----------|-------------|
| `validateEvidenceReport(data)` | Validate and parse data (throws on error) |
| `safeValidateEvidenceReport(data)` | Validate and parse data (returns result object) |
| `validatePartialReport(data)` | Validate partial report data |

### Serialization

| Function | Description |
|----------|-------------|
| `serialize(report, options?)` | Serialize to canonical JSON |
| `deserialize(json)` | Parse JSON to report |
| `computeHash(report)` | Compute SHA-256 hash |
| `areEqual(a, b)` | Compare reports for equality |
| `diff(before, after)` | Compute differences between reports |
| `stripTimestamps(report)` | Remove timestamps for testing |

### Builder

| Function | Description |
|----------|-------------|
| `createReport(options)` | Create new empty report |
| `createClause(options)` | Create clause result |
| `createEvidence(options)` | Create evidence item |
| `addClause(report, clause)` | Add clause and update summary |
| `addAssumption(report, assumption)` | Add assumption |
| `addOpenQuestion(report, question)` | Add open question |
| `addReproCommand(report, command)` | Add reproduction command |
| `finalizeReport(report)` | Compute summary and verdict |

## License

MIT
