# @isl-lang/verify-pipeline

A complete verification orchestrator for ISL (Intent Specification Language) that runs generated tests, captures execution traces, evaluates postconditions and invariants with tri-state logic, and produces cryptographic proof bundles.

## Features

- **Multi-stage verification pipeline** - Orchestrates test running, trace collection, postcondition evaluation, invariant checking, and optional SMT verification
- **Tri-state evaluation** - Handles `true`, `false`, and `unknown` states for robust verification
- **Three verdicts**: `PROVEN` | `INCOMPLETE_PROOF` | `FAILED`
- **Deterministic CI output** - Machine-readable JSON for GitHub Actions and CI systems
- **Proof bundle integration** - Generates evaluation tables for cryptographic proof bundles
- **Multiple test frameworks** - Supports Vitest, Jest, Mocha, and Node.js test runner

## Installation

```bash
pnpm add @isl-lang/verify-pipeline
```

## Quick Start

### Using `runVerification` (Recommended for `isl verify`)

```typescript
import { runVerification } from '@isl-lang/verify-pipeline';

const result = await runVerification({
  specPath: './auth/login.isl',
  traceDir: './.verify-pipeline/traces',
});

console.log(result.verdict);       // 'PROVEN' | 'FAILED' | 'INCOMPLETE_PROOF'
console.log(result.clauseResults); // Per-clause evaluation results
console.log(result.unknownReasons); // Why certain clauses couldn't be proven
console.log(result.evidenceRefs);  // References to supporting evidence
console.log(result.exitCode);      // 0=success, 1=failure, 2=incomplete
```

### Using the full pipeline

```typescript
import { verify } from '@isl-lang/verify-pipeline';

const result = await verify({
  spec: './auth/login.isl',
  tests: {
    pattern: '**/*.test.ts',
    framework: 'vitest',
    timeout: 60000,
  },
  traces: {
    enabled: true,
    redactPii: true,
  },
  ci: {
    enabled: true,
    outputPath: './verify-results.json',
  },
});

console.log(result.verdict); // 'PROVEN' | 'INCOMPLETE_PROOF' | 'FAILED'
console.log(result.score);   // 0-100
```

## Pipeline Stages

The verification pipeline executes the following stages in order:

| Stage | Description | Failure Mode |
|-------|-------------|--------------|
| `setup` | Load and parse ISL spec | `spec_error` |
| `test_runner` | Execute generated tests | `test_failure` |
| `trace_collector` | Collect execution traces | `trace_error` |
| `postcondition_evaluator` | Evaluate postconditions (tri-state) | `evaluation_error`, `postcondition_violation` |
| `invariant_checker` | Check invariants (tri-state) | `evaluation_error`, `invariant_violation` |
| `smt_checker` | Optional SMT verification | `smt_timeout`, `smt_unknown` |
| `proof_bundle` | Generate proof bundle | `internal_error` |

## Verdicts

| Verdict | Exit Code | Meaning |
|---------|-----------|---------|
| `PROVEN` | 0 | All postconditions and invariants verified |
| `INCOMPLETE_PROOF` | 2 | Some conditions couldn't be evaluated (missing traces, etc.) |
| `FAILED` | 1 | At least one condition violated |

## Tri-State Logic

The pipeline uses tri-state evaluation for robustness:

```typescript
type TriState = true | false | 'unknown';
```

- **true**: Condition verified successfully
- **false**: Condition violated (counter-evidence found)
- **unknown**: Cannot be evaluated (missing data, evaluation error)

This fail-closed approach ensures that missing data doesn't result in false positives:

```typescript
// Example postcondition evaluation
{
  clauseId: 'Login_post_success_1',
  expression: 'Session.exists(result.id)',
  status: 'proven',
  triStateResult: true,
}

{
  clauseId: 'Login_post_success_2',
  expression: 'User.last_login == now()',
  status: 'not_proven',
  triStateResult: 'unknown',
  reason: 'now() could not be evaluated deterministically',
}
```

## Configuration

```typescript
interface PipelineConfig {
  // ISL spec content or path
  spec: string | { path: string; content: string };
  
  // Test configuration
  tests: {
    pattern?: string;           // Test file pattern
    framework?: TestFramework;  // 'vitest' | 'jest' | 'mocha' | 'node:test'
    timeout?: number;           // Test timeout in ms
    coverage?: boolean;         // Collect coverage
  };
  
  // Trace collection
  traces: {
    enabled?: boolean;          // Enable trace collection
    maxEvents?: number;         // Max events per trace
    redactPii?: boolean;        // Redact PII from traces
  };
  
  // SMT checker (optional)
  smt?: {
    enabled?: boolean;          // Enable SMT checking
    solver?: 'z3' | 'cvc5';     // Solver to use
    timeout?: number;           // Timeout per check
  };
  
  // Proof bundle
  proofBundle?: {
    outputDir?: string;         // Output directory
    sign?: { secret: string };  // Sign the bundle
    includeFullTraces?: boolean;
  };
  
  // CI configuration
  ci?: {
    enabled?: boolean;          // Enable CI mode
    outputPath?: string;        // Output file path
    failOnIncomplete?: boolean; // Fail on incomplete proof
  };
}
```

## Verification Result Schema

The `runVerification` function produces a `VerificationResult` with:

```typescript
interface VerificationResult {
  schemaVersion: '1.0.0';
  runId: string;
  timestamp: string;
  domain: string;
  version: string;
  
  // Overall verdict
  verdict: 'PROVEN' | 'FAILED' | 'INCOMPLETE_PROOF';
  verdictReason: string;
  score: number;  // 0-100
  
  // Per-clause evaluation
  clauseResults: ClauseResult[];
  unknownReasons: UnknownReason[];
  evidenceRefs: EvidenceRef[];
  
  // Summary
  summary: {
    totalClauses: number;
    proven: number;
    violated: number;
    unknown: number;
    skipped: number;
  };
  
  // Timing
  timing: {
    totalMs: number;
    parseMs?: number;
    traceCollectorMs?: number;
    evaluatorMs?: number;
  };
  
  exitCode: 0 | 1 | 2;
}

interface ClauseResult {
  clauseId: string;
  type: 'postcondition' | 'invariant' | 'precondition';
  behavior?: string;
  outcome?: string;
  expression: string;
  status: 'proven' | 'violated' | 'not_proven' | 'skipped';
  triStateResult: true | false | 'unknown';
  reason?: string;
  sourceLocation?: { file?: string; line: number; column: number };
}

interface UnknownReason {
  clauseId: string;
  category: 'missing_trace' | 'missing_data' | 'evaluation_error' | 
            'unsupported_expr' | 'timeout' | 'smt_unknown';
  message: string;
  details?: Record<string, unknown>;
}

interface EvidenceRef {
  clauseId: string;
  type: 'trace' | 'test' | 'smt_proof' | 'runtime_check';
  ref: string;
  summary: string;
  location?: { traceId?: string; eventIndex?: number };
}
```

Example output:

```json
{
  "schemaVersion": "1.0.0",
  "runId": "verify-abc123-def456",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "domain": "Auth.Login",
  "version": "1.0.0",
  "verdict": "INCOMPLETE_PROOF",
  "verdictReason": "2 clause(s) could not be proven",
  "score": 75,
  "clauseResults": [
    {
      "clauseId": "Login_post_success_130",
      "type": "postcondition",
      "behavior": "Login",
      "outcome": "success",
      "expression": "Session.exists(result.session.id)",
      "status": "proven",
      "triStateResult": true
    },
    {
      "clauseId": "Login_post_success_141",
      "type": "postcondition",
      "behavior": "Login",
      "outcome": "success",
      "expression": "result.session.expires_at == now() + 30d",
      "status": "not_proven",
      "triStateResult": "unknown",
      "reason": "No traces matched outcome: success"
    }
  ],
  "unknownReasons": [
    {
      "clauseId": "Login_post_success_141",
      "category": "missing_trace",
      "message": "No traces matched outcome: success"
    }
  ],
  "evidenceRefs": [
    {
      "clauseId": "Login_post_success_130",
      "type": "trace",
      "ref": "trace-login-success-001",
      "summary": "Evaluated against trace Successful login with valid credentials"
    }
  ],
  "summary": {
    "totalClauses": 8,
    "proven": 6,
    "violated": 0,
    "unknown": 2,
    "skipped": 0
  },
  "timing": {
    "totalMs": 245,
    "parseMs": 12,
    "traceCollectorMs": 3,
    "evaluatorMs": 15
  },
  "exitCode": 2
}
```

## CI Output Format

The pipeline produces deterministic JSON output for CI systems:

```json
{
  "schemaVersion": "1.0.0",
  "runId": "verify-abc123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "verdict": "PROVEN",
  "exitCode": 0,
  "summary": "✓ PROVEN: All 5 postconditions and 2 invariants verified. Score: 100/100",
  "score": 100,
  "counts": {
    "tests": { "total": 10, "passed": 10, "failed": 0, "skipped": 0 },
    "postconditions": { "total": 5, "proven": 5, "violated": 0, "notProven": 0 },
    "invariants": { "total": 2, "proven": 2, "violated": 0, "notProven": 0 }
  },
  "violations": [],
  "timing": {
    "totalMs": 2345,
    "stages": {
      "testRunner": 1500,
      "postconditionEvaluator": 200,
      "invariantChecker": 100
    }
  }
}
```

## Evaluation Table

The pipeline generates evaluation tables for proof bundles:

```typescript
import { generateEvaluationTable, formatTableAsMarkdown } from '@isl-lang/verify-pipeline';

const table = generateEvaluationTable(result, 'AuthLogin', '1.0.0');
console.log(formatTableAsMarkdown(table));
```

Output:

```markdown
# Evaluation Table: AuthLogin

| Status | Count |
|--------|-------|
| Total | 7 |
| Proven | 6 |
| Not Proven | 1 |

## Postconditions

| Behavior | Outcome | Expression | Status | Result |
|----------|---------|------------|--------|--------|
| Login | success | `Session.exists(result.id)` | ✓ proven | ✓ true |
| Login | success | `User.last_login == now()` | ? not_proven | ? unknown |
```

## Proof Bundle Integration

Write verification results to a proof bundle:

```typescript
import { writeToProofBundle, updateManifest } from '@isl-lang/verify-pipeline';

await writeToProofBundle(result, {
  bundleDir: './proof-bundle',
  domain: 'AuthLogin',
  specVersion: '1.0.0',
  specContent: islSpec,
  includeFullTraces: true,
});

await updateManifest('./proof-bundle', result);
```

Bundle structure:

```
proof-bundle/
├── manifest.json           # Updated with verification results
├── results/
│   ├── evaluation-table.json
│   ├── verification.json
│   └── pipeline-summary.json
├── reports/
│   └── evaluation-table.html
└── traces/
    ├── index.json
    └── {trace-id}.json
```

## GitHub Actions

```yaml
- name: Run ISL Verification
  run: |
    npx isl verify --spec ./auth/login.isl --ci --output verify-results.json
    
- name: Upload Verification Results
  uses: actions/upload-artifact@v4
  with:
    name: verification-results
    path: verify-results.json
    
- name: Check Verification Status
  run: |
    VERDICT=$(jq -r '.verdict' verify-results.json)
    if [ "$VERDICT" != "PROVEN" ]; then
      echo "::error::Verification failed: $VERDICT"
      exit 1
    fi
```

## Hooks

Subscribe to pipeline events:

```typescript
const result = await verify(config, {
  beforeStage: async (stage) => {
    console.log(`Starting ${stage}...`);
  },
  afterStage: async (stage, result) => {
    console.log(`${stage}: ${result.status} (${result.durationMs}ms)`);
  },
  onClauseEvaluated: async (evidence) => {
    if (evidence.status === 'violated') {
      console.error(`Violation: ${evidence.expression}`);
    }
  },
});
```

## Error Handling

The pipeline classifies errors by category:

| Category | Description | Recoverable |
|----------|-------------|-------------|
| `config_error` | Invalid configuration | No |
| `spec_error` | ISL spec parsing/validation error | No |
| `test_failure` | Test execution failed | No |
| `trace_error` | Trace collection/parsing error | No |
| `evaluation_error` | Expression evaluation error | No |
| `invariant_violation` | Invariant check failed | No |
| `postcondition_violation` | Postcondition check failed | No |
| `smt_timeout` | SMT solver timed out | Yes |
| `smt_unknown` | SMT solver returned unknown | Yes |
| `internal_error` | Unexpected internal error | No |
| `timeout` | Pipeline stage timeout | Yes |

## API Reference

### Main Functions

- `runVerification(config)` - Run verification producing `VerificationResult` (recommended for `isl verify`)
- `verify(config, hooks?)` - Run the complete verification pipeline with stages
- `createDefaultConfig(spec)` - Create a default configuration

### Stage Functions

- `runTests(config)` - Execute tests
- `collectTraces(config)` - Collect execution traces
- `evaluatePostconditions(config)` - Evaluate postconditions
- `checkInvariants(config)` - Check invariants
- `checkWithSMT(config)` - Run SMT verification

### Output Functions

- `generateCIOutput(result)` - Generate CI-friendly output
- `formatCIOutput(output)` - Format as JSON
- `formatGitHubOutput(output)` - Format for GitHub Actions
- `formatHumanOutput(output)` - Format for humans
- `generateEvaluationTable(result, domain, version)` - Generate evaluation table
- `writeToProofBundle(result, config)` - Write to proof bundle

## License

MIT
