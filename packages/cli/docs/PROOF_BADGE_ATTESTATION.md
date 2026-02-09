# Proof Badge & Attestation

Generate shareable artifacts from proof bundles: badges for READMEs, attestations for supply chain security, and PR comments for CI integration.

## Overview

Proof bundles contain complete verification evidence. These commands turn them into:

1. **Badges** - Visual indicators for READMEs and CI status
2. **Attestations** - SLSA-style JSON for supply chain security
3. **PR Comments** - Formatted summaries for GitHub pull requests

## Badge Generation

### SVG Badge

Generate an SVG badge file:

```bash
shipgate proof badge ./proof-bundle -o badge.svg
```

The badge shows:
- **Label**: "proof"
- **Status**: Verdict (PROVEN, INCOMPLETE, VIOLATED, UNPROVEN)
- **Color**: Green (PROVEN), Yellow (INCOMPLETE), Red (VIOLATED), Grey (UNPROVEN)

### Badge URL

Generate a badge URL (shields.io style):

```bash
shipgate proof badge ./proof-bundle --format url --bundle-url https://example.com/bundle
```

Output:
```
https://img.shields.io/badge/proof-PROVEN-4c1?link=https://example.com/bundle
```

### Usage in README

Add to your README.md:

```markdown
[![Proof](https://img.shields.io/badge/proof-PROVEN-4c1)](https://example.com/bundle)
```

Or use a local SVG:

```markdown
![Proof](./badge.svg)
```

### CI Integration

In GitHub Actions:

```yaml
- name: Generate proof badge
  run: |
    shipgate proof badge ./proof-bundle -o badge.svg
    # Upload badge as artifact or commit to repo
```

## Attestation Generation

### Basic Attestation

Generate SLSA-style attestation JSON:

```bash
shipgate proof attest ./proof-bundle -o attestation.json
```

### Attestation Structure

The attestation follows the [in-toto attestation](https://github.com/in-toto/attestation) format:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "proof-bundle-<bundleId>",
      "digest": {
        "sha256": "<bundleId>"
      }
    }
  ],
  "predicateType": "https://isl-lang.dev/proof-bundle/v1",
  "predicate": {
    "verdict": "PROVEN",
    "verdictReason": "All requirements met...",
    "spec": {
      "domain": "UserAuth",
      "version": "1.0.0",
      "specHash": "..."
    },
    "gate": {
      "verdict": "SHIP",
      "score": 95,
      "fingerprint": "..."
    },
    "build": {
      "status": "pass",
      "tool": "tsc",
      "toolVersion": "5.0.0"
    },
    "tests": {
      "status": "pass",
      "totalTests": 42,
      "passedTests": 42,
      "framework": "vitest",
      "frameworkVersion": "1.0.0"
    },
    "toolchain": {
      "islStudioVersion": "1.0.0",
      "bundleVersion": "1.0.0",
      "packs": [...]
    },
    "generatedAt": "2026-02-09T12:00:00Z",
    "bundleId": "..."
  }
}
```

### Include Full Manifest

To include the complete manifest in the attestation:

```bash
shipgate proof attest ./proof-bundle --include-manifest -o attestation.json
```

This adds a `manifest` field to the predicate with the full proof bundle manifest.

### Supply Chain Integration

Use attestations with:

- **SLSA** - Supply-chain Levels for Software Artifacts
- **Sigstore** - Signing and verification
- **SPDX** - Software Package Data Exchange

Example with Sigstore:

```bash
# Generate attestation
shipgate proof attest ./proof-bundle -o attestation.json

# Sign with Sigstore
cosign attest --predicate attestation.json --type custom ./proof-bundle
```

## PR Comment Generation

### Basic Comment

Generate a GitHub PR comment:

```bash
shipgate proof comment ./proof-bundle
```

### GitHub Actions Integration

Post comment to PR:

```yaml
- name: Generate proof bundle
  run: shipgate proof pack --spec auth.isl -o ./proof-bundle

- name: Generate PR comment
  run: shipgate proof comment ./proof-bundle -o pr-comment.md

- name: Comment PR
  uses: actions/github-script@v6
  with:
    script: |
      const comment = fs.readFileSync('pr-comment.md', 'utf8');
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
      });
```

### Comment Format

The comment includes:

- Verdict with emoji (✅ PROVEN, ❌ VIOLATED, ⚠️ INCOMPLETE)
- Bundle ID and generation timestamp
- Phase-by-phase summary table
- Spec and toolchain information

Example output:

```markdown
## ✅ Proof Bundle Verification

**Bundle ID:** `a1b2c3d4...`  
**Generated:** 2/9/2026, 12:00:00 PM

### Verdict: **PROVEN**

All requirements met: Gate SHIP, Verify PROVEN, 42 tests, imports resolved

---

### Summary

| Phase | Status | Details |
|-------|--------|---------|
| **Gate** | ✅ SHIP | Score: 95/100, Blockers: 0 |
| **Build** | ✅ PASS | tsc 5.0.0 |
| **Tests** | ✅ PASS | 42/42 passed |
| **Verify** | ✅ PROVEN | 15/15 clauses proven |

...
```

## Deterministic Output

All outputs are deterministic:

- **Badge SVG**: Same bundle → same SVG (byte-for-byte)
- **Attestation JSON**: Same bundle → same JSON (canonical ordering)
- **PR Comment**: Same bundle → same comment (deterministic formatting)

This ensures reproducible builds and verifiable artifacts.

## Examples

### Complete CI Workflow

```yaml
name: Proof Bundle CI

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run verification
        run: |
          shipgate gate specs/auth.isl --impl ./src --output ./evidence
          shipgate proof pack --spec specs/auth.isl --evidence ./evidence -o ./proof-bundle
      
      - name: Generate badge
        run: shipgate proof badge ./proof-bundle -o badge.svg
      
      - name: Generate attestation
        run: shipgate proof attest ./proof-bundle -o attestation.json
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: proof-artifacts
          path: |
            badge.svg
            attestation.json
            proof-bundle/
```

### README Badge

```markdown
# My Project

[![Proof](./badge.svg)](https://github.com/user/repo/actions)

This project uses ShipGate for verification. The badge shows the latest proof bundle status.
```

### Attestation Verification

```bash
# Generate attestation
shipgate proof attest ./proof-bundle -o attestation.json

# Verify bundle integrity
shipgate proof verify ./proof-bundle

# Sign attestation (example with cosign)
cosign attest --predicate attestation.json --type custom ./proof-bundle
```

## See Also

- [Proof Bundle Specification](../docs/PROOF_BUNDLE_V1_SPEC.md)
- [Proof Verification](./proof.md)
- [SLSA Attestations](https://slsa.dev/attestation-model)
