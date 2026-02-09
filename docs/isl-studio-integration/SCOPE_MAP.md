# ISL Studio Integration - Scope Map

**Generated:** 2026-02-01  
**Source:** ShipGate-Real (C:\Users\mevla\OneDrive\Desktop\ShipGate-Real)  
**Target:** ISL Studio (c:\Users\mevla\OneDrive\Desktop\IntentOS)  
**Author:** ISL Studio Integrator

---

## Executive Summary

This document maps the ShipGate codebase to identify modules for porting to ISL Studio. The filter criteria:
- **Gate Decision**: Blocking/allowing changes (SHIP/NO_SHIP)
- **Evidence Artifacts**: Producing reports/bundles for audit
- **Firewall Governance**: Agent file write interception
- **Policy Pack Rules**: Concrete verification rules

---

## KEEP (Ported)

### 1. Core Gate/Ship Decision Engine

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/core/src/scoring/ship-score.ts` | 6-dimension ship score calculator | `packages/isl-gate/src/scoring/ship-score.ts` | Gate decision |
| `packages/core/src/scoring/isl-scorer.ts` | ISL conformance scorer | `packages/isl-gate/src/scoring/isl-scorer.ts` | Gate decision |
| `packages/core/src/scoring/unified-scorer.ts` | Pass rate & health status | `packages/isl-gate/src/scoring/unified-scorer.ts` | Gate decision |
| `packages/core/src/scoring/category-scorer.ts` | Category-level scoring | `packages/isl-gate/src/scoring/category-scorer.ts` | Gate decision |
| `packages/core/src/scoring/index.ts` | Scoring exports | `packages/isl-gate/src/scoring/index.ts` | Gate decision |

**Rationale:** These are the core decision-making modules that produce SHIP/WARN/BLOCK verdicts.

### 2. Firewall (Agent Write Governance)

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/core/src/firewall/agent-firewall.ts` | Central firewall orchestrator | `packages/isl-firewall/src/agent-firewall.ts` | File write interception |
| `packages/core/src/firewall/policy-engine.ts` | Policy evaluation engine | `packages/isl-firewall/src/policy-engine.ts` | Firewall decisions |
| `packages/core/src/firewall/claim-extractor.ts` | Extract verifiable claims from code | `packages/isl-firewall/src/claim-extractor.ts` | Firewall analysis |
| `packages/core/src/firewall/evidence-resolver.ts` | Resolve evidence for claims | `packages/isl-firewall/src/evidence-resolver.ts` | Firewall verification |
| `packages/core/src/firewall/intent-validator.ts` | Validate agent intents | `packages/isl-firewall/src/intent-validator.ts` | Firewall filtering |
| `packages/core/src/firewall/unblock-planner.ts` | Generate unblock plans | `packages/isl-firewall/src/unblock-planner.ts` | Firewall UX |
| `packages/core/src/firewall/allow-list.ts` | Allowed path patterns | `packages/isl-firewall/src/allow-list.ts` | Firewall filtering |
| `packages/core/src/firewall/confidence.ts` | Confidence tiers (hard_block/soft_block/warn) | `packages/isl-firewall/src/confidence.ts` | Firewall decisions |
| `packages/core/src/firewall/ast-call-extractor.ts` | AST-based phantom call detection | `packages/isl-firewall/src/ast-call-extractor.ts` | Phantom detection |
| `packages/core/src/firewall/scope-creep-detector.ts` | Scope creep detection | `packages/isl-firewall/src/scope-creep-detector.ts` | Firewall analysis |
| `packages/core/src/firewall/index.ts` | Firewall exports | `packages/isl-firewall/src/index.ts` | Firewall |
| `packages/mcp-server/src/hooks/file-write-hook.ts` | File write interception hook | `packages/isl-firewall/src/hooks/file-write-hook.ts` | MCP integration |
| `packages/mcp-server/src/runtime/intent-gate.ts` | Intent-based gate runtime | `packages/isl-firewall/src/runtime/intent-gate.ts` | MCP integration |

**Rationale:** These modules implement the file write governance system that prevents hallucinated code from being written.

### 3. Evidence Bundle & Reporting

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/core/src/tracing/evidence-pack-generator.ts` | Generate evidence packs | `packages/isl-evidence/src/evidence-pack-generator.ts` | Evidence bundle |
| `packages/core/src/tracing/audit-logger.ts` | Audit logging | `packages/isl-evidence/src/audit-logger.ts` | Evidence persistence |
| `packages/core/src/formatters/sarif/sarif-formatter.ts` | SARIF output format | `packages/isl-evidence/src/formatters/sarif-formatter.ts` | Report generation |
| `packages/core/src/formatters/junit/junit-formatter.ts` | JUnit output format | `packages/isl-evidence/src/formatters/junit-formatter.ts` | Report generation |
| `packages/core/src/formatters/markdown/markdown-formatter.ts` | Markdown output | `packages/isl-evidence/src/formatters/markdown-formatter.ts` | Report generation |
| `packages/core/src/formatters/html/report-template.ts` | HTML report template | `packages/isl-evidence/src/formatters/html/report-template.ts` | Report generation |
| `packages/core/src/formatters/html/components.ts` | HTML components | `packages/isl-evidence/src/formatters/html/components.ts` | Report generation |
| `packages/mcp-server/src/services/audit-service.ts` | Durable audit service | `packages/isl-evidence/src/services/audit-service.ts` | Evidence persistence |

**Rationale:** These modules produce the evidence bundles and reports that prove gate decisions.

### 4. Policy Packs Framework

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/core/src/policy/types.ts` | Policy type definitions | `packages/isl-policy-packs/src/types.ts` | Policy framework |
| `packages/core/src/policy/parser.ts` | YAML policy parser | `packages/isl-policy-packs/src/parser.ts` | Policy loading |
| `packages/core/src/policy/resolver.ts` | Policy resolver (extends/inheritance) | `packages/isl-policy-packs/src/resolver.ts` | Policy loading |
| `packages/core/src/policy/schema.ts` | Policy JSON schema | `packages/isl-policy-packs/src/schema.ts` | Policy validation |
| `packages/core/src/firewall/rules/base-rule.ts` | Base rule class | `packages/isl-policy-packs/src/rules/base-rule.ts` | Rule implementation |
| `packages/core/src/firewall/rules/ghost-route.ts` | Ghost route detection | `packages/isl-policy-packs/src/rules/ghost-route.ts` | Auth pack |
| `packages/core/src/firewall/rules/ghost-env.ts` | Ghost env var detection | `packages/isl-policy-packs/src/rules/ghost-env.ts` | Auth pack |
| `packages/core/src/firewall/rules/auth-drift.ts` | Auth drift detection | `packages/isl-policy-packs/src/rules/auth-drift.ts` | Auth pack |
| `packages/core/src/firewall/rules/contract-drift.ts` | Contract drift detection | `packages/isl-policy-packs/src/rules/contract-drift.ts` | Payments pack |
| `packages/core/src/firewall/rules/unsafe-side-effect.ts` | Unsafe side effect detection | `packages/isl-policy-packs/src/rules/unsafe-side-effect.ts` | PII pack |
| `packages/core/src/firewall/rules/scope-explosion.ts` | Scope explosion detection | `packages/isl-policy-packs/src/rules/scope-explosion.ts` | Rate-limit pack |

**Rationale:** These modules implement the policy pack system and specific rules.

### 5. CI/PR Adapters

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/github-action/src/action.ts` | GitHub Action main | `packages/isl-adapters/src/github/action.ts` | CI gate |
| `packages/github-action/action.yml` | Action definition | `packages/isl-adapters/github-action/action.yml` | CI gate |
| `packages/core/src/ci/github-actions.ts` | GitHub context detection | `packages/isl-adapters/src/github/context.ts` | CI gate |
| `packages/core/src/integrations/github-pr-client.ts` | PR comment client | `packages/isl-adapters/src/github/pr-client.ts` | CI gate |
| `packages/mcp-server/src/tools/firewall-tools.ts` | MCP firewall tools | `packages/isl-adapters/src/mcp/firewall-tools.ts` | MCP integration |
| `packages/mcp-server/src/tools/validation-tools.ts` | MCP validation tools | `packages/isl-adapters/src/mcp/validation-tools.ts` | MCP integration |
| `packages/mcp-server/src/ui/response-builder.ts` | MCP response formatting | `packages/isl-adapters/src/mcp/response-builder.ts` | MCP integration |

**Rationale:** These modules enable the gate to run in CI/PR and MCP contexts.

### 6. Supporting Utilities (Minimal)

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/core/src/utils/errors.ts` | Error types | `packages/isl-gate/src/utils/errors.ts` | All |
| `packages/core/src/utils/logger.ts` | Logger | `packages/isl-gate/src/utils/logger.ts` | All |
| `packages/core/src/utils/cache.ts` | Simple cache | `packages/isl-gate/src/utils/cache.ts` | Performance |
| `packages/core/src/utils/retry.ts` | Retry/timeout utilities | `packages/isl-gate/src/utils/retry.ts` | Resilience |
| `packages/core/src/utils/validation.ts` | Input validation | `packages/isl-gate/src/utils/validation.ts` | Safety |
| `packages/core/src/utils/performance.ts` | Performance tracking | `packages/isl-gate/src/utils/performance.ts` | Metrics |
| `packages/core/src/git/change-detector.ts` | Git changed files detection | `packages/isl-gate/src/git/change-detector.ts` | Changed-files mode |
| `packages/core/src/discovery/file-walker.ts` | File discovery | `packages/isl-gate/src/discovery/file-walker.ts` | Scanning |

**Rationale:** Minimal utilities required by the ported modules.

### 7. Shared Types

| Source Path | Purpose | Port To | Used By |
|-------------|---------|---------|---------|
| `packages/shared-types/src/gate.ts` | Gate result types | `packages/isl-gate/src/types/gate.ts` | Gate |
| `packages/shared-types/src/evidence.ts` | Evidence types | `packages/isl-evidence/src/types/evidence.ts` | Evidence |
| `packages/shared-types/src/commands.ts` | Command types | `packages/isl-gate/src/types/commands.ts` | CLI |

**Rationale:** Type definitions shared across packages.

---

## DROP (Not Ported)

### 1. Dashboards & Web UI ❌

| Source Path | Reason |
|-------------|--------|
| `apps/web/*` | Marketing/dashboard UI - not required for gate |
| `packages/dashboard-api/*` | Dashboard API - not required for gate |
| `packages/dashboard-web/*` | Dashboard web - not required for gate |
| `packages/mcp-server/src/ui/*` (most) | Complex UI formatters - keep only minimal |

**Rationale:** Non-goals explicitly exclude dashboards and marketing UI.

### 2. Reality Mode / Browser Testing ❌

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/reality/*` | Browser-based testing - complex, move later |
| `packages/core/src/reality/v2/*` | Reality Mode v2 - complex, move later |
| `packages/core/src/reality/chaos/*` | AI chaos agent - not required |

**Rationale:** Reality mode requires Playwright, browser orchestration, and is not needed for basic gate.

### 3. Advanced Scanners ❌

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/scanners/ultimate-scanner.ts` | Over-engineered - use policy packs instead |
| `packages/core/src/scanners/advanced-scanner.ts` | Over-engineered - use policy packs instead |
| `packages/core/src/scanners/code-quality-scanner.ts` | Over-engineered - use ISL verification |
| `packages/core/src/shipgate-mock-detector/*` | Can be implemented as policy pack later |

**Rationale:** These duplicate functionality better served by policy packs and ISL verification.

### 4. Autofix System ❌

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/autofix/*` | Auto-fix is beyond gate scope - gate just decides |
| `packages/core/src/autofix/modules/*` | Fix modules - not required for gate |
| `packages/core/src/autofix/orchestrator.ts` | Fix orchestration - not required |

**Rationale:** The gate produces SHIP/NO_SHIP verdicts; fixing is a separate concern.

### 5. Truthpack Generator ❌

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/truthpack/*` | ISL Studio has its own truthpack/validation system |

**Rationale:** ISL Studio already has validation/truthpack in `packages/core` and `packages/isl-verify`.

### 6. CLI Commands (Most) ❌

| Source Path | Reason |
|-------------|--------|
| `apps/cli/src/commands/badge.ts` | Marketing feature |
| `apps/cli/src/commands/certify.ts` | Marketing feature |
| `apps/cli/src/commands/demo.ts` | Demo UI |
| `apps/cli/src/commands/doctor.ts` | Diagnostics - not gate |
| `apps/cli/src/commands/forge.ts` | Spec generation - separate |
| `apps/cli/src/commands/missions.ts` | UX feature |
| `apps/cli/src/commands/quickstart.ts` | Onboarding |
| `apps/cli/src/commands/reality.ts` | Reality mode |
| `apps/cli/src/commands/roast.ts` | Marketing |
| `apps/cli/src/commands/scan.ts` | Use ISL scan instead |
| `apps/cli/src/commands/share.ts` | Marketing |
| `apps/cli/src/commands/welcome.ts` | Onboarding |
| `apps/cli/src/commands/watch.ts` | File watcher |
| `apps/cli/src/ui/*` (most) | Complex UI components |

**Rationale:** Most CLI commands are for UX, onboarding, or marketing - not gate.

### 7. VSCode Extension ❌

| Source Path | Reason |
|-------------|--------|
| `packages/vscode-extension/*` | ISL Studio has its own VSCode extension |
| `packages/vscode-extension-v1-backup/*` | Old backup |
| `apps/vscode-extension/*` | App version |

**Rationale:** ISL Studio has `packages/vscode` already.

### 8. API Server ❌

| Source Path | Reason |
|-------------|--------|
| `packages/api-server/*` | Cloud API - not required for local gate |

**Rationale:** The gate should work locally without cloud dependency.

### 9. Miscellaneous ❌

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/badges/*` | Marketing |
| `packages/core/src/checkpoint/*` | Checkpoint/rollback - complex |
| `packages/core/src/context/*` | Advanced context management |
| `packages/core/src/flow-tracing/*` | Flow visualization |
| `packages/core/src/forge/*` | Spec generation |
| `packages/core/src/hooks/*` | Git hooks - separate |
| `packages/core/src/intelligence/*` | AI analysis |
| `packages/core/src/learning/*` | ML calibration |
| `packages/core/src/llm/*` | LLM client |
| `packages/core/src/missions/*` | Mission grouping |
| `packages/core/src/performance/*` | Perf monitoring |
| `packages/core/src/plugins/*` | Plugin system |
| `packages/core/src/prompt/*` | Prompt engineering |
| `packages/core/src/receipts/*` | Receipt generation |
| `packages/core/src/secrets/*` | Secrets scanner - use policy pack |
| `packages/core/src/storage/*` | Video storage |
| `packages/core/src/telemetry/*` | Telemetry |
| `packages/core/src/visualization/*` | Graphs |
| `packages/core/src/workers/*` | Worker pool |

**Rationale:** These are either marketing, over-engineered, or outside gate scope.

---

## MOVE LATER (Phase 2+)

### 1. Reality Mode (Future)

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/reality/runtime/*` | Runtime proof - adds value but complex |
| `packages/core/src/reality/proof/*` | Proof generation |
| `packages/core/src/reality/safety/*` | Safety checks |

**Timeline:** After Phase 4, when basic gate is stable.

### 2. Additional Scanners (Future)

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/secrets/*` | Secrets scanning - implement as policy pack |
| `packages/core/src/shipgate-mock-detector/*` | Mock detection - implement as policy pack |

**Timeline:** Implement as policy packs in Phase 4+.

### 3. ISL Translator Integration

| Source Path | Reason |
|-------------|--------|
| `packages/core/src/isl-translator/*` | ISL translation - may overlap with existing |
| `packages/core/src/isl-agent/*` | ISL agent - may overlap |

**Timeline:** Evaluate after understanding ISL Studio's existing ISL packages.

---

## Package Structure (Target)

```
packages/
├── isl-gate/                          # Core gate decision engine
│   ├── src/
│   │   ├── gate.ts                    # Main gate entry point
│   │   ├── scoring/                   # Ship score calculators
│   │   ├── types/                     # Gate types
│   │   ├── utils/                     # Shared utilities
│   │   ├── git/                       # Git integration
│   │   └── discovery/                 # File discovery
│   ├── tests/
│   └── package.json
│
├── isl-firewall/                      # Agent file write governance
│   ├── src/
│   │   ├── agent-firewall.ts          # Main firewall
│   │   ├── policy-engine.ts           # Policy evaluation
│   │   ├── claim-extractor.ts         # Claim extraction
│   │   ├── evidence-resolver.ts       # Evidence resolution
│   │   ├── intent-validator.ts        # Intent validation
│   │   ├── hooks/                     # Write hooks
│   │   └── runtime/                   # Intent gate runtime
│   ├── tests/
│   └── package.json
│
├── isl-evidence/                      # Evidence bundle & reporting
│   ├── src/
│   │   ├── evidence-pack-generator.ts # Bundle generation
│   │   ├── formatters/                # Output formats (SARIF, JUnit, HTML)
│   │   ├── services/                  # Audit service
│   │   └── types/                     # Evidence types
│   ├── tests/
│   └── package.json
│
├── isl-policy-packs/                  # Policy pack framework + starter packs
│   ├── src/
│   │   ├── types.ts                   # Policy types
│   │   ├── parser.ts                  # YAML parser
│   │   ├── resolver.ts                # Policy resolver
│   │   ├── rules/                     # Rule implementations
│   │   └── packs/                     # Starter packs
│   │       ├── auth/                  # Auth policy pack
│   │       ├── payments/              # Payments/webhooks pack
│   │       ├── pii-logging/           # PII/logging pack
│   │       └── rate-limit/            # Rate-limit pack
│   ├── tests/
│   └── package.json
│
└── isl-adapters/                      # CI + MCP adapters
    ├── src/
    │   ├── github/                    # GitHub Action adapter
    │   ├── mcp/                       # MCP tools adapter
    │   └── cli/                       # CLI glue
    ├── github-action/                 # Action.yml and assets
    ├── tests/
    └── package.json
```

---

## Output Contracts

### Gate Result (machine-readable)

```typescript
interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;                       // 0..100
  reasons: Array<{
    code: string;
    message: string;
    files: string[];
  }>;
  evidencePath: string;                // folder path
  fingerprint: string;                 // deterministic hash
}
```

### Evidence Bundle Structure

```
evidence/
├── manifest.json                      # versions, inputs, fingerprint
├── results.json                       # clause-level results
├── report.html                        # human-readable report
└── artifacts/                         # logs/tests/traces if present
    ├── claims.json
    ├── evidence.json
    └── decision.json
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dependency on @shipgate/core types | Build breaks | Copy minimal types inline |
| Policy pack rules too coupled to ShipGate | Runtime errors | Abstract rule interface |
| Evidence format incompatible with ISL | Reporting breaks | Define ISL evidence schema |
| MCP tools expect ShipGate server | Integration fails | Create ISL MCP adapter |
| GitHub Action expects ShipGate CLI | CI breaks | Create standalone action |

---

## Next Steps

1. **Phase 1**: Port minimal gate (isl-gate + isl-evidence)
2. **Phase 2**: Port firewall (isl-firewall)
3. **Phase 3**: Port adapters (isl-adapters)
4. **Phase 4**: Implement policy packs (isl-policy-packs)

---

*Document Version: 1.0*  
*Last Updated: 2026-02-01*
