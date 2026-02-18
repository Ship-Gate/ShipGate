# ShipGate Extension - Real Data Integration Status

## ✅ Fully Working with Real CLI Data

### Overview Tab
- **Verdict Card**: Uses real `verdict` and `score` from CLI
- **Stats Grid**: 
  - Pass/Total: Counts from `files` array
  - Coverage: Calculated from `coverage.specced / coverage.total`
  - Files: Total count from `files.length`
  - Issues: Sum of all `blockers` and `errors`
- **Findings Preview**: Shows top 3 files with violations (real data)
- **Header**: Shows real workspace name and branch

### Findings Tab
- **All Findings**: Extracted from CLI result `files[].blockers` and `files[].errors`
- **Severity**: Mapped from file status (FAIL → critical/high, WARN → medium)
- **File Names**: Real file paths from CLI
- **Count Badge**: Real total violation count
- **File Opening**: Works with real paths

### Files Tab
- **File List**: All files from CLI `files` array
- **Verdicts**: Mapped from `status` field (PASS → SHIP, FAIL → NO_SHIP, WARN → WARN)
- **Scores**: Real scores from `files[].score`
- **Finding Counts**: Real counts from blockers + errors
- **Search/Sort**: Works on real data

### Footer
- **Status**: Shows real scanning state
- **Verify Button**: Triggers real CLI execution

## ⚠️ Hardcoded (Needs Backend Integration)

### Claims Tab
**Status**: Hardcoded 8 claims with static data

**What's Needed**: Backend API or CLI flag to output:
```json
{
  "claims": [
    {
      "name": "Import Integrity",
      "status": "PROVEN" | "PARTIAL" | "UNVERIFIED",
      "confidence": 100,
      "evidence": "847/847 imports resolve...",
      "control": "CC7.1"
    }
  ]
}
```

**Hardcoded Values**:
- 8 predefined claims (Import Integrity, Auth Coverage, Input Validation, SQL Injection, Secret Exposure, Type Safety, Error Handling, AI Hallucinations)
- Static confidence percentages
- Static evidence strings
- Static SOC 2 control mappings

### Pipeline Tab
**Status**: Hardcoded GitHub CI/CD data

**What's Needed**: GitHub API integration or webhook data:
```json
{
  "pipeline": {
    "currentRun": {
      "status": "running",
      "commit": "feat: add payment",
      "pr": 139,
      "jobs": [
        { "name": "Install", "status": "success", "duration": "11s" },
        { "name": "shipgate verify", "status": "running", "duration": "31s" }
      ]
    },
    "recentRuns": [...],
    "deployGates": [...]
  }
}
```

**Hardcoded Values**:
- Current run status with fake commit message
- 5 job steps with hardcoded statuses
- 3 recent runs with static data
- 3 deploy gates (Production, Staging, Preview) with static scores

### Compliance Section (Overview Tab)
**Status**: Hardcoded compliance percentages

**What's Needed**: Compliance engine output:
```json
{
  "compliance": {
    "soc2": { "score": 83, "controls": [...] },
    "hipaa": { "score": 71, "controls": [...] },
    "euai": { "score": 67, "controls": [...] }
  }
}
```

**Hardcoded Values**:
- SOC 2: 83%
- HIPAA: 71%
- EU AI: 67%

### AI Provenance Section (Overview Tab)
**Status**: Hardcoded AI provenance data

**What's Needed**: Code analysis output:
```json
{
  "provenance": {
    "aiGenerated": 67,
    "human": 17,
    "aiAssisted": 11,
    "unknown": 5
  }
}
```

**Hardcoded Values**:
- AI-Generated: 67%
- Human: 17%
- AI-Assisted: 11%
- Unknown: 5%

### Pipeline Mini (Overview Tab)
**Status**: Hardcoded GitHub run preview

**What's Needed**: Same as Pipeline Tab - GitHub integration

**Hardcoded Values**:
- Fake commit message
- Static job status dots
- Hardcoded duration

### Proof Bundle Preview (Overview Tab)
**Status**: Partially hardcoded

**What's Needed**: Read actual proof bundle from `.shipgate/proof-bundle.json`:
```json
{
  "bundleHash": "a1b2c3d",
  "hmac": "7f3a...c821",
  "claims": [
    { "name": "Import Integrity", "status": "PROVEN" }
  ]
}
```

**Hardcoded Values**:
- Static bundle hash
- Static HMAC
- 2 hardcoded claim previews

## 🔧 How to Add Real Data Support

### For Claims Tab

**Option 1: CLI Output**
```bash
shipgate verify --json --include-claims
```

**Option 2: Read from Proof Bundle**
```typescript
// In extension.ts
const bundlePath = `${cwd}/.shipgate/proof-bundle.json`;
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
dashboardData.claims = bundle.claims;
```

### For Pipeline Tab

**Option 1: GitHub API**
```typescript
// In extension.ts
import { Octokit } from '@octokit/rest';
const octokit = new Octokit({ auth: config.get('github.token') });
const runs = await octokit.actions.listWorkflowRunsForRepo(...);
dashboardData.pipeline = formatPipelineData(runs);
```

**Option 2: Read GitHub Actions Artifacts**
```bash
# In CI, save run data
echo "$GITHUB_CONTEXT" > .shipgate/github-run.json
```

### For Compliance

**Option 1: CLI Flag**
```bash
shipgate verify --compliance soc2,hipaa,euai --json
```

**Option 2: Separate Command**
```bash
shipgate compliance check --frameworks soc2,hipaa,euai --json
```

### For AI Provenance

**Option 1: Code Analysis**
```typescript
// Analyze git blame + commit messages
const provenance = analyzeCodeProvenance(cwd);
dashboardData.provenance = provenance;
```

**Option 2: CLI Integration**
```bash
shipgate analyze-provenance --json
```

## 📊 Current Data Flow

```
CLI Execution (extension.ts)
  ↓
  npx shipgate verify --json
  ↓
  Parse JSON output
  ↓
  Format dashboardData {
    projectName,
    branch,
    verdict,
    score,
    files: [{
      file,
      status: 'PASS' | 'FAIL' | 'WARN',
      score,
      mode,
      blockers: [],
      errors: []
    }],
    coverage: { specced, total },
    duration,
    timestamp
  }
  ↓
  sendMessage({ type: 'results', data: dashboardData })
  ↓
Webview (complete-content.ts)
  ↓
  state.data = dashboardData
  ↓
  Render tabs using real data
```

## 🎯 Recommendation

**Phase 1 (Current)**: Use real CLI data for core functionality
- ✅ Verdict/Score
- ✅ File list with violations
- ✅ Findings
- ✅ Coverage stats

**Phase 2**: Add claims from proof bundle
- Read `.shipgate/proof-bundle.json`
- Parse claims array
- Remove hardcoded claims

**Phase 3**: Add GitHub integration
- Fetch workflow runs via API
- Parse CI/CD status
- Update Pipeline tab with real data

**Phase 4**: Add compliance mapping
- Extend CLI to output compliance scores
- Map findings to control requirements
- Update Compliance section

**Phase 5**: Add provenance analysis
- Analyze git history
- Detect AI-generated code patterns
- Update AI Provenance section

## 🚀 Quick Win: Hide Unimplemented Sections

To ship now without misleading data, hide sections that aren't backend-ready:

```typescript
// In complete-content.ts renderOverview()

// Remove or comment out:
// - Compliance section (lines 763-780)
// - AI Provenance section (lines 782-802)
// - Pipeline mini section (lines 714-730)
// - Proof Bundle preview (lines 804-820)

// In renderClaims(), add note:
// "Claims data will be available when proof bundle is generated"

// In renderPipeline(), add note:
// "Connect GitHub to see CI/CD runs"
```

## 📝 Testing with Real Data

```bash
# 1. Build extension
cd packages/vscode
pnpm run build

# 2. Open workspace with ISL specs
code /path/to/your/project

# 3. Run verification
Ctrl+Shift+G (or Cmd+Shift+G on Mac)

# 4. Check sidebar
- Verdict card shows real result
- Stats show real counts
- Findings show real violations
- Files show real file list
```

## ✅ Summary

**Working with Real Data:**
- Overview stats (verdict, score, files, issues, coverage)
- Findings tab (all violations from CLI)
- Files tab (all files with real verdicts)
- File opening (real paths)
- Search/filter (real data)

**Still Hardcoded (Documented Above):**
- Claims tab (8 hardcoded claims)
- Pipeline tab (GitHub CI/CD data)
- Compliance section (3 frameworks)
- AI Provenance section (4 categories)
- Proof bundle preview

**Next Steps:**
1. Test with real `shipgate verify` output
2. Decide which hardcoded sections to hide vs implement
3. Prioritize backend integrations based on user needs
