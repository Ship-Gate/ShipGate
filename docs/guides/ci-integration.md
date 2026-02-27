# CI Integration Guide

Shipgate integrates with all major CI providers to verify AI-generated code against ISL specifications.

## Overview

Shipgate provides a single CLI (`shipgate`) that works across all CI providers with consistent verdicts:

- **SHIP** → Code passes verification (exit code 0)
- **WARN** → Code has warnings but passes (exit code 0, or 1 if `--fail-on warning`)
- **NO_SHIP** → Code fails verification (exit code 1)

## Docker Image

All CI integrations use the official Docker image:

```bash
ghcr.io/shipgate/shipgate:v1
```

**Tags:**
- `v1` (recommended) - Stable major version
- `v1.0.0` - Specific version
- `latest` - Latest build (not recommended for production)

## Configuration

Shipgate auto-detects `.shipgate.yml` in your repository root:

```yaml
ci:
  fail_on: error  # error | warning | unspecced
  ignore:
    - "**/*.test.ts"
    - "**/*.spec.ts"
  require_isl:
    - "src/api/**"
```

## Provider-Specific Integrations

### GitHub Actions

**Integration Type:** Node action  
**Format:** `github` (GitHub Actions annotations)

**Usage:**

```yaml
- uses: shipgate/isl-verify@v1
  with:
    path: src/
    mode: auto
    fail-on: error
```

**Documentation:** See `packages/isl-gate-action/` (Agent 16 owns this)

---

### GitLab CI

**Integration Type:** Template + Component  
**Format:** `gitlab` (GitLab Code Quality JSON)

#### Option 1: Template

Copy `ci-templates/gitlab/.gitlab-ci.yml` into your `.gitlab-ci.yml`:

```yaml
include:
  - local: 'ci-templates/gitlab/.gitlab-ci.yml'
```

#### Option 2: Component

```yaml
include:
  - component: shipgate/isl-verify@v1
    inputs:
      path: src/
      fail_on: error
      mode: auto
      config: .shipgate.yml
```

**Template:**

```yaml
shipgate:
  image: ghcr.io/shipgate/shipgate:v1
  stage: test
  script:
    - shipgate verify src/ --ci --format gitlab > gl-code-quality-report.json
  artifacts:
    reports:
      codequality: gl-code-quality-report.json
    when: always
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

**Verdict Semantics:**
- `SHIP` → No issues reported
- `WARN` → Major severity issues
- `NO_SHIP` → Critical/Blocker severity issues

---

### Bitbucket Pipelines

**Integration Type:** Template + Pipe  
**Format:** `junit` (JUnit XML)

#### Option 1: Template

Copy `ci-templates/bitbucket/bitbucket-pipelines.yml`:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Shipgate ISL Verify
          image: ghcr.io/shipgate/shipgate:v1
          script:
            - shipgate verify src/ --ci --format junit > test-reports/shipgate.xml
          after-script:
            - pipe: atlassian/upload-test-results:0.1.0
              variables:
                FILES: 'test-reports/shipgate.xml'
```

#### Option 2: Pipe

```yaml
- pipe: shipgate/isl-verify:1.0.0
  variables:
    PATH: 'src/'
    FAIL_ON: 'error'
    MODE: 'auto'
    CONFIG: '.shipgate.yml'
```

**Verdict Semantics:**
- `SHIP` → All tests pass
- `WARN` → Tests skipped (warnings)
- `NO_SHIP` → Tests fail

---

### CircleCI

**Integration Type:** Orb  
**Format:** `junit` (JUnit XML)

**Usage:**

```yaml
orbs:
  shipgate: shipgate/isl-verify@1.0.0

workflows:
  verify:
    jobs:
      - shipgate/verify:
          path: src/
          fail_on: error
          mode: auto
```

**Verdict Semantics:**
- `SHIP` → Job passes
- `WARN` → Job passes with warnings
- `NO_SHIP` → Job fails

---

### Jenkins

**Integration Type:** Docker + Jenkinsfile  
**Format:** `junit` (JUnit XML)

**Usage:**

Copy `ci-templates/jenkins/Jenkinsfile`:

```groovy
pipeline {
  agent {
    docker { image 'ghcr.io/shipgate/shipgate:v1' }
  }
  stages {
    stage('Shipgate Verify') {
      steps {
        sh 'shipgate verify src/ --ci --format junit > shipgate-report.xml'
      }
      post {
        always {
          junit 'shipgate-report.xml'
        }
      }
    }
  }
}
```

**Verdict Semantics:**
- `SHIP` → Build passes
- `WARN` → Build passes with warnings
- `NO_SHIP` → Build fails

---

### Azure DevOps

**Integration Type:** Pipeline + Docker  
**Format:** `junit` (JUnit XML)

**Usage:**

Copy `ci-templates/azure/azure-pipelines.yml`:

```yaml
pool:
  vmImage: 'ubuntu-latest'

steps:
  - script: |
      npm install -g shipgate
      shipgate verify src/ --ci --format junit > $(Build.ArtifactStagingDirectory)/shipgate.xml
    displayName: 'Shipgate ISL Verify'

  - task: PublishTestResults@2
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: '$(Build.ArtifactStagingDirectory)/shipgate.xml'
    condition: always()
```

**Verdict Semantics:**
- `SHIP` → All tests pass
- `WARN` → Tests pass with warnings
- `NO_SHIP` → Tests fail

---

### Generic CI (Docker + Bash)

**Integration Type:** Bash script  
**Format:** `json` (Raw JSON)

**Usage:**

```bash
./ci-templates/generic/shipgate-ci.sh [path] [FAIL_ON=error]
```

**Environment Variables:**
- `FAIL_ON`: `error` (default) | `warning` | `unspecced`
- `SHIPGATE_IMAGE`: Docker image (default: `ghcr.io/shipgate/shipgate:v1`)

**Example:**

```bash
FAIL_ON=warning ./shipgate-ci.sh src/
```

**Verdict Semantics:**
- `SHIP` → Exit code 0
- `WARN` → Exit code 0 (or 1 if `FAIL_ON=warning`)
- `NO_SHIP` → Exit code 1

---

## Output Formats

The `shipgate verify` command supports multiple output formats:

```bash
shipgate verify src/ --format <format>
```

**Supported Formats:**

| Format | Description | CI Providers |
|--------|-------------|--------------|
| `json` | Raw JSON (default) | All |
| `gitlab` | GitLab Code Quality JSON | GitLab CI |
| `junit` | JUnit XML | Jenkins, Azure DevOps, Bitbucket, CircleCI |
| `github` | GitHub Actions annotations | GitHub Actions |
| `text` | Human-readable text | Local development |

---

## Exit Codes

| Verdict | Exit Code | Description |
|---------|-----------|-------------|
| `SHIP` | 0 | Verification passed |
| `WARN` | 0 or 4 | Warnings present (0 unless `--fail-on warning`) |
| `NO_SHIP` | 1 | Verification failed |

---

## CLI Options

```bash
shipgate verify [path] [options]

Options:
  --format <format>     Output format: json, text, gitlab, junit, github
  --ci                  CI mode: minimal output, GitHub Actions annotations
  --fail-on <level>     Strictness: error (default), warning, unspecced
  --json                Output structured JSON
  -t, --timeout <ms>    Test timeout (default: 30000)
  -s, --min-score       Minimum trust score (default: 70)
  -d, --detailed        Show detailed breakdown
```

---

## Examples

### Basic Verification

```bash
shipgate verify src/
```

### CI Mode with JUnit Output

```bash
shipgate verify src/ --ci --format junit > test-results.xml
```

### GitLab Code Quality

```bash
shipgate verify src/ --format gitlab > gl-code-quality-report.json
```

### Fail on Warnings

```bash
shipgate verify src/ --fail-on warning
```

---

## Troubleshooting

### Docker Image Not Found

Ensure you're using the correct image tag:

```bash
docker pull ghcr.io/shipgate/shipgate:v1
```

### Permission Denied

Make the generic script executable:

```bash
chmod +x ci-templates/generic/shipgate-ci.sh
```

### No ISL Specs Found

Shipgate works in three modes:
1. **ISL mode** - Code files have matching `.isl` specs
2. **Specless mode** - Code files without specs (uses heuristics)
3. **Mixed mode** - Combination of both

If no specs are found, Shipgate automatically falls back to specless verification.

---

## Links

- **Docker Image:** `ghcr.io/shipgate/shipgate:v1`
- **Documentation:** https://shipgate.dev
- **GitHub:** https://github.com/shipgate/shipgate
