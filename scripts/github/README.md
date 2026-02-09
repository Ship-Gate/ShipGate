# GitHub Scripts

Scripts for GitHub CI/CD integration with ISL verification.

## commentEvidence.ts

Posts or updates a PR comment with the ISL "ship score" and verification results from an evidence report.

### Features

- Posts verification results as a PR comment
- Automatically updates existing comment on re-runs (uses unique marker)
- Shows ship score, pass/fail/partial counts
- Lists top 5 failed clauses with file/line locations
- Includes collapsible full report section

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub token with `pull-requests: write` permission | Yes |
| `GITHUB_REPOSITORY` | Repository in `owner/repo` format | Yes |
| `GITHUB_PR_NUMBER` | Pull request number to comment on | Yes |
| `GITHUB_API_URL` | GitHub API base URL (default: `https://api.github.com`) | No |

### Evidence Report Format

The script expects an evidence report JSON file with this structure:

```json
{
  "version": "1.0",
  "scoreSummary": {
    "overallScore": 85,
    "passCount": 17,
    "partialCount": 2,
    "failCount": 1,
    "totalClauses": 20,
    "recommendation": "ship"
  },
  "clauseResults": [
    {
      "clauseId": "clause_1",
      "state": "pass",
      "reason": "All conditions met"
    },
    {
      "clauseId": "clause_2",
      "state": "fail",
      "reason": "Timeout exceeded",
      "location": {
        "file": "src/api/handler.ts",
        "line": 42
      }
    }
  ],
  "metadata": {
    "durationMs": 12345,
    "agentVersion": "1.0.0"
  }
}
```

### Local Development

```bash
# Install dependencies (from repo root)
pnpm install

# Run with test data
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
GITHUB_PR_NUMBER=123 \
npx tsx scripts/github/commentEvidence.ts ./path/to/evidence-report.json
```

### Running in CI

See `.github/workflows/shipgate-isl-comment.yml` for the GitHub Actions workflow.

```yaml
- name: Post Evidence Comment
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITHUB_REPOSITORY: ${{ github.repository }}
    GITHUB_PR_NUMBER: ${{ github.event.pull_request.number }}
  run: npx tsx scripts/github/commentEvidence.ts .shipgate/reports/evidence.json
```

### Comment Marker

The script uses a hidden HTML comment marker to identify its comments:

```html
<!-- SHIPGATE_ISL_REPORT -->
```

This allows the script to find and update existing comments instead of creating duplicates on each run.

### Example Output

The generated PR comment looks like this:

---

## ✅ ISL Verification: **SHIP**

### Ship Score

| Metric | Value |
|--------|-------|
| **Overall Score** | **85%** |
| Pass | 17 |
| Partial | 2 |
| Fail | 1 |
| Total Clauses | 20 |

### Top Failed Clauses

- **clause_2** (postcondition) `src/api/handler.ts:42`
  - Timeout exceeded

---

## githubTypes.ts

TypeScript type definitions for GitHub API interactions used by `commentEvidence.ts`.

### Exported Types

- `GitHubComment` - GitHub PR comment structure
- `GitHubApiError` - GitHub API error response
- `GitHubEnvConfig` - Environment configuration
- `EvidenceReportInput` - Evidence report input structure
- `ClauseResultInput` - Clause result structure
- `ScoreSummaryInput` - Score summary structure
- `CommentOptions` - Comment generation options
- `CommentResult` - Result of posting/updating a comment
