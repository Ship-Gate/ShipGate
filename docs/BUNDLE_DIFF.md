# Proof Bundle Diffing and History

## Overview

ISL Verify's bundle diffing capability allows you to compare verification coverage between releases, track security improvements over time, and detect regressions before production.

**This is the killer enterprise feature: temporal analysis of verification coverage.**

---

## Commands

### Compare Two Bundles

```bash
isl verify diff <bundle1> <bundle2>
```

**Examples:**

```bash
# Compare current to last release
isl verify diff .shipgate/v1.0.0-bundle.json .shipgate/current-bundle.json

# Compare tagged releases
isl verify diff v1.0.0 v1.1.0

# Compare branches
isl verify diff main feature/auth-improvements
```

### View History

```bash
isl verify history [--since DATE] [--format json|table]
```

**Examples:**

```bash
# Show all verification history
isl verify history

# Show history since last quarter
isl verify history --since 2025-Q4

# Export as JSON
isl verify history --format json > verification-history.json
```

---

## Diff Output Example

```bash
$ isl verify diff v1.0.0 v1.1.0

Proof Bundle Diff: v1.0.0 → v1.1.0
=====================================

Verification Surface Changes:
  Languages: typescript → typescript, javascript (+1)
  Frameworks: express → express, fastify (+1)
  Tiers Run: [1] → [1, 2] (added runtime testing)

Properties Verified:
  ✅ Auth Coverage: 42/60 routes → 58/62 routes (+16, +3.2%)
  ✅ Input Validation: 37/60 endpoints → 55/62 endpoints (+18, +5.8%)
  ✅ Error Handling: 12/60 endpoints → 45/62 endpoints (+33, +34.7%)
  NEW: SQL Injection: 0 queries → 5/5 queries (100%)
  NEW: Import Integrity: 47/47 imports verified

Trust Score: 68% → 87% (+19%)
Verdict: NO_SHIP → SHIP

Residual Risks:
  RESOLVED: Secret exposure in config.ts (moved to env vars)
  RESOLVED: Missing auth on payment endpoints (added middleware)
  NEW: Rate limiting not verified (medium severity)

Evidence Added:
  + 23 new test results
  + 15 new static analysis checks
  + 8 runtime verification proofs

Files Changed:
  src/routes/payment.ts: partial → proven (auth now enforced)
  src/routes/admin.ts: partial → proven (validation added)
  src/lib/db.ts: unverified → proven (SQL injection fixed)
  NEW: src/middleware/rate-limit.ts (not yet verified)
```

---

## Enterprise Use Cases

### Use Case 1: Quarterly Security Review

**Scenario:** VP Eng asks "Show me security improvements this quarter"

**Command:**
```bash
isl verify diff 2025-Q4 2026-Q1 --format compliance
```

**Output for Exec Summary:**
- Auth coverage increased from 70% to 94%
- Zero critical residual risks (down from 3)
- Trust score improved from 75 to 91
- All payment endpoints now fully verified

### Use Case 2: Release Gate

**Scenario:** CI blocks deployment if verification regresses

**GitHub Action:**
```yaml
- name: Verify No Regression
  run: |
    isl verify diff ${{ github.base_ref }} HEAD --fail-on-regression
```

**Detects:**
- ❌ Auth coverage decreased
- ❌ New critical residual risks
- ❌ Trust score dropped
- ❌ Previously verified properties now unverified

### Use Case 3: Audit Trail

**Scenario:** SOC 2 auditor asks "How do you track code quality over time?"

**Response:** Show proof bundle history with verification surface evolution

```bash
isl verify history --since 2025-01-01 --format audit-trail
```

**Generates:**
- Timeline of verification coverage
- Residual risk resolution tracking
- Evidence of continuous improvement
- Cryptographically signed audit trail

---

## Diff Algorithm

### 1. Verification Surface Diff

Compares what was checked in each bundle:

```typescript
interface VerificationSurfaceDiff {
  languages: { added: string[]; removed: string[] };
  frameworks: { added: string[]; removed: string[] };
  tiersRun: { added: number[]; removed: number[] };
  propertiesVerified: { added: string[]; removed: string[] };
  explicitlyOutOfScope: { added: string[]; removed: string[] };
}
```

### 2. Property Coverage Diff

For each property, compares:
- Status (proven → partial, partial → proven, etc.)
- Confidence score change
- Evidence count
- File coverage

### 3. Residual Risk Diff

Tracks risk lifecycle:
- **RESOLVED:** Risk no longer appears (mitigated)
- **NEW:** Risk appears for first time
- **ESCALATED:** Severity increased
- **DE-ESCALATED:** Severity decreased
- **UNCHANGED:** Risk persists

### 4. Trust Score Diff

Calculates delta with breakdown:
```
Trust Score: 68% → 87% (+19%)
  Auth: +12%
  Validation: +5%
  Error Handling: +8%
  SQL Injection: +10%
  Overall: +19%
```

---

## Storage and Versioning

### Bundle Storage

Bundles are stored in `.shipgate/history/`:

```
.shipgate/
  history/
    2026-02-01-bundle.json
    2026-02-08-bundle.json
    2026-02-15-bundle.json
  current-bundle.json
  bundle-index.json
```

### Bundle Index

Tracks all historical bundles:

```json
{
  "bundles": [
    {
      "id": "sha256:7f3e9a...",
      "timestamp": "2026-02-01T10:00:00Z",
      "version": "v1.0.0",
      "commit": "abc123",
      "trustScore": 68,
      "verdict": "NO_SHIP"
    },
    {
      "id": "sha256:8g4f0b...",
      "timestamp": "2026-02-15T10:00:00Z",
      "version": "v1.1.0",
      "commit": "def456",
      "trustScore": 87,
      "verdict": "SHIP"
    }
  ]
}
```

### Git Integration

Automatically tag bundles with git metadata:

```bash
# Auto-tag on verify
isl verify . --tag $(git describe --tags)

# Bundle includes git context
{
  "git": {
    "commit": "abc123",
    "branch": "main",
    "tag": "v1.1.0",
    "author": "eng@company.com"
  }
}
```

---

## Trend Visualization

### CLI Sparklines

```bash
$ isl verify trend --property auth-coverage --since 30d

Auth Coverage (Last 30 Days):
  ▂▃▅▆▇█████ 94% (↑ 24%)
  
  2026-01-15: 70%
  2026-02-01: 85%
  2026-02-15: 94%
```

### JSON Export for Dashboards

```bash
$ isl verify history --format json > history.json
```

Use with Grafana, Datadog, or custom dashboards:

```json
[
  {
    "timestamp": "2026-02-15T10:00:00Z",
    "trustScore": 87,
    "properties": {
      "auth-coverage": { "status": "proven", "confidence": 0.94 },
      "input-validation": { "status": "proven", "confidence": 0.89 }
    },
    "residualRisks": 1
  }
]
```

---

## API for Custom Integration

```typescript
import { ProofBundleDiffer } from '@isl-lang/proof';

const differ = new ProofBundleDiffer();
const diff = await differ.compare(bundle1, bundle2);

console.log(diff.summary);
// {
//   trustScoreDelta: 19,
//   propertiesImproved: 4,
//   propertiesRegressed: 0,
//   risksResolved: 2,
//   risksNew: 1
// }
```

---

## Why This Matters for Enterprises

**Before ISL Verify:**
- "How has our code quality changed?" → Manual inspection, tribal knowledge
- "Are we getting better or worse?" → No data
- "Can you prove compliance progress?" → PowerPoint decks

**With ISL Verify:**
- "How has our code quality changed?" → `isl verify diff Q3 Q4`
- "Are we getting better or worse?" → Trust score trend: ▂▅▇█ (+21%)
- "Can you prove compliance progress?" → Signed audit trail with evidence

---

## Configuration

`.shipgate.yml`:

```yaml
history:
  enabled: true
  retention: 90d
  autoTag: true
  exportFormat: json
  
diff:
  failOnRegression: true
  minTrustScoreDelta: -5
  allowedRiskEscalation: 0
  
trend:
  sparklines: true
  smoothing: 7d
```

---

## Roadmap

**Completed:**
- ✅ Bundle storage and indexing
- ✅ Basic diff algorithm
- ✅ Git integration

**In Progress:**
- 🚧 Trend visualization
- 🚧 Regression detection
- 🚧 Dashboard export

**Planned:**
- 📋 Real-time monitoring
- 📋 Slack/Teams notifications
- 📋 Custom diff policies

---

## Conclusion

**No other scanner does this.**

Bundle diffing transforms ISL Verify from "a tool that checks code" to "a system that tracks verification over time."

This is what makes it enterprise-grade. This is what makes it governance-ready.

**Show me how auth coverage changed between last quarter and today.**

Now you can.
