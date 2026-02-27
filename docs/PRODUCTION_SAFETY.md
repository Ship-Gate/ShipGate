# Production Safety: Ensuring All AI Code Is Safe

This document describes how to ensure **every** line of AI-written code is checked and deemed safe for production.

## Overview

IntentOS provides two complementary safety layers:

| Layer | When to use | What it checks |
|-------|-------------|----------------|
| **Spec gate** | When you have an ISL spec | Correctness: spec ↔ implementation (pre/post conditions, invariants) |
| **Firewall** | Always (any file) | Security & policy (auth, PII, secrets, routes, env, imports) |

To get to "100% safe for production":

1. **In the IDE**: Every AI edit is checked by the firewall (via Cursor rule or MCP).
2. **In CI**: A single unified gate runs both the spec gate (when a spec exists) and the firewall on changed files. **NO_SHIP** if either fails.

## When to Use Which Gate

- **Spec gate only** (`runAuthoritativeGate`): Use when you have an ISL spec and want to verify implementation against it. Requires `spec` and `implementation` paths.
- **Firewall only** (e.g. `verifyBuild` with no spec): Use when you have no ISL spec (legacy or ad-hoc code). All code is checked against policy packs and truthpack (routes, env, imports).
- **Unified gate** (`runUnifiedGate`): Use in CI or when you want one verdict for "all AI code". Runs spec gate when a spec exists and always runs the firewall on the given files. Single **SHIP**/ **NO_SHIP**; **NO_SHIP** if either path fails.

## Enabling the Cursor Rule (Firewall on Every AI Write)

The rule in [.cursor/rules/ai-code-safety.mdc](../.cursor/rules/ai-code-safety.mdc) instructs the AI to:

- Call the MCP firewall (`firewall_quick_check` or `firewall_evaluate`) for each modified file before or after applying changes.
- Not leave code in place if the result is **NO_SHIP** or not allowed; fix or revert.

To rely on it:

1. Ensure the ISL MCP server (with firewall tools) is configured in Cursor so the AI can call `firewall_quick_check` / `firewall_evaluate`.
2. The rule is `alwaysApply: true`, so it applies to all conversations in this workspace.

If the firewall is not available, the rule tells the AI to apply equivalent checks manually (no hardcoded secrets, no auth bypass, no PII in logs, etc.).

## How CI Runs the Unified Job

Both [ISL Gate](../.github/workflows/isl-gate.yml) and [Unified Gate](../.github/workflows/unified-gate.yml) workflows are single entry points for "all AI code": they run the same unified gate (spec + firewall). Use either one; **ISL Gate** is the default name.

1. **On PR** (or manual dispatch): The workflow runs the **Unified Gate** job.
2. **Spec path**: If a spec file exists (e.g. `specs/*.isl` or first `.isl` found), it runs the **authoritative gate** (parser → typechecker → verifier).
3. **Firewall path**: It runs the **firewall** (verified-build) on all changed `.ts`/`.js`/`.tsx`/`.jsx` files.
4. **Merge**: Verdict is **NO_SHIP** if either the spec gate or the firewall returns **NO_SHIP**. Score and reasons are combined. One verdict and one evidence story (see **Unified verdict and evidence** below).
5. **Enforce**: The job fails (exit 1) when the verdict is **NO_SHIP**, blocking merge.

### Running the unified gate locally

From the repo root, after building:

```bash
pnpm --filter @isl-lang/gate build
pnpm --filter @isl-lang/verified-build build
cd packages/verified-build
PROJECT_ROOT=/path/to/repo SPEC=specs/main.isl IMPL=. CHANGED_FILES="src/a.ts
src/b.ts" node run-unified-gate.mjs
```

Output is a JSON object (combined verdict, sources, score, reasons). Exit code is 0 (SHIP) or 1 (NO_SHIP). A combined evidence manifest is written to `evidence/unified-manifest.json` (verdict, sources, reasons, timestamps) for audits.

### Unified verdict and evidence

The combined verdict contract is `CombinedVerdictResult`: `{ verdict, exitCode, sources, score, reasons, evidencePath?, specResult?, firewallResult? }`. CI and tooling emit one verdict; when `writeBundle` is true, a single **unified manifest** is persisted at `evidence/unified-manifest.json` so audits have one place to look.

### Spec-optional gate mode

When you call the authoritative gate without a valid spec (e.g. legacy or ad-hoc code), use **spec-optional** so it does not throw:

- **`runUnifiedGate`** without `spec`: only the firewall runs; you get one SHIP/NO_SHIP from policy and truthpack.
- **`runAuthoritativeGate`** with `specOptional: true` and missing spec: returns SHIP with reason "no spec provided" (so CI does not block); run the unified gate or firewall separately for full checks.

### Optional: dependency audit

When running the **authoritative gate** or the **unified gate** (with a spec), you can enable dependency audit so that critical vulnerabilities cause **NO_SHIP**:

```typescript
import { runAuthoritativeGate } from '@isl-lang/gate';
import { runUnifiedGate } from '@isl-lang/verified-build';

// Authoritative gate only
const result = await runAuthoritativeGate({
  projectRoot: process.cwd(),
  spec: 'specs/main.isl',
  implementation: 'src/',
  dependencyAudit: true,  // run pnpm audit; critical vulns = NO_SHIP
});

// Unified gate (spec + firewall)
const unified = await runUnifiedGate({
  projectRoot: process.cwd(),
  spec: 'specs/main.isl',
  implementation: 'src/',
  dependencyAudit: true,  // passed to spec gate when spec exists
});
```

This is optional and off by default so teams can opt in.

## Summary

| Step | What | Result |
|------|------|--------|
| **IDE** | Cursor rule + (optional) MCP firewall | Every AI edit checked before/after write |
| **CI** | Unified Gate workflow | Spec gate (when spec) + firewall on changed files → one SHIP/NO_SHIP |
| **No spec?** | Use `runUnifiedGate` without `spec`, or only firewall/verified-build | Code without ISL is still gated by policy and truthpack |

With the unified workflow and the Cursor rule, all AI-written code can be required to pass the firewall (and spec-based verification where a spec exists) before it is considered production-ready.
