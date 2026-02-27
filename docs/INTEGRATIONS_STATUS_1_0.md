# Integrations Status — Release 1.0

**Purpose:** Reality check of what integrations are actually compatible with Shipgate/ISL 1.0. No vague claims.

**CLI identity (1.0):** The CLI is published to npm as **`shipgate`** (package name `shipgate`, bins `shipgate` and `isl`). Use `npx shipgate` or `npx isl` after installing `shipgate`. There is no published package `@isl-lang/cli` for 1.0.

---

## 1. GitHub Action

### 1.1 Composite action: `.github/actions/isl-gate`

| Check | Status | Details |
|-------|--------|--------|
| CLI name/version | ✅ Fixed | Install step must use **`shipgate`** (see note below). Action runs `npx isl gate <spec> --impl <impl> --threshold <n> --output ./evidence --format json`. |
| Expected outputs | ✅ Match | Action reads: `decision`, `trustScore`, `manifest.fingerprint`. CLI `gate` command JSON returns: `decision`, `trustScore`, `manifest.fingerprint`, `manifest.specHash`, `manifest.implHash`, `manifest.timestamp`, `results`, `summary`, etc. `jq -r '.decision'`, `.trustScore`, `.manifest.fingerprint` work. |
| Verdicts | ✅ | SHIP / NO-SHIP; exit code 0/1. Action fails step when `fail-on-no-ship` is true and decision is NO-SHIP. |

**Note:** The composite action’s install step was updated to use `shipgate` (the published 1.0 CLI). If you see `@isl-lang/cli` in any workflow, replace with `shipgate` for 1.0.

**Classification:** **Supported ✅** for 1.0, provided workflows install `shipgate` and run the composite action as documented.

---

### 1.2 Package: `@isl-lang/github-action` (ISL Verify action)

| Check | Status | Details |
|-------|--------|--------|
| Calls CLI? | ⚠️ Yes, but API mismatch | Runs `npx isl verify --specs <specs> --implementation <impl> --format json`. |
| CLI interface | 🔴 Mismatch | Shipgate CLI `verify` takes `[path]` and `--spec` / `--impl` (singular), not `--specs` / `--implementation`. Output shape: CLI returns `verdict`, `score`, `coverage`, `files`, `blockers`, `recommendations`, `duration`, `exitCode`; action expects `verdict`, `score`, `coverage`, `errors`, `warnings`, `proofBundle`. |

**Classification:** **Not included 🔴** for 1.0. The action’s CLI invocation and output parsing do not match the shipgate 1.0 CLI. Use the composite action (1.1) or `@isl-lang/isl-gate-action` (1.3) for gate/verify in CI.

---

### 1.3 Package: `@isl-lang/isl-gate-action` (ShipGate verify)

| Check | Status | Details |
|-------|--------|--------|
| CLI discovery | ✅ | Tries `npx shipgate`, `npx isl`, then `node_modules/.bin/shipgate`, `node_modules/.bin/isl`. Correct for 1.0. |
| Invocation | ✅ | Runs `shipgate verify <path> --json --ci`. |
| JSON shape | ✅ | Expects `verdict`, `score`, `coverage`, `files[]`, `blockers`, `recommendations`, `duration`, `exitCode`. CLI `verify --json`/`--ci` outputs exactly this via `printUnifiedJSON`. |

**Classification:** **Supported ✅** for 1.0. Ensure the workflow installs the CLI (e.g. `npm install -g shipgate` or dependency on `shipgate`) so `npx shipgate` or `npx isl` resolves.

---

### 1.4 Package: `@isl-lang/github-action-gate` (Shipgate Gate)

| Check | Status | Details |
|-------|--------|--------|
| CLI | 🔴 Different product | Uses `npx shipgate gate --ci --output json`. Targets **Shipgate**, not the shipgate CLI. |

**Classification:** **Not included 🔴** in Shipgate 1.0. This is an legacy ISL Studio–specific integration.

---

### 1.5 Workflow: `.github/workflows/isl-gate.yml`

Uses **`packages/verified-build`** (`run-unified-gate.mjs`), not the composite action or the shipgate CLI. It is a monorepo-specific gate (build + Node script). Document as needed for internal CI; not an “integration” with the public CLI.

---

## 2. VS Code extension

| Check | Status | Details |
|-------|--------|--------|
| Calls CLI? | ✅ N/A | Extension does **not** invoke the CLI. It uses the in-process **LSP** (Language Server) via `vscode-languageclient` and the request `isl/validate`. Validation is done by the bundled LSP server. |
| 1.0 compatibility | ✅ | No dependency on the shipgate CLI. Works with 1.0 as long as the extension and LSP server build and run. |

**Classification:** **Supported ✅** for 1.0. VS Code extension is part of 1.0; no CLI required.

---

## 3. MCP server

| Check | Status | Details |
|-------|--------|--------|
| Handshake | ✅ | Uses `@modelcontextprotocol/sdk` with `StdioServerTransport` and `server.connect(transport)`. Standard MCP stdio handshake. |
| Basic command path | ✅ | Tools implemented in-process (e.g. `core.js`: scan, verifySpec, proofPack, proofVerify, gen; pipeline: handleBuild, handleVerify, handleGate). No CLI subprocess. Tool list includes: `scan`, `verify`, `proof_pack`, `proof_verify`, `gen`, `isl_check`, `isl_generate`, `isl_constraints`, `isl_suggest`, `isl_build`, `isl_verify`, `isl_gate` (plus optional translator tools). |
| Cursor config | ✅ | `.cursor/mcp.json` points to `packages/mcp-server/dist/index.js`. Requires `pnpm build` (or equivalent) in `packages/mcp-server` before use. |

**Classification:** **Experimental 🟡** for 1.0. Handshake and tool path verified; no coverage/readiness guarantee in repo. Document as “build required” and “experimental” for 1.0.

---

## Summary table

| Integration | Status | Notes |
|-------------|--------|--------|
| `.github/actions/isl-gate` (composite) | ✅ Supported | Use install `shipgate`; outputs/verdicts match CLI. |
| `@isl-lang/isl-gate-action` | ✅ Supported | CLI discovery and verify JSON match shipgate 1.0. |
| `@isl-lang/github-action` (ISL Verify) | 🔴 Not included | CLI args and output shape don’t match shipgate 1.0. |
| `@isl-lang/github-action-gate` (Shipgate legacy) | 🔴 Not included | Uses old CLI interface, not shipgate 1.0. |
| VS Code extension (`packages/vscode`) | ✅ Supported | LSP only; no CLI. |
| MCP server (`packages/mcp-server`) | 🟡 Experimental | Stdio handshake + tools verified; build required; experimental for 1.0. |

---

## References

- CLI package: `packages/cli/package.json` (name: `shipgate`, bin: `shipgate`, `isl`)
- Gate JSON shape: `packages/cli/src/commands/gate.ts` (`GateResult`, `printGateResult` with `format === 'json'`)
- Verify JSON shape: `packages/cli/src/commands/verify.ts` (`printUnifiedJSON`: verdict, score, coverage, files, blockers, recommendations, duration, exitCode)
- MCP server entry: `packages/mcp-server/src/index.ts` (Server, StdioServerTransport, tool handlers)
- VS Code validate: `packages/vscode/src/commands/validate.ts` (LSP `isl/validate`, no CLI)

*Last verified: 1.0 integrations reality check (Agent 15).*
