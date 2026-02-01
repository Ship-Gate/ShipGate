# ISL Pipeline

The ISL Pipeline module orchestrates the full ISL verification flow in a single function, producing a standardized evidence report.

## Overview

The pipeline runs the following steps:

1. **Context Extraction** - Analyzes the workspace to understand the technology stack
2. **Translation** - Converts natural language prompts to ISL AST (or validates provided AST)
3. **Validation** - Validates the AST structure for correctness
4. **Generation** - Generates verification artifacts (tests, types)
5. **Verification** - Runs verification checks against the codebase
6. **Scoring** - Computes the final score and generates the evidence report

## Usage

### Basic Usage with Pre-parsed AST

```typescript
import { runPipeline } from '@isl-lang/core/pipeline';
import type { Domain } from '@isl-lang/parser';

// Your pre-parsed ISL AST
const ast: Domain = {
  kind: 'Domain',
  name: { kind: 'Identifier', value: 'MyService', location: {...} },
  // ... rest of AST
};

const result = await runPipeline(
  { mode: 'ast', ast },
  { workspacePath: '/path/to/project' }
);

console.log(`Score: ${result.report.scoreSummary.overallScore}`);
console.log(`Recommendation: ${result.report.scoreSummary.recommendation}`);
```

### Convenience Function

```typescript
import { runPipelineWithAst } from '@isl-lang/core/pipeline';

const result = await runPipelineWithAst(ast, {
  workspacePath: '/path/to/project',
});
```

### With Custom Options

```typescript
const result = await runPipeline(
  { mode: 'ast', ast },
  {
    workspacePath: '/path/to/project',
    outDir: 'custom/reports',     // Custom output directory
    writeReport: true,             // Write to disk (default: true)
    skipContext: false,            // Skip context extraction
    mode: 'full',                  // 'full' | 'incremental' | 'quick'
    specName: 'UserService',       // Override spec name
    agentVersion: '2.0.0',         // Custom version string
    verbose: true,                 // Enable logging
    dryRun: false,                 // Dry run (no file writes)
  }
);
```

## Pipeline Result

```typescript
interface PipelineResult {
  status: 'success' | 'partial' | 'failed';
  report: EvidenceReport;
  reportPath?: string;        // Path to written report file
  steps: {
    context?: ContextStepResult;
    translate?: TranslateStepResult;
    validate?: ValidateStepResult;
    generate?: GenerateStepResult;
    verify?: VerifyStepResult;
    score?: ScoreStepResult;
  };
  totalDurationMs: number;
  warnings: string[];
  errors: string[];
}
```

## Evidence Report Structure

The pipeline produces an evidence report with the following structure:

```typescript
interface EvidenceReport {
  version: '1.0';
  reportId: string;           // UUID
  specFingerprint: string;    // SHA-256 hash (deterministic)
  specName?: string;
  specPath?: string;
  
  clauseResults: Array<{
    clauseId: string;         // e.g., "CreateUser.pre.1"
    state: 'PASS' | 'PARTIAL' | 'FAIL';
    message?: string;
    clauseType?: 'precondition' | 'postcondition' | 'invariant' | 'effect' | 'constraint';
  }>;
  
  scoreSummary: {
    overallScore: number;     // 0-100
    passCount: number;
    partialCount: number;
    failCount: number;
    totalClauses: number;
    passRate: number;         // Percentage
    confidence: 'low' | 'medium' | 'high';
    recommendation: 'ship' | 'review' | 'block';
  };
  
  assumptions: Assumption[];
  openQuestions: OpenQuestion[];
  artifacts: EvidenceArtifact[];
  
  metadata: {
    startedAt: string;        // ISO timestamp
    completedAt: string;
    durationMs: number;
    agentVersion: string;
    mode?: 'full' | 'incremental' | 'quick';
  };
  
  notes?: string;
}
```

## Report File Naming

Reports are written to `.vibecheck/reports/<fingerprint>.json` by default:

- **Deterministic naming**: Uses first 16 characters of the spec fingerprint
- **No timestamps**: Same AST always produces same filename
- **Custom outDir**: Can be overridden with `outDir` option

Example: `.vibecheck/reports/a1b2c3d4e5f67890.json`

## Running Individual Steps

For advanced usage, individual steps can be run directly:

```typescript
import {
  runContextStep,
  runTranslateStep,
  runValidateStep,
  runGenerateStep,
  runVerifyStep,
  runScoreStep,
} from '@isl-lang/core/pipeline';

// Create initial state
const state: PipelineState = {
  startTime: performance.now(),
  input: { mode: 'ast', ast },
  options: { /* ... */ },
  warnings: [],
  errors: [],
  stepResults: {},
};

// Run individual steps
const contextResult = await runContextStep(state);
state.context = contextResult.data;

const verifyResult = await runVerifyStep(state);
state.clauseResults = verifyResult.data?.clauseResults;
```

## Validation Helpers

```typescript
import { isValidDomainAst } from '@isl-lang/core/pipeline';

// Check if an object is a valid ISL Domain AST
if (isValidDomainAst(myObject)) {
  // TypeScript knows myObject is Domain type
  console.log(myObject.name.value);
}
```

## Scoring Algorithm

The scoring uses a tri-state weighted system:

- **PASS** = 1.0 (full credit)
- **PARTIAL** = 0.4 (partial credit)  
- **FAIL** = 0.0 (no credit)

Ship decision thresholds:
- Score >= 85 AND failCount == 0 → **SHIP**
- Otherwise → **NO_SHIP** (review or block)

## Error Handling

The pipeline is designed to be resilient:

- Individual step failures don't crash the pipeline
- Failed steps are recorded in `result.steps`
- Errors are accumulated in `result.errors`
- A partial report is still generated even on failures

```typescript
const result = await runPipeline(input, options);

if (result.status === 'failed') {
  console.error('Pipeline failed:', result.errors);
  // Still have access to result.report with partial data
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

## Integration Notes

### Prompt Mode (Not Implemented)

Running with `{ mode: 'prompt', prompt: '...' }` requires LLM integration:

```typescript
// This will fail without translator integration
const result = await runPipeline(
  { mode: 'prompt', prompt: 'Create user authentication' },
  { workspacePath: '/path/to/project' }
);
// result.status === 'failed'
// result.errors includes 'Prompt translation not implemented...'
```

For prompt-based workflows, use the full translator module (`@isl-lang/translator`) to first generate an AST, then pass it to the pipeline.

### Context Extraction

Context extraction requires file system access. For testing or CI environments, use:

```typescript
const result = await runPipeline(input, {
  workspacePath: '/path/to/project',
  skipContext: true,  // Use stub context
});
```
