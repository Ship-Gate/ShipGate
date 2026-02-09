# Phase 4: AI Features — Deferred Roadmap

> **Status:** DEFERRED from Phase 3  
> **Rationale:** Keep Phase 3 focused on verification. AI features introduce scope creep risk.  
> **Prerequisite:** Phase 3 must be 100% complete before starting Phase 4.

---

## Deferred Packages

### Tier 1: Core AI Packages (High Value, Defer)

| Package | Description | Dependencies | Estimated Effort |
|---------|-------------|--------------|------------------|
| `ai-copilot` | Natural language → ISL conversion | OpenAI, Anthropic SDKs | 5-7 days |
| `ai-generator` | Generate implementations from ISL using LLMs | OpenAI, Anthropic SDKs | 5-7 days |
| `isl-ai` | Code completion, generation, analysis | Anthropic SDK | 4-5 days |
| `spec-assist` | AI-assisted spec generation from existing code | Parser, Verifier | 5-7 days |

### Tier 2: Domain Libraries (Lower Priority)

| Package | Description | Dependencies | Estimated Effort |
|---------|-------------|--------------|------------------|
| `stdlib-ai` | LLMs, embeddings, RAG, agents | stdlib-core | 3-5 days |
| `stdlib-ml` | ML model specs, training pipelines | — | 3-5 days |

### Tier 3: Orchestration (Future)

| Package | Description | Dependencies | Estimated Effort |
|---------|-------------|--------------|------------------|
| `agent-os` | Agent orchestration: triage → plan → execute → verify | Multiple core packages | 7-10 days |

---

## Action Items Before Phase 4

### 1. Mark `stdlib-ai` as Private

Currently `stdlib-ai` is **NOT** marked as `private: true`. This needs to be fixed:

```json
// packages/stdlib-ai/package.json
{
  "private": true,
  "experimental": true
}
```

### 2. Audit `spec-reviewer` 

Determine if `spec-reviewer` contains AI dependencies. If yes, mark as private.

### 3. Remove AI Packages from Build

Ensure these packages are excluded from the main build path:
- Add to `.npmrc` or turbo pipeline filters if needed
- Verify `pnpm build` doesn't attempt to build these packages

---

## Phase 4 Prerequisites

Before ANY Phase 4 work begins:

1. **Phase 3 Gate Passed:**
   - [ ] `pnpm build && pnpm test` green
   - [ ] Trust score system functional
   - [ ] SMT integration at 60%+
   - [ ] PBT CLI working
   - [ ] Chaos CLI working

2. **Documentation Complete:**
   - [ ] Verification deep dive docs
   - [ ] Trust score docs
   - [ ] PBT workflow docs

3. **Performance Baselines:**
   - [ ] Verify pipeline < 5s for small specs
   - [ ] SMT solving < 2s average per clause

---

## Phase 4 Milestones (Future)

### M4.1: AI Copilot MVP
- Natural language → ISL behavior sketches
- ISL autocomplete in VS Code
- Inline documentation generation

### M4.2: AI-Assisted Implementation
- Generate TypeScript/Python from ISL
- AI-suggested postconditions
- Automatic test case generation

### M4.3: Spec Mining
- Extract ISL specs from existing codebases
- Infer preconditions from code patterns
- Suggest invariants from data flow

### M4.4: Agent Orchestration
- Multi-step workflows: parse → generate → verify → fix
- Self-healing spec violations
- Continuous verification agents

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| AI APIs unavailable | Local model fallback (Ollama) |
| LLM hallucinations | ISL parser validation gate |
| Cost overruns | Token budgets per request |
| Dependency on external services | Mock providers for testing |

---

## Estimated Phase 4 Timeline

| Order | Milestone | Effort | Parallel? |
|-------|-----------|--------|-----------|
| 1 | Mark AI packages private | 1 day | — |
| 2 | M4.1: AI Copilot MVP | 5-7 days | — |
| 3 | M4.2: AI Implementation | 5-7 days | M4.3 |
| 4 | M4.3: Spec Mining | 5-7 days | M4.2 |
| 5 | M4.4: Agent Orchestration | 7-10 days | — |

**Total:** ~25-35 days after Phase 3 completion

---

## Hard Boundary

**Phase 4 work MUST NOT begin until Phase 3 is complete.**

If Phase 3 is blocked, do NOT work around it by starting Phase 4.

---

*Generated: 2026-02-07 by Phase 3 Scope Enforcer*
