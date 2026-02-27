# Migration Guide: GitHub Action → GitHub App

## Overview

This guide helps organizations migrate from the ISL GitHub Action (copy/paste YAML) to the ISL GitHub App (org-wide enforcement).

## Benefits of Migration

### Before (GitHub Action)
- ❌ Manual YAML copy/paste per repo
- ❌ Inconsistent policy versions
- ❌ No centralized enforcement
- ❌ Difficult to update policies org-wide
- ❌ Repos can disable checks

### After (GitHub App)
- ✅ Centralized policy management
- ✅ Org-wide version pinning
- ✅ Automatic check configuration
- ✅ Consistent enforcement
- ✅ Easy policy updates
- ✅ Audit trail

## Prerequisites

1. **GitHub Organization** with admin access
2. **ISL GitHub App** installed on org
3. **Policy Bundle** selected/pinned
4. **Test Repository** for validation

## Migration Steps

### Phase 1: Preparation

#### 1.1 Audit Current State

Document your current GitHub Action usage:

```bash
# Find all repos using ISL Action
gh search code "isl-lang/verify-action" --json repository --jq '.[].repository.full_name' | sort -u

# List workflow files
find . -name "*.yml" -path "*/.github/workflows/*" -exec grep -l "isl-lang/verify-action" {} \;
```

Create an inventory:

```markdown
## Current ISL Action Usage

| Repository | Workflow File | Policy Config | Version |
|------------|---------------|---------------|---------|
| org/repo1  | .github/workflows/isl.yml | pii, auth | v1.0.0 |
| org/repo2  | .github/workflows/verify.yml | pii | v1.0.0 |
```

#### 1.2 Identify Policy Requirements

Extract policy configurations from workflows:

```yaml
# Example: Current Action config
- uses: isl-lang/verify-action@v1
  with:
    specs: 'specs/**/*.isl'
    policy-packs: 'pii,auth,quality'
    fail-on-warning: true
    threshold: 95
```

Map to policy bundle:

```json
{
  "policies": {
    "required": [
      {
        "id": "pii",
        "enabled": true,
        "failOnWarning": true
      },
      {
        "id": "auth",
        "enabled": true
      },
      {
        "id": "quality",
        "enabled": true,
        "config": {
          "threshold": 95
        }
      }
    ]
  }
}
```

#### 1.3 Create Test Bundle

Create a test policy bundle matching your current config:

```bash
# Via App UI or API
curl -X POST https://app.isl.dev/api/bundles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "org-migration-test",
    "policies": {
      "required": [
        {"id": "pii", "enabled": true, "failOnWarning": true},
        {"id": "auth", "enabled": true},
        {"id": "quality", "enabled": true, "config": {"threshold": 95}}
      ]
    }
  }'
```

### Phase 2: Parallel Run

#### 2.1 Install GitHub App

1. Go to GitHub App settings
2. Install on your organization
3. Select repositories (start with test repo)
4. Grant required permissions

#### 2.2 Pin Test Bundle

```bash
# Pin bundle to org
curl -X PUT https://app.isl.dev/api/orgs/acme-corp/bundle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "org-migration-test",
    "version": "1.0.0"
  }'
```

#### 2.3 Enable App Checks (Non-Blocking)

The App will automatically create check runs. Initially, don't make them required:

1. Go to repository settings
2. Navigate to Branches > Branch protection
3. Verify App checks appear but are NOT required
4. Create a test PR to see checks run

#### 2.4 Compare Results

Run both Action and App on the same PR:

```bash
# Action results
gh run view <action-run-id> --json conclusion,output

# App check results
gh api repos/{owner}/{repo}/check-runs/{check-run-id} --jq '.conclusion'
```

Compare:
- ✅ Same violations detected?
- ✅ Same pass/fail decisions?
- ✅ Same annotations?

### Phase 3: Gradual Migration

#### 3.1 Migrate Test Repository

1. **Enable App Checks as Required**
   ```bash
   # Via GitHub API or UI
   gh api repos/{owner}/{repo}/branches/main/protection \
     -X PUT \
     -f required_status_checks='{"strict":true,"contexts":["isl-pii-check","isl-auth-check","isl-quality-check"]}'
   ```

2. **Remove Action Workflow**
   ```bash
   # Delete workflow file
   rm .github/workflows/isl.yml
   git commit -m "chore: migrate to ISL GitHub App"
   git push
   ```

3. **Verify App Checks Still Run**
   - Create test PR
   - Verify checks appear
   - Verify merge is blocked if checks fail

#### 3.2 Migrate Additional Repos

Repeat for each repository:

1. Verify App checks run correctly
2. Make checks required
3. Remove Action workflow
4. Document migration

**Batch Script:**

```bash
#!/bin/bash
# migrate-repo.sh

REPO=$1
ORG="acme-corp"

echo "Migrating $REPO..."

# 1. Verify App is installed
gh api repos/$ORG/$REPO/installation --jq '.id' || {
  echo "App not installed on $REPO"
  exit 1
}

# 2. Create test PR
BRANCH="test-isl-app-migration-$(date +%s)"
gh repo clone $ORG/$REPO /tmp/$REPO
cd /tmp/$REPO
git checkout -b $BRANCH
echo "# Test ISL App Migration" > test-migration.md
git add test-migration.md
git commit -m "test: verify ISL App checks"
git push origin $BRANCH
PR_NUM=$(gh pr create --title "Test ISL App Migration" --body "Testing App checks" --json number --jq '.number')

# 3. Wait for checks
echo "Waiting for checks to complete..."
sleep 30
gh pr checks $PR_NUM --json name,conclusion | jq '.[] | select(.name | startswith("isl-"))'

# 4. If checks pass, proceed with migration
read -p "Do checks look correct? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Remove Action workflow
  gh repo view $ORG/$REPO --json defaultBranchRef --jq '.defaultBranchRef.name' | xargs -I {} \
    gh api repos/$ORG/$REPO/contents/.github/workflows/isl.yml \
    --method DELETE \
    -f message="chore: migrate to ISL GitHub App" \
    -f branch={} \
    -f sha=$(gh api repos/$ORG/$REPO/contents/.github/workflows/isl.yml --jq '.sha')
  
  echo "✅ Migrated $REPO"
else
  echo "❌ Skipping $REPO"
fi

# Cleanup
gh pr close $PR_NUM
cd /
rm -rf /tmp/$REPO
```

### Phase 4: Full Migration

#### 4.1 Make App Checks Required Org-Wide

```bash
# Script to update all repos
for repo in $(gh repo list $ORG --json name --jq '.[].name'); do
  gh api repos/$ORG/$repo/branches/main/protection \
    -X PUT \
    -f required_status_checks='{"strict":true,"contexts":["isl-pii-check","isl-auth-check","isl-quality-check"]}' \
    || echo "Failed to update $repo"
done
```

#### 4.2 Remove All Action Workflows

```bash
# Find all workflow files
gh search code "isl-lang/verify-action" \
  --json repository,path \
  --jq '.[] | "\(.repository.full_name):\(.path)"' | \
  while IFS=: read -r repo path; do
    echo "Removing $path from $repo"
    # Remove via API or manual PR
  done
```

#### 4.3 Verify Migration

```bash
# Check all repos have App checks
for repo in $(gh repo list $ORG --json name --jq '.[].name'); do
  checks=$(gh api repos/$ORG/$repo/check-runs --jq '.[] | select(.name | startswith("isl-")) | .name' | sort -u)
  if [ -z "$checks" ]; then
    echo "⚠️  $repo: No ISL checks found"
  else
    echo "✅ $repo: $checks"
  fi
done
```

## Rollback Plan

If issues arise:

### Immediate Rollback

1. **Disable App Checks**
   ```bash
   # Remove from branch protection
   gh api repos/{owner}/{repo}/branches/main/protection \
     -X DELETE
   ```

2. **Restore Action Workflow**
   ```bash
   # Restore from git history
   git checkout HEAD~1 -- .github/workflows/isl.yml
   git commit -m "rollback: restore ISL Action"
   git push
   ```

### Partial Rollback

1. **Pin Previous Bundle Version**
   ```bash
   curl -X PUT https://app.isl.dev/api/orgs/{org}/bundle \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"bundleId": "previous-bundle", "version": "0.9.0"}'
   ```

2. **Disable Problematic Policy**
   ```bash
   # Update bundle to disable policy
   curl -X PATCH https://app.isl.dev/api/bundles/{bundleId}/versions/{version} \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"policies": {"required": [{"id": "problematic-policy", "enabled": false}]}}'
   ```

## Troubleshooting

### App Checks Not Appearing

1. Verify App is installed:
   ```bash
   gh api orgs/{org}/installations --jq '.[] | select(.app_slug=="isl-github-app")'
   ```

2. Check webhook delivery:
   - Go to App settings > Advanced > Webhooks
   - Verify recent deliveries
   - Check for errors

3. Verify repository access:
   ```bash
   gh api installations/{installation-id}/repositories --jq '.[].full_name'
   ```

### Checks Failing Unexpectedly

1. Compare with Action results:
   ```bash
   # Run Action manually
   act pull_request
   
   # Compare outputs
   diff action-output.json app-output.json
   ```

2. Check policy bundle version:
   ```bash
   curl https://app.isl.dev/api/orgs/{org}/bundle | jq '.version'
   ```

3. Review check run logs:
   ```bash
   gh api repos/{owner}/{repo}/check-runs/{check-run-id} --jq '.output.text'
   ```

### Performance Issues

1. Check App backend status
2. Review cache hit rates
3. Monitor API rate limits
4. Contact support if needed

## Post-Migration

### Monitoring

Set up alerts for:
- Check run failures
- Policy violations
- App downtime
- Performance degradation

### Documentation

Update internal docs:
- Remove Action setup instructions
- Add App configuration guide
- Document policy bundle management
- Update onboarding docs

### Training

Train team on:
- Policy bundle management
- Repository overrides
- Check run interpretation
- SARIF report usage

## Checklist

- [ ] Audit current Action usage
- [ ] Create policy bundle
- [ ] Install GitHub App
- [ ] Pin bundle to org
- [ ] Test on one repository
- [ ] Compare Action vs App results
- [ ] Migrate test repository
- [ ] Migrate additional repositories
- [ ] Make checks required org-wide
- [ ] Remove all Action workflows
- [ ] Verify migration complete
- [ ] Update documentation
- [ ] Train team

## Support

- **Documentation**: https://docs.isl.dev/github-app
- **Support**: support@isl.dev
- **Issues**: https://github.com/isl-lang/github-app/issues
- **Slack**: #isl-github-app
