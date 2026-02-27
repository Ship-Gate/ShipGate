# Proof Badge & Attestation Examples

## Acceptance Test: CI Badge Integration

### Scenario

A repository wants to publish a badge that updates on CI and links to the latest proof bundle.

### Setup

1. **Create proof bundle in CI:**

```yaml
# .github/workflows/proof.yml
name: Proof Bundle

on:
  push:
    branches: [main]
  pull_request:

jobs:
  proof:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run verification
        run: |
          shipgate gate specs/auth.isl --impl ./src --output ./evidence
          shipgate proof pack --spec specs/auth.isl --evidence ./evidence -o ./proof-bundle
      
      - name: Generate badge
        run: |
          shipgate proof badge ./proof-bundle -o badge.svg
      
      - name: Upload badge
        uses: actions/upload-artifact@v3
        with:
          name: proof-badge
          path: badge.svg
      
      # On main branch, commit badge to repo
      - name: Commit badge
        if: github.ref == 'refs/heads/main'
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add badge.svg
          git commit -m "Update proof badge" || exit 0
          git push
```

2. **Add badge to README:**

```markdown
# My Project

[![Proof](./badge.svg)](https://github.com/user/repo/actions)

This project uses ShipGate for verification. The badge shows the latest proof bundle status.
```

3. **Generate badge URL for shields.io:**

```bash
# In CI, generate badge URL
shipgate proof badge ./proof-bundle \
  --format url \
  --bundle-url https://github.com/user/repo/actions/runs/${{ github.run_id }}

# Output: https://img.shields.io/badge/proof-PROVEN-4c1?link=...
```

### Result

- ✅ Badge updates automatically on each CI run
- ✅ Badge links to the latest proof bundle
- ✅ Badge shows current verification status
- ✅ Deterministic output (same bundle → same badge)

## Example: Attestation for Supply Chain

### Generate Attestation

```bash
shipgate proof attest ./proof-bundle -o attestation.json
```

### Verify Attestation

```bash
# Verify bundle integrity
shipgate proof verify ./proof-bundle

# Check attestation structure
cat attestation.json | jq '.predicate.verdict'
# Output: "PROVEN"
```

### Sign Attestation (with Sigstore)

```bash
# Sign attestation
cosign attest --predicate attestation.json --type custom ./proof-bundle

# Verify signature
cosign verify-attestation --type custom ./proof-bundle
```

## Example: PR Comment Integration

### GitHub Actions Workflow

```yaml
name: Proof PR Comment

on:
  pull_request:

jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate proof bundle
        run: |
          shipgate gate specs/auth.isl --impl ./src --output ./evidence
          shipgate proof pack --spec specs/auth.isl --evidence ./evidence -o ./proof-bundle
      
      - name: Generate PR comment
        run: |
          shipgate proof comment ./proof-bundle -o pr-comment.md
      
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const fs = require('fs');
            const comment = fs.readFileSync('pr-comment.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Result

PR comments automatically show:
- ✅ Verdict summary
- ✅ Phase-by-phase breakdown
- ✅ Spec and toolchain information
- ✅ Bundle ID for traceability

## Example: Multiple Badge Formats

### SVG Badge

```bash
shipgate proof badge ./proof-bundle -o badge.svg
```

### URL Badge (shields.io)

```bash
shipgate proof badge ./proof-bundle \
  --format url \
  --bundle-url https://example.com/bundle
```

### Custom Badge Service

```bash
shipgate proof badge ./proof-bundle \
  --format url \
  --badge-url-base https://badges.example.com \
  --bundle-url https://example.com/bundle
```

## Example: Complete CI Pipeline

```yaml
name: Complete Proof Pipeline

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install ShipGate
        run: npm install -g shipgate
      
      - name: Run verification
        run: |
          shipgate gate specs/auth.isl --impl ./src --output ./evidence
          shipgate proof pack --spec specs/auth.isl --evidence ./evidence -o ./proof-bundle
      
      - name: Generate artifacts
        run: |
          shipgate proof badge ./proof-bundle -o badge.svg
          shipgate proof attest ./proof-bundle -o attestation.json
          shipgate proof comment ./proof-bundle -o pr-comment.md
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: proof-artifacts
          path: |
            badge.svg
            attestation.json
            pr-comment.md
            proof-bundle/
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const fs = require('fs');
            const comment = fs.readFileSync('pr-comment.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

## Deterministic Output Verification

All outputs are deterministic. Test with:

```bash
# Generate badge twice
shipgate proof badge ./proof-bundle -o badge1.svg
shipgate proof badge ./proof-bundle -o badge2.svg

# Verify they're identical
diff badge1.svg badge2.svg
# No output = identical files

# Same for attestation
shipgate proof attest ./proof-bundle -o attest1.json
shipgate proof attest ./proof-bundle -o attest2.json
diff attest1.json attest2.json
# No output = identical files
```

This ensures reproducible builds and verifiable artifacts.
