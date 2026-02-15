# Shipgate Official Roadmap

> **Mission:** Make AI-generated code verifiably safe.
> **Vision:** The world's first platform where you describe what you want in natural language, and get code that's verified safe before it ships.

---

## Where We Are (February 2026)

**ISL 1.0 Core: Complete.**

- 226 packages, 200 ready (88%)
- ISL parser, typechecker, evaluator (95%+ coverage)
- SHIP/NO_SHIP gate (spec + firewall)
- 25 security/policy rules
- Proof bundles, trust scores, evidence
- GitHub Action, Cursor MCP, pre-push hooks
- Healer (gate → fix → re-gate)
- CLI: `gate`, `verify`, `pbt`, `chaos`, `trust-score`, `heal`

**No direct competitor combines:** intent specs + behavioral verification + security firewall + AI-native workflow + single gate verdict.

---

## The Roadmap

### Phase 1: Ship the Gate (Weeks 1–4)
*Goal: Shipgate is publicly available and anyone can use it in 5 minutes.*

#### 1.1 — Fix & Stabilize
- [ ] Fix `shipgate-metrics` build blocker (TS type error)
- [ ] Fix `semantics` and `stdlib-auth` build failures
- [ ] Green build: `pnpm build` exits 0
- [ ] Green tests: `pnpm test` with >95% pass rate

#### 1.2 — Publish to npm
- [x] shipgate CLI builds and packs ready (`pnpm --filter shipgate build`)
- [ ] Publish `shipgate` CLI to npm (`npx shipgate init`)
- [ ] Publish `@shipgate/sdk` for programmatic use (blocked by @isl-lang deps)
- [ ] Publish `shipgate/gate-action@v1` GitHub Action (see docs/PUBLISH_NPM.md)

#### 1.3 — Brand & Landing
- [ ] Register domain (`shipgate.dev`)
- [ ] Landing page: problem, solution, 5-minute quickstart
- [ ] Record "Three Big Lies" demo (2-min video)
- [ ] README rewrite with Shipgate branding

#### 1.4 — Quickstart
- [ ] `npx shipgate init` — auto-generates truthpack + config
- [ ] `npx shipgate gate` — runs gate on current project
- [ ] 5-minute quickstart guide in docs
- [ ] Example repos: one that passes, one that fails

**Milestone:** Anyone can `npx shipgate init && npx shipgate gate` on their project.

---

### Phase 2: Win the Gate Market (Weeks 5–12)
*Goal: Shipgate is the default AI code safety gate. First users, first proof.*

#### 2.1 — Distribution
- [ ] Launch on Hacker News: "I built Shipgate to stop AI from shipping fake features"
- [ ] Post on X, Reddit (r/programming, r/typescript), Dev.to
- [ ] GitHub topics: `ai-safety`, `code-verification`, `behavioral-contracts`
- [ ] Product Hunt launch

#### 2.2 — VS Code Extension
- [ ] Polish existing VS Code extension
- [ ] Publish to VS Code Marketplace as "Shipgate"
- [ ] Gate on save (configurable)
- [ ] Inline violation markers with fix suggestions

#### 2.3 — Shipgate Benchmark
- [ ] Create public dataset: 50+ examples of unsafe AI-generated code
- [ ] Run Shipgate, SonarQube, Snyk, Semgrep on same dataset
- [ ] Publish results: "Shipgate catches X% of behavioral issues; alternatives catch Y%"
- [ ] Focus on what only Shipgate catches: ghost routes, intent mismatch, fake features

#### 2.4 — Case Studies & Evidence
- [ ] Publish case studies 001–003 publicly
- [ ] Add 3 more real-world case studies
- [ ] `shipgate evidence export` command for anonymized metrics
- [ ] Track: blocked PRs, NO_SHIP reasons, fix rate

#### 2.5 — Rule Calibration
- [ ] Track false positive rate per rule
- [ ] Auto-suggest disabling noisy rules
- [ ] User feedback loop: "Was this NO_SHIP correct?"

**Milestone:** 500+ GitHub stars, 1,000+ npm weekly downloads, 50+ repos using Shipgate.

---

### Phase 3: Natural Language → ISL (Weeks 13–24)
*Goal: You describe what you want. Shipgate verifies it before code is generated.*

#### 3.1 — AI-Powered NL → ISL
- [ ] Upgrade `isl-translator` with LLM-powered translation
- [ ] Pattern library expansion (auth, CRUD, payments, webhooks, etc.)
- [ ] Confidence scoring: high-confidence specs auto-accepted; low-confidence → clarification
- [ ] Confirmation step: "Here's the spec I inferred. Does this match your intent?"

#### 3.2 — Code → ISL Engine
- [ ] Ship `shipgate engine <path>` command
- [ ] TypeScript: full AST extraction (routes, validations, types, handlers)
- [ ] Python: Flask/FastAPI/Django route → behavior mapping
- [ ] Auto-generate bindings (which file implements which behavior)
- [ ] One-command CI: `shipgate engine . && shipgate gate specs/ --impl src/`

#### 3.3 — Spec Inference from Tests
- [ ] Extract pre/postconditions from existing test suites
- [ ] Map test assertions to ISL postconditions
- [ ] Use test coverage to estimate spec confidence

#### 3.4 — Interactive Spec Builder
- [ ] Chat-based flow in Cursor/VS Code: "What should this endpoint do?"
- [ ] AI proposes ISL spec → user confirms → spec saved
- [ ] Spec evolves with the codebase (re-infer on change)

**Milestone:** Any project can run `shipgate engine .` and get useful ISL specs without writing any by hand.

---

### Phase 4: Safe Vibe Coding (Weeks 25–40)
*Goal: Describe an app in natural language. Get verified, safe, full-stack code.*

#### 4.1 — End-to-End Pipeline
- [ ] Wire: NL prompt → ISL spec → verify spec → generate code → verify code → SHIP/NO_SHIP
- [ ] Start with backend: API + auth + DB schema
- [ ] Add frontend: React/Next.js from ISL entity + behavior definitions
- [ ] Deployment artifacts: Docker, Vercel config

#### 4.2 — Full-Stack Codegen
- [ ] Backend: Express/Fastify/Next.js API routes from ISL behaviors
- [ ] Database: Prisma/Drizzle schema from ISL entities
- [ ] Auth: Session/JWT from ISL auth behaviors (using stdlib-auth)
- [ ] Frontend: CRUD pages from ISL entities + behaviors
- [ ] Tests: Generated test suite that validates the spec

#### 4.3 — Iterative Build Loop
- [ ] User describes feature in NL → ISL generated → code generated → gate runs
- [ ] If NO_SHIP: show violations, suggest fixes, regenerate
- [ ] If SHIP: apply code, show proof bundle
- [ ] Loop until all features pass

#### 4.4 — Cursor/VS Code Integration
- [ ] "Describe a feature" command in Cursor
- [ ] Flow: chat → ISL → codegen → gate → apply (all in editor)
- [ ] Show ISL spec alongside generated code
- [ ] One-click accept or modify spec

**Milestone:** Demo: "Build me a todo app with auth" → working, verified full-stack app in under 10 minutes.

---

### Phase 5: Standard & Partnerships (Weeks 40–52)
*Goal: Shipgate becomes the industry standard for AI code safety.*

#### 5.1 — Partnerships
- [ ] Cursor: pitch as official AI safety partner
- [ ] GitHub: propose Copilot verification add-on
- [ ] Vercel: "Deploy with Shipgate" integration
- [ ] At least one partnership announced

#### 5.2 — "Shipgate Certified" Standard
- [ ] Publish open spec: "What a safe AI code gate must check"
- [ ] Create certification badge for repos that pass
- [ ] Propose to OWASP or similar for AI code safety standard
- [ ] Public certification registry

#### 5.3 — Enterprise
- [ ] Multi-repo dashboard
- [ ] SSO/SAML integration
- [ ] Compliance packs (SOC2, HIPAA, PCI-DSS)
- [ ] On-prem deployment option
- [ ] First 10 enterprise customers

#### 5.4 — Marketplace
- [ ] ISL spec marketplace (share/sell domain specs)
- [ ] Community policy packs
- [ ] Verified codegen templates

**Milestone:** Partnership with Cursor or GitHub announced. "Shipgate Certified" standard published.

---

## Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|--------|---------|---------|---------|---------|---------|
| npm weekly downloads | 100 | 1,000 | 5,000 | 20,000 | 50,000+ |
| GitHub stars | 50 | 500 | 2,000 | 5,000 | 10,000+ |
| Repos using Shipgate | 10 | 50 | 500 | 2,000 | 10,000+ |
| ARR | $0 | $0 | $100K | $1M | $5M+ |
| Enterprise customers | 0 | 0 | 2 | 10 | 50+ |
| Partnerships | 0 | 0 | 0 | 1 | 2+ |

---

## Revenue Model

| Tier | Price | Target |
|------|-------|--------|
| **Free** | $0 | Solo devs, OSS, startups — distribution |
| **Team** | $29/user/month | Engineering teams, compliance-aware orgs |
| **Enterprise** | Custom | Regulated industries, multi-team setups |
| **Safe Vibe Coding** (Phase 4+) | TBD | Premium: NL→verified code platform |

---

## Technical Dependencies

| Phase | Depends On |
|-------|------------|
| Phase 1 | Fix build blockers, npm publish |
| Phase 2 | VS Code extension polish, benchmark dataset |
| Phase 3 | LLM integration for NL→ISL, inference engine improvements |
| Phase 4 | Full-stack codegen, iterative build loop |
| Phase 5 | Adoption, enterprise features, partnership outreach |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub/Copilot builds similar feature | High | Move fast; own the standard; build network effects |
| NL→ISL accuracy too low | Medium | Confirmation loop; start with patterns; improve with usage |
| Adoption friction (specs feel heavy) | Medium | Specless mode; auto-inference; truthpack is zero-config |
| False positives kill trust | High | Rule calibration; user feedback; allowlists |
| Funding gap | Medium | Revenue from Team tier; seek seed if needed |

---

## The Claim

**Phase 1–2:** "Shipgate blocks AI from shipping unsafe code."

**Phase 3–4:** "Shipgate makes vibe coding safe. Describe what you want. Get verified code."

**Phase 5:** "With Shipgate, AI can no longer ship unsafe code."

---

## Timeline Summary

```
Feb 2026                                                          Feb 2027
  │                                                                    │
  ├── Phase 1: Ship the Gate ──────────┐                               │
  │   (Weeks 1–4)                      │                               │
  │                                    ├── Phase 2: Win the Market ────┐
  │                                    │   (Weeks 5–12)                │
  │                                    │                               │
  │                                    ├── Phase 3: NL → ISL ──────────┤
  │                                    │   (Weeks 13–24)               │
  │                                    │                               │
  │                                    ├── Phase 4: Safe Vibe Coding ──┤
  │                                    │   (Weeks 25–40)               │
  │                                    │                               │
  │                                    └── Phase 5: Standard ──────────┤
  │                                        (Weeks 40–52)               │
  │                                                                    │
  ▼                                                                    ▼
 Gate ships                                              "AI can no longer
 on npm                                                 ship unsafe code"
```

---

*Roadmap created: 2026-02-10*
*Owner: Shipgate Team*
*Status: Active*
