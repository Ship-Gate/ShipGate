# Auto-Verify Module

File watcher helper that triggers verification after code generation completes.

## Overview

The auto-verify module monitors a workspace for a "generation complete" marker file (e.g., `.shipgate/.gen-complete`). When detected, it automatically:

1. Finds ISL specification files
2. Runs verification against implementations
3. Computes trust scores
4. Writes evidence reports

## Usage

```typescript
import { watchAndVerify } from '@isl-lang/core/auto-verify';

// Start watching
const handle = watchAndVerify({
  workspacePath: '/path/to/project',
  specPath: 'specs',           // Where ISL specs live
  markerFile: '.shipgate/.gen-complete',
  debounceMs: 500,
  verbose: true,
}, (event) => {
  switch (event.type) {
    case 'started':
      console.log('Watcher started');
      break;
    case 'generation-complete':
      console.log('Generation detected:', event.timestamp);
      break;
    case 'verification-complete':
      console.log(`Score: ${event.result.score}/100`);
      console.log(`Recommendation: ${event.result.scoreSummary.recommendation}`);
      break;
    case 'evidence-written':
      console.log(`Evidence at: ${event.path}`);
      break;
    case 'error':
      console.error(`Error in ${event.phase}:`, event.error);
      break;
  }
});

// Check status
console.log(handle.getStatus());
// { running: true, phase: 'watching', runCount: 0, ... }

// Manually trigger verification
const result = await handle.triggerVerify();
console.log(result.score);

// Stop watching
await handle.stop();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workspacePath` | `string` | **required** | Root path of the workspace to watch |
| `markerFile` | `string` | `.shipgate/.gen-complete` | Path to generation complete marker file |
| `debounceMs` | `number` | `500` | Debounce interval in milliseconds |
| `watchPatterns` | `string[]` | `['**/*.ts', ...]` | Glob patterns for files to watch |
| `ignorePatterns` | `string[]` | `['**/node_modules/**', ...]` | Glob patterns to ignore |
| `evidencePath` | `string` | `.shipgate/evidence` | Where to write evidence reports |
| `specPath` | `string` | `specs` | Path to ISL specification files |
| `verbose` | `boolean` | `false` | Enable verbose logging |

## Marker File Format

The marker file can be either:

1. **Simple timestamp** - Just a timestamp string:
   ```
   2024-01-15T10:30:00.000Z
   ```

2. **JSON object** - With additional metadata:
   ```json
   {
     "timestamp": "2024-01-15T10:30:00.000Z",
     "version": "1.0.0",
     "generator": "isl-codegen",
     "generatedFiles": [
       "src/auth.impl.ts",
       "src/auth.types.ts"
     ]
   }
   ```

## Events

The watcher emits events during its lifecycle:

| Event | Data | Description |
|-------|------|-------------|
| `started` | `{ config }` | Watcher has started |
| `generation-complete` | `{ timestamp }` | Marker file detected |
| `verification-started` | `{ specPath }` | Starting to verify a spec |
| `verification-complete` | `{ result }` | Verification finished |
| `evidence-written` | `{ path }` | Evidence file written |
| `error` | `{ error, phase }` | Error occurred |
| `stopped` | - | Watcher has stopped |

## Evidence Output

Evidence reports are written in JSON or YAML format to the configured `evidencePath`:

```
.shipgate/evidence/
  ├── auth-1705312200123.evidence.json
  └── auth-1705312200123.summary.md
```

### Evidence Report Structure

```typescript
interface EvidenceReport {
  version: '1.0';
  reportId: string;
  specFingerprint: string;
  specName: string;
  specPath: string;
  clauseResults: EvidenceClauseResult[];
  scoreSummary: ScoreSummary;
  assumptions: Assumption[];
  openQuestions: OpenQuestion[];
  artifacts: EvidenceArtifact[];
  metadata: VerificationMetadata;
}
```

### Summary Markdown

A human-readable summary is optionally generated:

```markdown
# Verification Summary: auth

✅ **Recommendation:** SHIP

## Score: 92/100

| Status | Count |
|--------|-------|
| Passed | 10 |
| Partial | 2 |
| Failed | 0 |
| **Total** | **12** |

## Key Findings

- All critical checks passed - ready to ship
- 2 clause(s) partially passed
```

## Integration with CI/CD

To trigger verification in a CI pipeline:

```bash
# Generate code
pnpm isl gen specs/auth.isl

# Create marker file to trigger verification
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .shipgate/.gen-complete

# The watcher will automatically pick up the change
```

Or manually trigger:

```typescript
const handle = watchAndVerify({ workspacePath: '.' });
const result = await handle.triggerVerify();

if (result.scoreSummary.recommendation === 'block') {
  process.exit(1);
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     watchAndVerify()                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌───────────┐     ┌──────────────┐     ┌──────────────┐  │
│   │ FSWatcher │────▶│   Debounce   │────▶│ Verification │  │
│   └───────────┘     └──────────────┘     └──────────────┘  │
│         │                                       │           │
│         ▼                                       ▼           │
│   ┌───────────┐                          ┌──────────────┐  │
│   │  Marker   │                          │   Scoring    │  │
│   │Detection  │                          │   Engine     │  │
│   └───────────┘                          └──────────────┘  │
│                                                 │           │
│                                                 ▼           │
│                                          ┌──────────────┐  │
│                                          │   Evidence   │  │
│                                          │   Writer     │  │
│                                          └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Types

See `watchTypes.ts` for complete type definitions:

- `WatchConfig` - Configuration options
- `WatchEvent` - Event types
- `WatchHandle` - Control handle
- `VerificationResult` - Verification output
- `EvidenceReport` - Full evidence structure
