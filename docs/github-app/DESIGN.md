# GitHub App Design - ISL CI Enforcement

## Overview

The ISL GitHub App provides org-wide enforcement of ISL verification policies, moving beyond copy/paste YAML workflows to centralized, policy-driven CI/CD enforcement.

## Architecture

```
┌─────────────────┐
│  GitHub Org     │
│  (Install App)  │
└────────┬────────┘
         │
         │ Webhooks
         ▼
┌─────────────────┐
│  GitHub App     │
│  (Server)       │
└────────┬────────┘
         │
         ├──► Policy Bundle Store
         │    (Org-pinned versions)
         │
         ├──► Check Runs API
         │    (Required checks)
         │
         ├──► Annotations API
         │    (PR comments)
         │
         └──► SARIF Upload API
              (Code scanning)
```

## Minimal Permissions

### Repository Permissions

| Permission | Level | Justification |
|------------|-------|---------------|
| **Checks** | Write | Create required check runs for PRs |
| **Contents** | Read | Read code to verify against ISL specs |
| **Metadata** | Read | Access repository metadata (required) |
| **Pull requests** | Write | Post annotations and comments on PRs |
| **Security events** | Write | Upload SARIF results to Code Scanning |

### Organization Permissions

| Permission | Level | Justification |
|------------|-------|---------------|
| **Members** | Read-only | Identify org members for policy enforcement |
| **Administration** | None | No org admin access needed |

### Account Permissions

| Permission | Level | Justification |
|------------|-------|---------------|
| **Email addresses** | Read-only | Identify users (optional, for audit) |

## Webhook Events

### Required Events

```yaml
events:
  # Trigger checks on PR events
  - pull_request:
      types: [opened, synchronize, reopened, closed]
  
  # Trigger checks on push to main/master
  - push:
      branches: [main, master]
  
  # Handle check run requests
  - check_run:
      types: [rerequested]
  
  # Handle check suite requests
  - check_suite:
      types: [requested, rerequested, completed]
  
  # Handle installation events
  - installation:
      types: [created, deleted]
  
  - installation_repositories:
      types: [added, removed]
```

### Event Flow

1. **PR Opened/Synchronized**
   - App receives `pull_request` webhook
   - Fetches org-pinned policy bundle
   - Creates check run with status "in_progress"
   - Runs ISL verification with policy rules
   - Updates check run with results
   - Posts PR annotations
   - Uploads SARIF if violations found

2. **Check Suite Requested**
   - App receives `check_suite` webhook
   - Creates check run for each required policy
   - Runs verification in parallel
   - Aggregates results

3. **Installation Created**
   - App receives `installation` webhook
   - Configures default policy bundle for org
   - Sets up required checks

## Policy Bundle Distribution

### Bundle Structure

```json
{
  "version": "1.0.0",
  "org": "acme-corp",
  "pinnedAt": "2026-02-02T00:00:00Z",
  "policies": {
    "required": [
      "pii",
      "auth",
      "quality"
    ],
    "optional": [
      "payments",
      "rate-limit"
    ]
  },
  "config": {
    "pii": {
      "enabled": true,
      "failOnWarning": true,
      "ruleOverrides": {
        "pii/console-in-production": {
          "severity": "warning"
        }
      }
    },
    "auth": {
      "enabled": true,
      "failOnWarning": false
    },
    "quality": {
      "enabled": true,
      "threshold": 95
    }
  },
  "checks": {
    "required": [
      "isl-pii-check",
      "isl-auth-check",
      "isl-quality-check"
    ],
    "optional": []
  }
}
```

### Distribution Model

1. **Org-Level Pinning**
   - Policy bundles pinned at organization level
   - Stored in GitHub App's database/cache
   - Versioned with semantic versioning
   - Admins can update via App UI or API

2. **Repository Overrides**
   - Repos can opt-out of specific policies (with approval)
   - Repos can add additional policies (opt-in)
   - Overrides logged for audit

3. **Bundle Storage**
   - Bundles stored in App's backend
   - Cached per org for performance
   - Version history maintained

## Check Runs Configuration

### Required Checks

The App automatically configures required checks based on the policy bundle:

```typescript
interface RequiredCheck {
  name: string;        // e.g., "ISL: PII Policy"
  policyId: string;   // e.g., "pii"
  required: boolean;  // Must pass to merge
  blocking: boolean;  // Blocks merge if failed
}
```

### Check Run States

- **queued**: Check run created, waiting to start
- **in_progress**: Verification running
- **completed**: Verification finished
  - **conclusion**: success | failure | neutral | cancelled | timed_out | action_required

### Branch Protection Integration

The App can configure branch protection rules via API:

```yaml
branch_protection:
  required_checks:
    - isl-pii-check
    - isl-auth-check
    - isl-quality-check
  require_up_to_date: true
  enforce_admins: true
```

## PR Annotations

### Annotation Types

1. **Error Annotations** (hard_block violations)
   - Red X icon
   - Blocks merge
   - Shown in PR diff view

2. **Warning Annotations** (soft_block violations)
   - Yellow warning icon
   - Doesn't block merge (unless configured)
   - Shown in PR diff view

3. **Info Annotations** (warn tier)
   - Blue info icon
   - Informational only
   - Shown in PR checks tab

### Annotation Format

```typescript
{
  path: "src/api/users.ts",
  start_line: 42,
  end_line: 42,
  annotation_level: "failure", // failure | warning | notice
  message: "PII IN LOG: email may be logged",
  title: "PII Policy Violation",
  raw_details: "Rule: pii/logged-sensitive-data\nSeverity: error\n..."
}
```

## SARIF Upload

### SARIF Generation

The App generates SARIF 2.1.0 format from policy violations:

```json
{
  "version": "2.1.0",
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema.json",
  "runs": [{
    "tool": {
      "driver": {
        "name": "ISL Policy Packs",
        "version": "1.0.0",
        "rules": [...]
      }
    },
    "results": [
      {
        "ruleId": "pii/logged-sensitive-data",
        "level": "error",
        "message": {...},
        "locations": [...]
      }
    ]
  }]
}
```

### Upload Flow

1. Run policy checks
2. Convert violations to SARIF format
3. Upload via `POST /repos/{owner}/{repo}/code-scanning/sarifs`
4. Results appear in Security > Code scanning

## Implementation Considerations

### Performance

- **Parallel Execution**: Run policy checks in parallel
- **Caching**: Cache policy bundles per org
- **Incremental Checks**: Only check changed files in PRs
- **Rate Limiting**: Respect GitHub API rate limits

### Security

- **Webhook Verification**: Verify webhook signatures
- **Token Scoping**: Use minimal required permissions
- **Secrets Management**: Store App private key securely
- **Audit Logging**: Log all policy evaluations

### Scalability

- **Queue System**: Use queue for async processing
- **Horizontal Scaling**: Stateless App instances
- **Database**: Store org configs and audit logs
- **CDN**: Serve policy bundles via CDN

## API Endpoints

### App Backend APIs

```
POST /api/webhooks/github
  - Receive GitHub webhooks
  - Verify signatures
  - Queue processing

GET /api/orgs/{org}/policy-bundle
  - Get org's pinned policy bundle
  - Returns versioned bundle config

PUT /api/orgs/{org}/policy-bundle
  - Update org's policy bundle (admin only)
  - Requires authentication

GET /api/repos/{owner}/{repo}/checks
  - Get check run status for repo
  - Returns current check runs

POST /api/repos/{owner}/{repo}/checks/rerun
  - Rerun checks for a PR
  - Triggers new verification
```

## Configuration UI

### Organization Settings

- View current policy bundle version
- Update policy bundle (pin new version)
- Configure required checks
- View audit logs
- Manage repository overrides

### Repository Settings

- View applied policies
- Request policy override (requires approval)
- View check run history
- Download SARIF reports

## Next Steps

1. Implement webhook handler
2. Build policy bundle storage
3. Create check runs API integration
4. Implement SARIF generation
5. Build configuration UI
6. Add audit logging
