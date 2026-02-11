# Shipgate Case Studies

> Evidence that Shipgate catches real bugs before production.

## Purpose

Case studies demonstrate:
- **Ghost features caught** — AI-generated code referencing non-existent routes, env vars, imports
- **Security violations blocked** — Auth bypass, hardcoded credentials, PII in logs
- **Policy violations fixed** — Missing rate limits, audit logging, input validation

## Template

Use `TEMPLATE.md` when adding a new case study.

## Published Case Studies

| # | Title | Rule(s) | Severity | Status |
|---|-------|---------|----------|--------|
| 001 | [Ghost Route Caught Before Merge](001-ghost-route-caught.md) | `ghost-route` | high | published |
| 002 | [Auth Bypass Blocked Before Merge](002-auth-bypass-blocked.md) | `auth/bypass-detected` | critical | published |
| 003 | [PII in Logs Blocked Before Merge](003-pii-in-logs-blocked.md) | `pii/console-in-production` | critical | published |

## Metrics to Collect

- **Blocked PRs** — Count of PRs that would have shipped broken code
- **Violations by rule** — Which rules catch the most issues
- **Healer success rate** — % of violations auto-fixed by `isl heal`
- **Trust score over time** — Spec-guided vs AI-only code

## Evidence Bundles

Evidence bundles are stored in `.shipgate/runs/` and `.vibecheck/runs/`. Use `shipgate evidence export` (when available) for anonymized metrics.
