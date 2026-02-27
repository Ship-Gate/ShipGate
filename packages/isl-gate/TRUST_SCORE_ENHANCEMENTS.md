# Trust Score System Enhancements

## Overview

Enhanced the trust score system to be more meaningful and persistent across runs with evidence-based scoring, time decay, and project fingerprinting.

## Features Implemented

### 1. Evidence-Based Scoring (SMT > Runtime > Heuristics)

**Priority System:**
- **SMT (Formal Verification)**: Priority 3 (highest trust)
- **Runtime (Testing/Verification)**: Priority 2 (medium trust)
- **Heuristic (Static Analysis)**: Priority 1 (lowest trust, default)

**Implementation:**
- Added `EvidenceSource` type and `EVIDENCE_PRIORITY` constants
- Enhanced `TrustClauseResult` with `evidenceSource` and `evidenceTimestamp` fields
- Updated `scoreSingleCategory()` to apply priority multipliers when `enableEvidencePriority` is enabled (default: true)

**Usage:**
```typescript
const clause: TrustClauseResult = {
  id: 'pre-1',
  category: 'preconditions',
  description: 'Input validation',
  status: 'pass',
  evidenceSource: 'smt',  // Formal verification
  evidenceTimestamp: new Date().toISOString(),
};
```

### 2. Time-Based Decay

**Decay Model:**
- Exponential decay with configurable half-life (default: 90 days)
- Formula: `multiplier = 2^(-ageDays / halfLifeDays)`
- Older evidence contributes less to the score

**Configuration:**
- `evidenceDecayHalfLifeDays`: Half-life in days (default: 90)
- Set to `0` to disable decay

**Implementation:**
- Decay multiplier applied per clause based on `evidenceTimestamp`
- Integrated into weighted scoring calculation

### 3. Project Fingerprinting

**Purpose:**
- Ensures per-project history isolation
- Prevents cross-project contamination
- Enables stable project identity across runs

**Fingerprint Components:**
- Project root path (normalized)
- Package.json name/version
- ISL config file modification time
- ShipGate config modification time
- Git root (if available)

**Implementation:**
- `generateProjectFingerprint(projectRoot)`: Generates deterministic fingerprint
- `computeProjectFingerprint(projectRoot?, provided?)`: Computes or uses provided fingerprint
- History filtering by project fingerprint
- Per-project history storage

### 4. Enhanced Storage

**History Format:**
- JSON-based storage (`.isl-gate/trust-history.json`)
- Per-project filtering
- Evidence breakdown tracking
- Project fingerprint in each entry

**Features:**
- Automatic project fingerprint detection
- History filtering by fingerprint
- Max entries limit (default: 50)
- Delta computation between runs

### 5. CLI Explain Command

**New Command:**
```bash
isl trust-score explain <spec> --impl <file> [options]
```

**Features:**
- Detailed breakdown by evidence type (SMT, runtime, heuristic)
- Category breakdown with scores and weights
- History analysis with deltas
- Last N runs display (default: 10)

**Options:**
- `--history <count>`: Number of history entries to show
- `--json`: JSON output format
- `--project-root <path>`: Project root for fingerprinting
- `--weights <weights>`: Custom category weights
- `--unknown-penalty <penalty>`: Unknown category penalty (0.0-1.0)

**Example Output:**
```
  Trust Score Explanation
  ======================================================================

  Current Score: 85/100 (SHIP)

  Evidence Breakdown by Source:
  ----------------------------------------------------------------------
    SMT (Formal):      12 clauses (highest trust)
    Runtime (Tests):   8 clauses (medium trust)
    Heuristic:         5 clauses (lowest trust)

  Category Breakdown:
  ----------------------------------------------------------------------
  Category         Score    Weight   Pass   Fail   Unknown
  ----------------------------------------------------------------------
  preconditions    90       20%      5      0      0
  postconditions   85       20%      4      1      0
  ...

  History (Last 10 Runs):
  ----------------------------------------------------------------------
  #    Score    Verdict   Delta    Timestamp
  ----------------------------------------------------------------------
  1    85       SHIP      +5       2026-02-09T10:30:00
  2    80       SHIP      -2       2026-02-09T09:15:00
  ...
```

## Configuration

### Trust Score Config

```typescript
interface TrustScoreConfig {
  // Evidence priority (default: true)
  enableEvidencePriority?: boolean;
  
  // Time decay half-life in days (default: 90, 0 = disabled)
  evidenceDecayHalfLifeDays?: number;
  
  // ... other existing options
}
```

## API Changes

### Types

**New Types:**
- `EvidenceSource`: `'smt' | 'runtime' | 'heuristic'`
- `EVIDENCE_PRIORITY`: Priority constants

**Enhanced Types:**
- `TrustClauseResult`: Added `evidenceSource?` and `evidenceTimestamp?`
- `TrustScoreInput.metadata`: Added `projectRoot?` and `projectFingerprint?`
- `TrustHistoryEntry`: Added `projectFingerprint?` and `evidenceBreakdown?`
- `TrustHistory`: Added `projectFingerprint?`
- `ResolvedTrustConfig`: Added `enableEvidencePriority` and `evidenceDecayHalfLifeDays`

### Functions

**New Functions:**
- `generateProjectFingerprint(projectRoot: string): string`
- `computeProjectFingerprint(projectRoot?, provided?): string | undefined`
- `trustScoreExplain(specPath, options): Promise<TrustScoreExplainResult>`
- `printTrustScoreExplain(result, options): void`

**Enhanced Functions:**
- `loadHistory(historyPath, projectFingerprint?)`: Now filters by fingerprint
- `recordEntry(history, result, config, commitHash?, projectFingerprint?)`: Stores fingerprint
- `evaluateTrust(input, options)`: Computes and uses project fingerprint

## Testing

**Test Coverage:**
- Evidence priority weighting
- Time decay calculation
- Project fingerprinting determinism
- History persistence and filtering
- Determinism across runs
- Edge cases (future timestamps, missing data)

**Test File:**
- `packages/isl-gate/tests/trust-score.test.ts`

## Migration Notes

**Backward Compatibility:**
- All new features are opt-in via configuration
- Default behavior matches previous implementation when options not specified
- Existing history files continue to work (fingerprint optional)

**Breaking Changes:**
- None (all enhancements are additive)

## Usage Examples

### Basic Usage

```typescript
import { evaluateTrust } from '@isl-lang/gate/trust-score';

const result = await evaluateTrust({
  clauses: [
    {
      id: 'pre-1',
      category: 'preconditions',
      description: 'Input validation',
      status: 'pass',
      evidenceSource: 'smt',
      evidenceTimestamp: new Date().toISOString(),
    },
  ],
  metadata: {
    projectRoot: process.cwd(),
  },
}, {
  enableEvidencePriority: true,
  evidenceDecayHalfLifeDays: 90,
});
```

### CLI Usage

```bash
# Explain current score
isl trust-score explain spec.isl --impl src/impl.ts

# Show history with deltas
isl trust-score explain spec.isl --impl src/impl.ts --history 20

# JSON output
isl trust-score explain spec.isl --impl src/impl.ts --json

# Custom project root
isl trust-score explain spec.isl --impl src/impl.ts --project-root /path/to/project
```

## Future Enhancements

Potential future improvements:
1. Evidence source inference from verification results
2. Configurable decay curves (linear, exponential, step)
3. Cross-project comparison tools
4. Evidence quality scoring
5. Historical trend analysis and predictions
