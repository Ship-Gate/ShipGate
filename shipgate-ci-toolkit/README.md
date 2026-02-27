# ShipGate CI Toolkit

**Local & CI quality gates for AI-written code. One command. One verdict: SHIP or NO-SHIP.**

---

## What ShipGate Is

ShipGate runs behavioral verification and static analysis gates against your codebase and produces a single structured verdict: **SHIP** (all gates pass) or **NO-SHIP** (blocking issues found).

It works locally and in CI. Output is always JSON. Exit code is always meaningful (0 = SHIP, 1 = NO-SHIP).

ShipGate is built for teams shipping AI-assisted code who need confidence that what they're deploying actually matches what they specified — not just that it lints.

---

## Install

```bash
npm install -g @shipgate/cli
shipgate --version
```

---

## Quickstart

```bash
# Gate your implementation against a spec
shipgate gate specs/user-auth.isl --impl src/auth --threshold 90

# Full project scan
shipgate gate specs/ --impl src --threshold 90 --output .shipgate/report.json

# CI mode (JSON to stdout, exit 1 on FAIL)
shipgate gate specs/ --impl src --threshold 90 --ci
```

See [QUICKSTART.md](./QUICKSTART.md) for the full onboarding flow.

---

## Presets Explained

| Preset     | Threshold | Gates Active                       | Best for                              |
|------------|-----------|-------------------------------------|---------------------------------------|
| `baseline` | 90        | behavioral, auth, placeholder, env  | First gate, feature branches          |
| `strict`   | 95        | all gates                           | Main branch protection, releases      |
| `ai-heavy` | 80        | baseline + drift + chaos (relaxed)  | Fully AI-generated codebases          |

Presets are defined in `configs/presets/`. You can override any setting in your project's `.islrc.json`.

---

## What Gates Check

| Gate          | Blocks ship when...                                                           |
|---------------|-------------------------------------------------------------------------------|
| `behavioral`  | Any spec scenario fails verification, or trust score below threshold          |
| `auth`        | Routes marked `authenticated` in spec have no auth guard in implementation    |
| `placeholder` | Behaviors map to stub implementations (`return null`, TODO, hardcoded values) |
| `env`         | Secrets or API keys are hardcoded in source files                             |
| `drift`       | Spec behaviors have no implementation, or impl has undeclared behaviors       |
| `chaos`       | I/O operations lack error handling, cascading failure paths detected          |

Full gate reference: [gates/enabled-gates.md](./gates/enabled-gates.md)

---

## CI Integration

Copy the template for your CI provider:

```bash
# GitHub Actions
cp ci/github-actions/shipgate.yml .github/workflows/shipgate.yml

# GitLab CI
cp ci/gitlab/shipgate.yml .gitlab-ci.yml   # adds Code Quality artifact

# CircleCI
cp ci/circleci/config.yml .circleci/config.yml
```

---

## Git Hooks

```bash
# Gate staged specs before commit
cp hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

# Full gate before push to main/master
cp hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

---

## Output Schema

Every ShipGate command that produces a verdict conforms to `schemas/shipgate-report.schema.json`.

Core fields:

```json
{
  "verdict":    "PASS | WARN | FAIL",
  "score":      0-100,
  "confidence": 0-100,
  "summary":    { "total", "passed", "failed", "skipped", "blockerCount" },
  "gates":      [ { "id", "name", "status", "weight", "findingsCount", "score" } ],
  "findings":   [ { "id", "title", "severity", "category", "file", "line", "evidence", "recommendation" } ],
  "metadata":   { "toolVersion", "preset", "threshold", "timestamp", "fingerprint", "git" }
}
```

---

## Troubleshooting

**"Required ISL packages not available"** — Run `npm install` in your project root.

**"Confidence X% below minimum"** — Add more test scenarios to your ISL spec. ShipGate needs at least 2 passing scenarios before it trusts the score.

**Gate returns FAIL despite high score** — Check `results.blockers` in the JSON output. A policy violation overrides the score regardless of threshold.

**CI shows FAIL on first run** — Start with `--threshold 90 --threshold 80` and increase the threshold as you improve coverage.

---

## Key Commands

```bash
shipgate --version
shipgate gate <spec> --impl <dir> --threshold 90
shipgate gate <spec> --impl <dir> --threshold 95 --threshold 95 --ci
shipgate gate <spec> --impl <dir> --format json --out report.json
shipgate verify <spec> --impl <dir>
shipgate check <spec>
shipgate heal <spec> --impl <dir>
shipgate drift <spec> --impl <dir>
shipgate coverage <spec>
shipgate trust-score <spec> --impl <dir>
shipgate lint specs/
shipgate fmt specs/
shipgate compliance soc2 <spec>
```

---

## License

See [LICENSE.txt](./LICENSE.txt). Commercial use requires Pro (Tier B) or Team (Tier C) license.
