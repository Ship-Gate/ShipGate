<p align="center">
  <strong>shipgate</strong> — the last gate before production for AI-written code.
</p>

<p align="center">
  <a href="https://badge.fury.io/js/shipgate"><img src="https://badge.fury.io/js/shipgate.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/Ship-Gate/ShipGate/actions"><img src="https://github.com/Ship-Gate/ShipGate/actions/workflows/shipgate.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <img src="https://vhs.charm.sh/vhs-2kRF2qC1pB5NkxepJTpOCu.gif" alt="ShipGate terminal demo — vibe, scan, gate" width="900">
</p>

---

## Know exactly who wrote every line of your code

ShipGate gives enterprises the audit trail they need to adopt AI coding tools with confidence. Every line of code is attributed to its authoring agent (Claude, Copilot, Codex, Gemini, Windsurf, etc.), the human who prompted it, and when.

```bash
npm install -g shipgate

# Zero config. No API keys needed. Works immediately:
shipgate go

# See every line, every agent, every author:
shipgate provenance
```

```
  Code Provenance Report
  Repository: acme/payments-api
  Branch: main (abc1234)

  Attribution Summary
  Total lines:     12,847
  Human-authored:   4,231 (32.9%)
  AI-assisted:      8,616 (67.1%)

  By AI Agent
  Cursor/Claude:    5,420 (42.2%)
  GitHub Copilot:   2,891 (22.5%)
  Claude Code:        305 (2.4%)

  By Operator
  john@acme.com:    6,200 (48.3%)  -- 71% AI-assisted
  jane@acme.com:    4,100 (31.9%)  -- 65% AI-assisted
```

When your CISO asks "how much of our codebase was written by AI, and which AI?" — ShipGate answers that question, line by line, with confidence levels.

---

## The Problem

AI coding assistants generate code that compiles, passes linting, and looks correct — but:

- **No audit trail** — You can't tell which lines were AI-generated vs human-written
- **Ghost routes** — API endpoints referenced in code that don't exist
- **Ghost env vars** — `process.env.STRIPE_KEY` accessed but never declared
- **Auth bypasses** — Public endpoints that should require authentication

Linters can't catch these. Tests can't catch what they don't know to test. You need a behavioral gate with a full audit trail.

## How It Works

```
detect → scan (zero-config) → provenance → gate → SHIP or NO_SHIP
```

1. **Zero-config scan** — ShipGate works immediately. No API keys, no specs, no setup. Specless mode runs security checks, hallucination detection, and provenance scanning out of the box.
2. **AI attribution** — Every line is mapped to its author, AI agent, and timestamp using git blame + commit metadata analysis.
3. **Gate the merge** — SHIP (exit 0) or NO_SHIP (exit 1) with a tamper-proof evidence bundle.
4. **Go deeper** — Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for AI-generated behavioral specs and deeper verification.

## Quick Start

```bash
npm install -g shipgate

# Zero config — works immediately:
shipgate go

# AI audit trail — every line attributed:
shipgate provenance

# Line-level blame for a specific file:
shipgate provenance src/api/users.ts

# Install pre-commit hook for automatic AI tagging:
shipgate provenance init

# From natural language to verified code:
shipgate vibe "build a todo API with auth and JWT"
```

## Commands

| Command | What it does |
|---------|-------------|
| `shipgate go [path]` | **Zero-config gate.** Detect → scan → provenance → gate. No API keys needed. |
| `shipgate provenance` | **AI audit trail.** Every line attributed to agent + author + timestamp. |
| `shipgate provenance <file>` | Line-level blame view for a single file. |
| `shipgate provenance init` | Install pre-commit hook for automatic AI-Tool tagging. |
| `shipgate provenance --format csv` | Export audit trail for compliance teams. |
| `shipgate go --fix` | Go + auto-heal violations |
| `shipgate go --deep` | Go with thorough scan |
| `shipgate vibe "<prompt>"` | NL → ISL spec → full-stack code → verify → SHIP/NO_SHIP |
| `shipgate scan <path>` | Full project scan with ISL spec generation |
| `shipgate verify <path>` | Verify implementation against specs |
| `shipgate gate <spec> --impl <path>` | Binary SHIP/NO_SHIP verdict for CI |
| `shipgate gen ts <file.isl>` | Generate TypeScript from ISL (also: python, rust, go, graphql, openapi) |
| `shipgate heal <path>` | AI-powered auto-fix for spec violations |

## Why ISL?

ISL (Intent Specification Language) captures *what your code must do* — preconditions, postconditions, invariants — not just what it looks like. It's the contract AI must satisfy.

```isl
domain PaymentService {
  behavior ChargeCard {
    preconditions  { input.amount > 0  }
    postconditions { success implies Payment.exists({ id: result.paymentId }) }
  }
}
```

## Ship Score

Every verification produces a **Ship Score** (0–100) based on spec coverage, policy compliance, and verification depth. `SHIP` requires >= 70. Below that: `NO_SHIP` with a list of exactly what to fix.

## CI Integration

Add to any GitHub Actions workflow:

```yaml
- name: ShipGate
  run: npx shipgate go . --ci
```

Or use the full workflow generated by `shipgate init`, which uploads evidence bundles as artifacts and posts verdict comments on PRs.

## Dashboard

The ShipGate dashboard (`packages/shipgate-dashboard`) is a full Next.js 14 web application with:

- **GitHub/Google OAuth** login with cookie-based sessions
- **RBAC** — admin, member, viewer roles per organization
- **GitHub integration** — Connect GitHub accounts, view repos, PRs, and commits directly in the dashboard
- **Slack integration** — Connect a Slack workspace and configure notification rules (channel + event type)
- **Deployment tracking** — Webhook-based integration with Vercel and Railway; real-time deployment status feed
- **Overview dashboard** — Sparkline trend charts on stat cards, verdict breakdown donut chart, activity feed, and integration status strip
- **Vibe pipeline** — Run NL → ISL → verified code from the browser
- **Stripe billing** — Pro subscription gating with checkout flow
- **Audit logging** — All actions logged with IP, user agent, request ID

```bash
cd packages/shipgate-dashboard
cp .env.example .env.local   # Add your OAuth + integration credentials
pnpm dev
# Open http://localhost:3001
```

See `packages/shipgate-dashboard/.env.example` for all required environment variables including GitHub OAuth, Google OAuth, Stripe, Slack, and token encryption keys.

## VS Code Extension

Install from the VS Code Marketplace or build from source:

```bash
ext install shipgate.shipgate-isl
```

The sidebar gives you one-click access to every command:

- **Actions** panel — buttons for Go, Vibe, Scan, Gen, Heal
- **Overview** — animated ship score, coverage stats, verdict
- **Files** — per-file pass/warn/fail breakdown
- **Claims** — individual spec claim verification status
- **Pipeline** — CI run history and environment details

Keyboard shortcuts: `Cmd+Shift+Enter` for `shipgate go`, `Cmd+Shift+V` for Vibe.

## MCP / AI Firewall

ShipGate runs as an MCP server that intercepts AI suggestions in real time:

```json
{
  "mcpServers": {
    "shipgate": {
      "command": "npx",
      "args": ["-y", "shipgate-mcp"]
    }
  }
}
```

Every suggestion is checked against your Truthpack (routes, env vars, auth rules) and 27 policy rules. Ghost routes get `BLOCK`. Missing auth gets `WARN`. Clean code gets `ALLOW`.

## Multi-Language Codegen

Generate from ISL specs or from natural language — 6 targets:

```bash
shipgate gen ts auth.isl           # TypeScript
shipgate gen python auth.isl       # Python (Pydantic, pytest)
shipgate gen rust auth.isl         # Rust (Serde, traits)
shipgate gen go auth.isl           # Go (structs, interfaces)
shipgate gen graphql auth.isl      # GraphQL schema
shipgate gen openapi auth.isl      # OpenAPI 3.0

shipgate vibe "REST API" --lang python   # NL → Python project
shipgate vibe "REST API" --lang rust     # NL → Rust project
```

## Code Provenance (AI Audit Trail)

The provenance system gives enterprises complete visibility into AI-generated code:

- **Line-level attribution** — Every line mapped to its AI agent, human operator, and timestamp
- **Agent detection** — Identifies Cursor, Copilot, Claude Code, Codex, Gemini, Windsurf, Aider, and Cody
- **Multiple detection methods** — Git commit trailers (highest confidence), Co-authored-by headers, commit message patterns, provenance session files
- **Pre-commit hook** — `shipgate provenance init` installs a hook that automatically tags commits with `AI-Tool`, `AI-Session`, and `AI-Operator` trailers
- **Export** — CSV and JSON export for compliance teams, auditors, and SOC 2 evidence packages
- **Dashboard** — Full web UI with pie charts, agent distribution, trend lines, file browser, and line-level blame view

See the [provenance dashboard](/dashboard/provenance) or run `shipgate provenance --format csv > audit.csv` for a compliance export.

## Architecture

ShipGate is a monorepo (pnpm workspaces + Turborepo). Every package has a maturity tier — see [PACKAGES.md](PACKAGES.md) for the full index.

### Core Packages (production-ready)

| Package | Purpose |
|---------|---------|
| `cli` | Full CLI: go, vibe, scan, verify, gate, provenance, heal |
| `core` | Central verification engine |
| `isl-gate` | SHIP/NO_SHIP gate engine with trust scoring |
| `code-provenance` | Line-level AI attribution engine |
| `isl-verify` | Verification runner |
| `parser` | ISL recursive descent parser |
| `isl-pipeline` | Verification pipeline orchestration |
| `typechecker` | ISL type system |

### Package Categories

| Category | Count | Examples |
|----------|-------|---------|
| **Core engine** | 11 | `core`, `cli`, `isl-gate`, `code-provenance`, `isl-verify` |
| **ISL language** | 38 | `isl-core`, `isl-pipeline`, `isl-proof`, `isl-pbt`, `isl-healer` |
| **Code generation** | 30 | `codegen-graphql`, `codegen-grpc`, `codegen-terraform`, `codegen-python`, `codegen-rust`, `codegen-go` |
| **Standard library** | 31 | `stdlib-auth`, `stdlib-billing`, `stdlib-ai`, `stdlib-scheduling`, `stdlib-workflow` |
| **Verifiers** | 6 | `verifier-chaos`, `verifier-temporal`, `verifier-formal`, `verifier-security` |
| **SDKs** | 8 | `sdk-flutter` (Dart), `sdk-kotlin`, `sdk-swift`, `sdk-python`, `sdk-typescript`, `sdk-web` |
| **Security** | ~8 | `security-scanner`, `secrets-hygiene`, `hallucination-scanner` |
| **Dashboard** | 3 | `shipgate-dashboard`, `dashboard-api` |

### Top 10 Packages by Size

| Package | Lines | Purpose |
|---------|-------|---------|
| `core` | 61,830 | Central verification engine, spec processing, rule evaluation |
| `cli` | 46,174 | Full CLI: go, vibe, scan, verify, gate, gen, heal, policy |
| `test-generator` | 13,236 | Generates executable tests from ISL specs |
| `isl-gate` | 12,512 | SHIP/NO_SHIP gate engine with trust scoring |
| `isl-healer` | 11,565 | AI-powered auto-fix for spec violations |
| `shipgate-dashboard` | 11,300 | Next.js web dashboard with integrations |
| `isl-expression-evaluator` | 11,383 | Evaluates ISL postconditions against real values |
| `isl-pipeline` | 11,253 | Orchestrates the full verification pipeline |
| `verifier-chaos` | 10,771 | Chaos testing with fault injection |
| `isl-pbt` | 10,264 | Property-based testing engine |

## Project Structure

| Path | Purpose |
|------|---------|
| `packages/` | 248 packages — the full platform |
| `packages/shipgate-dashboard/` | Next.js 14 web dashboard |
| `packages/core/` | Core verification engine |
| `packages/cli/` | CLI binary (`shipgate`) |
| `docs/` | 146 documentation files |
| `samples/` | ISL spec samples and tutorials |
| `demos/` | Demo projects and showcases |
| `stdlib/` | ISL standard library definitions |
| `.shipgate.yml` | Config: CI behavior, ignore patterns, thresholds |
| `.shipgate/specs/` | ISL specifications |
| `.shipgate/evidence/` | Evidence bundles per verification run |
| `.shipgate/truthpack/` | Auto-extracted routes, env vars, auth rules |

## Links

- [Docs](https://shipgate.dev/docs) — Full documentation
- [ISL Reference](https://shipgate.dev/docs/isl) — Language specification
- [GitHub](https://github.com/Ship-Gate/ShipGate) — Source code
- [npm](https://www.npmjs.com/package/shipgate) — Package registry

## License

MIT
