# Changelog

## [3.1.0] - 2026-03-02

### Added
- **Code Provenance** — line-level AI attribution engine (`@isl-lang/code-provenance`)
  - `shipgate provenance` — project-wide AI audit trail (every line → agent + author + timestamp)
  - `shipgate provenance <file>` — file-level blame view with agent badges
  - `shipgate provenance init` — installs pre-commit hook that auto-tags commits with AI-Tool trailers
  - `shipgate provenance --format csv|json` — compliance export for SOC 2 / audit teams
  - Detects 9 AI agents: Cursor, Copilot, Claude Code, Codex, Gemini, Windsurf, Aider, Cody
  - 5 detection methods: commit trailers (high), Co-authored-by (high), provenance session (high), commit message patterns (medium), config file heuristics (low)
- **Zero-config `shipgate go`** — works without API keys via specless mode
  - Automatically falls back to security checks when no ANTHROPIC_API_KEY or OPENAI_API_KEY is set
  - Provenance scan included in every `go` run
- **Dashboard Provenance page** — `/dashboard/provenance` with:
  - Summary cards, pie chart, agent distribution bar chart, trend line
  - File browser with search, pagination, and load-more
  - Line-level blame view with keyboard navigation (j/k, Esc, Ctrl+C to copy as JSON)
  - Confidence badges with color coding and hover tooltips
  - Date range filter and CSV/JSON export with loading states
- **Dashboard API** — 5 new provenance endpoints (`/api/v1/provenance/*`)
- **VS Code provenance panel** — per-file AI attribution in the sidebar
- **GitHub Action provenance output** — PR comments include AI % and top agent
- **Opt-in CLI analytics** via PostHog (disabled by default, `SHIPGATE_ANALYTICS=1`)
- **JSON Schema** for `.shipgate.yml` (`shipgate.schema.json`)
- **Error catalog** documentation (`docs/ERROR_CATALOG.md`) — all E0001-E0712 codes
- **Package maturity index** (`PACKAGES.md`) — tiers every package as Core/Stable/Beta/Experimental
- **Dependabot** configuration for automated dependency updates
- **Docker CI workflow** — builds and smoke-tests api-server and dashboard images

### Changed
- CLI package renamed from `@shipgate/cli` to `shipgate` (matches `npm install -g shipgate`)
- `pnpm audit` in CI is now blocking (removed `continue-on-error`)
- Dashboard nav restructured from 15 flat tabs to 6 primary + grouped "More" dropdown
- README leads with provenance (audit trail) instead of verification
- CLI help text updated to show `shipgate provenance` as second command after `shipgate go`

### Fixed
- Landing page routes wired via react-router-dom (14 pages: /pricing, /security, /about, etc.)
- Landing page route transitions with Framer Motion (shared layout, fade+slide animations)
- npm package name mismatch between docs and actual published name
- Fleshed out empty stub packages: `stdlib-ai`, `stdlib-scheduling`, `ci-docker`

## [2.1.1] - 2026-02-17

### Added
- `shipgate gate` end-to-end SHIP/NO-SHIP verdict with trust scoring
- `shipgate proof badge` — generate SVG/URL badges from proof bundles
- `shipgate proof attest` — SLSA-style attestation JSON for supply chain security
- `shipgate proof comment` — GitHub PR comment generation from proof bundles
- Full-stack ISL constructs: `api`, `storage`, `workflow`, `event`, `handler`, `screen`, `config`
- Execution-proof fallback runner for environments where Vitest cannot run
- Synthetic test suppression — skipped/synthetic tests never produce SHIP verdicts
- `verification_blocked` as a critical failure in the verdict engine

### Fixed
- Trust-score-first decision logic (removed false-positive TYPE_ERROR early exits)
- Test import path resolution (`../src/` → `./src/`)
- `vitest.config.mjs` plain-object format to avoid package resolution failures

### Changed
- Rebuilt CLI bundle with all upstream fixes

## 2.0.0

### Major Changes

- b67276d: # ISL v1.0.0 Release

  First stable release of the Intent Specification Language toolchain.

  ## Core Features
  - Full ISL parser supporting domains, entities, behaviors, types, and contracts
  - Type checker with refinement types and constraints
  - Expression evaluator (95%) for preconditions and postconditions with tri-state logic
  - Test scaffold generation for Vitest/Jest
  - TypeScript type generation from ISL specs
  - Trust score calculation and evidence reports
  - Proof bundles with evaluator traces and SMT transcripts

  ## CLI Commands
  - `isl init` - Initialize a new ISL project
  - `isl parse` - Parse ISL files and display AST
  - `isl check` - Type check ISL specifications
  - `isl gen` - Generate code (TypeScript, OpenAPI, GraphQL)
  - `isl verify` - Verify implementations against specs
  - `isl gate` - SHIP/NO-SHIP gate with evidence bundle
  - `isl heal` - Automatically fix violations
  - `isl build` - Full pipeline: parse → check → gen → verify → evidence
  - `isl fmt` - Format ISL files
  - `isl lint` - Lint ISL files for best practices
  - `isl repl` - Interactive REPL
  - `isl proof verify` - Verify proof bundle integrity

  ## Editor Support
  - VS Code extension (vscode-islstudio) with syntax highlighting
  - LSP server for any editor
  - Real-time diagnostics and completion
  - Heal Until Ship UI

  ## Proof Bundle Enhancements (v2.1)
  - Evaluator decision traces with unknown reason codes
  - SMT solver transcripts (when --smt enabled)
  - Run metadata for reproducibility
  - Import graph and stdlib version tracking

  ## Verified Output
  - "Verified by ShipGate ✓" badge for passing verification

  ## Known Limitations
  - Python/Go codegen generates scaffolds only (full implementation planned for v1.2)
  - SMT solver requires Z3 for external solver; builtin handles basic cases

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-01-31

### Added

- Initial release
- `isl init` - Project initialization
- `isl check` - Parse and type-check ISL files
- `isl generate` - Code generation for multiple targets
- `isl verify` - Formal verification
- `isl repl` - Interactive REPL
- `isl format` - Code formatting
- `isl lsp` - Language server
- Configuration file support (isl.config.yaml)
