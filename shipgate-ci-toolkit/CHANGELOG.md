# Changelog

All notable changes to the ShipGate CI Toolkit will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-01-15

### Initial Release

**CLI**
- `shipgate gate <spec> --impl <path>` — core SHIP/FAIL verdict command
- `shipgate verify <spec> --impl <path>` — behavioral verification only
- `shipgate check <spec>` — spec parse and type-check without verification
- `shipgate heal <spec> --impl <path>` — auto-fix flagged findings
- `shipgate trust-score <spec> --impl <path>` — emit trust score and confidence only
- `shipgate drift <spec> --impl <path>` — detect spec-to-implementation drift
- `shipgate coverage <spec>` — report behavioral spec coverage percentage
- `shipgate compliance soc2 <spec>` — SOC2 control mapping report
- `shipgate lint <specs-dir>` — lint ISL spec files for quality issues
- `shipgate fmt <specs-dir>` — auto-format ISL spec files

**Output Contract**
- Canonical `shipgate-report.schema.json` — all gate commands produce a conforming output
- Consistent `verdict: PASS | WARN | FAIL` across all commands
- `score: 0–100`, `confidence: 0–100`
- Structured `findings[]` with `id`, `title`, `severity`, `file`, `line`, `evidence`, `recommendation`
- Deterministic `fingerprint` derived from spec + impl + results hashes

**Presets**
- `baseline` — 90 threshold, 4 core gates, standard policy
- `strict` — 95 threshold, all gates enabled, fail-on-warn
- `ai-heavy` — 80 threshold, aggressive placeholder + drift detection

**CI Integration**
- GitHub Actions workflow template
- GitLab CI template with Code Quality artifact
- CircleCI orb config
- Output formats: JSON, JUnit XML, GitLab Code Quality JSON

**Git Hooks**
- `pre-commit.sh` — gate staged specs before commit
- `pre-push.sh` — full gate before push to protected branches

**Demo**
- `examples/demo-repo/` — runnable UserService spec + implementation
- `examples/expected-output/shipgate.report.json` — expected PASS output

**VS Code Extension**
- Sidebar with real-time scan results
- Actions tab with all CLI commands
- Findings tab with inline autofix buttons
- Status bar with current verdict

---

## Upcoming

- `[1.1.0]` Gate Pack: AI Hallucination (fake-route, placeholder-response, hardcoded-ID detection)
- `[1.1.0]` Gate Pack: Security Baseline (OWASP Top 10 patterns, SQLi, secret exposure)
- `[1.2.0]` CI Pack: Azure DevOps pipeline template
- `[1.2.0]` CI Pack: Bitbucket Pipelines template
- `[1.3.0]` Property-Based Testing (PBT) gate — GA
- `[2.0.0]` Multi-file spec support with cross-domain verification
