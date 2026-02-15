# ISL: Safe Vibe Coding Roadmap

> **Mission:** Be the first product to safely ship AI-generated code from natural human language — using ISL (Intent Specification Language) as the verification layer — for complete, production-quality full-stack applications.

---

## Current State (What We Have)

| Layer | Status | Quality |
|-------|--------|---------|
| ISL Parser | ✅ 8 full-stack constructs | Grammar gaps on edge cases |
| AI Copilot | ✅ Anthropic + OpenAI | Working |
| `isl vibe` CLI | ✅ 5-stage pipeline | Scaffold-depth codegen |
| VS Code Extension | ✅ Command + progress | Basic UX |
| Verification Pipeline | ✅ Trust scoring + verdicts | Overly strict on utility files |
| Heal Loop | ✅ verify→fix→re-verify | 3 iterations, partial fixes |
| Pro Subscription | ✅ Stripe + JWT | Working |
| Portal | ✅ Next.js landing + checkout | Basic |

**Gap:** Pipeline runs end-to-end but generated code is scaffold-depth (comment stubs, thin route handlers). Verification scores low because utility files lack ISL coverage. Parser rejects some AI-generated ISL syntax.

---

## Phase 1: Fix Pipeline Foundation
**Goal:** Make the pipeline reliable — every run produces parseable ISL and real code.
**Timeline:** 1–2 weeks

### 1.1 ISL Parser Tolerance
- [ ] **Fuzzy parser mode** — Accept common AI-generated patterns the strict parser rejects (inline annotations like `[format: email]`, union type shorthands, missing `version:` field)
- [ ] **Parser error recovery** — Continue parsing after errors instead of aborting; collect partial AST
- [ ] **ISL grammar reference prompt** — Feed the AI copilot the exact ISL grammar spec as system prompt context so it generates valid ISL on first try
- [ ] **Round-trip test suite** — 20+ ISL specs that must parse→unparse→re-parse identically

### 1.2 Deep Code Generation
- [ ] **Replace stub comments with real implementations** — Route handlers must contain actual Prisma queries, validation logic, error handling, JWT auth
- [ ] **Multi-file coherence** — Generated imports must resolve; types must be consistent across files
- [ ] **Structured codegen prompts** — Instead of one mega-prompt, use per-file prompts with full context (ISL spec + already-generated files)
- [ ] **Code quality gate** — Run TypeScript compiler on generated code before writing; if it fails, re-prompt

### 1.3 Verification Coverage
- [ ] **Auto-spec utility files** — Generate ISL specs for db.ts, validators.ts, errors.ts based on their exports
- [ ] **Tiered verification** — Core behavior files (routes, services) are strict; utility/config files use relaxed thresholds
- [ ] **Spec coverage metric** — Track % of files with ISL specs; target 80%+ for SHIP verdict
- [ ] **Verify the generated ISL spec itself** — Check that every entity, behavior, and endpoint in the spec has a corresponding generated file

---

## Phase 2: Production-Quality Code Generation
**Goal:** Generated code is runnable out of the box — `npm install && npm run dev` works.
**Timeline:** 2–3 weeks

### 2.1 App Templates
- [ ] **Golden templates** — Hand-crafted, verified reference implementations for common patterns:
  - Auth (register/login/logout/JWT refresh)
  - CRUD entity (create/read/update/delete with pagination)
  - File upload
  - Real-time (WebSocket/SSE)
  - Payment integration (Stripe)
  - Email notifications
- [ ] **Template selection** — AI picks relevant templates based on ISL spec, then customizes

### 2.2 Code Quality Standards
- [ ] **Type safety** — All generated code must pass `tsc --noEmit` with strict mode
- [ ] **Error handling** — Every route has try/catch, every Prisma call handles errors, ISL error types map to HTTP status codes
- [ ] **Validation** — Zod schemas generated from ISL entity constraints; applied at API boundary
- [ ] **Auth middleware** — JWT verification middleware generated from ISL `actors { must: authenticated }` blocks
- [ ] **Database seeds** — Generate seed data from ISL scenarios

### 2.3 Frontend Quality
- [ ] **Tailwind + shadcn/ui** — Generated React components use modern UI primitives, not bare divs
- [ ] **Forms from ISL** — ISL `form` declarations generate real form components with validation
- [ ] **API client** — Generated typed fetch wrapper matching ISL API endpoints
- [ ] **Auth flow** — Login/register/logout pages with JWT token management
- [ ] **Dashboard layout** — Responsive sidebar + main content from ISL `screen` declarations

### 2.4 Test Quality
- [ ] **Generated tests must pass** — Run `vitest run` on generated tests; all must pass before SHIP
- [ ] **Contract tests** — Tests verify ISL preconditions, postconditions, and error conditions
- [ ] **API integration tests** — Test each endpoint with valid/invalid/edge-case payloads
- [ ] **Minimum test coverage** — At least 1 test per ISL behavior

---

## Phase 3: Reliability & Determinism
**Goal:** Same prompt → same quality output. Pipeline never hangs or crashes.
**Timeline:** 2 weeks

### 3.1 Pipeline Robustness
- [ ] **Timeout per stage** — Each stage has a max duration; graceful abort with partial results
- [ ] **Token budget management** — Track token usage across stages; warn before hitting limits
- [ ] **Retry with backoff** — API failures retry 3x with exponential backoff
- [ ] **Streaming progress** — Real-time stage updates via CLI spinners and VS Code progress

### 3.2 Caching & Speed
- [ ] **ISL spec cache** — Same NL prompt → cached ISL spec (skip Stage 1 on re-run)
- [ ] **Template cache** — Pre-compiled golden templates loaded from disk, not regenerated
- [ ] **Incremental codegen** — On re-run, only regenerate files that changed in the spec
- [ ] **Parallel codegen** — Generate backend, frontend, tests in parallel (3 concurrent AI calls)

### 3.3 Determinism
- [ ] **Seed-based generation** — Optional `--seed` flag for reproducible output
- [ ] **Snapshot testing** — Golden output snapshots for 5 reference prompts; CI checks for regressions
- [ ] **Temperature control** — Low temperature (0.1) for codegen, higher (0.5) for NL→ISL creativity

---

## Phase 4: Multi-Framework & Multi-DB
**Goal:** Support the frameworks and databases developers actually use.
**Timeline:** 2–3 weeks

### 4.1 Backend Frameworks
- [ ] **Next.js App Router** (current) — API routes in `app/api/`, React Server Components
- [ ] **Express.js** — Traditional MVC with controllers, middleware, routes
- [ ] **Fastify** — Schema-based validation, plugin architecture
- [ ] **Hono** — Edge-ready, Cloudflare Workers compatible

### 4.2 Databases
- [ ] **SQLite** (current) — Local dev, Prisma ORM
- [ ] **PostgreSQL** — Production-ready, Prisma + connection pooling
- [ ] **MongoDB** — Document model, Mongoose ODM
- [ ] **Drizzle ORM** — Alternative to Prisma, type-safe SQL

### 4.3 Deployment Targets
- [ ] **Vercel** — `vercel.json` + deployment config
- [ ] **Docker** — `Dockerfile` + `docker-compose.yml` for self-hosted
- [ ] **Railway / Render** — One-click deploy configs

### 4.4 Frontend Options
- [ ] **Next.js + React** (current)
- [ ] **SvelteKit** — Alternative full-stack framework
- [ ] **API-only mode** — `--no-frontend` generates pure backend + OpenAPI spec

---

## Phase 5: Developer Experience
**Goal:** Developers love using this — it's faster than writing code manually.
**Timeline:** 2 weeks

### 5.1 VS Code Integration
- [ ] **Vibe panel** — Dedicated sidebar section: prompt input, framework picker, live stage progress, file tree preview
- [ ] **Generated file preview** — Show generated code in diff view before writing to disk
- [ ] **One-click iterate** — "Improve this file" button sends file + ISL spec + feedback to AI
- [ ] **ISL spec editor** — Syntax highlighting, validation, autocomplete for ISL files
- [ ] **Inline annotations** — CodeLens showing ISL coverage per file

### 5.2 CLI Polish
- [ ] **Interactive mode** — `isl vibe` with no args enters interactive wizard
- [ ] **`--watch` mode** — Edit ISL spec → auto-regenerate changed files
- [ ] **`--diff` mode** — Show what would change before writing
- [ ] **Progress bars** — Per-stage progress with ETA
- [ ] **Cost estimate** — Show estimated API cost before running

### 5.3 Documentation
- [ ] **ISL Language Reference** — Complete grammar, every construct, examples
- [ ] **Vibe Tutorial** — "Build a todo app in 2 minutes" walkthrough
- [ ] **Architecture Guide** — How the pipeline works, how to extend it
- [ ] **Prompt Engineering Guide** — How to write prompts that produce better apps
- [ ] **Video demo** — 3-minute screencast for landing page

---

## Phase 6: Trust & Safety
**Goal:** Proof that AI-generated code is safe to ship — not just "it compiles."
**Timeline:** 2–3 weeks

### 6.1 Proof Bundles
- [ ] **ISL Certificate** — JSON document proving: ISL spec hash, generated file hashes, verification score, all evidence entries, timestamp, AI model used
- [ ] **Audit trail** — Every AI prompt/response logged (opt-in) for reproducibility
- [ ] **Diff-against-spec** — Show exactly which ISL contracts each file satisfies

### 6.2 Security
- [ ] **SQL injection check** — Verify all DB queries use parameterized queries (Prisma handles this)
- [ ] **Auth bypass check** — Verify all protected routes have auth middleware
- [ ] **Secret exposure check** — No API keys, passwords, or secrets in generated code
- [ ] **Dependency audit** — Generated `package.json` deps checked against known vulnerabilities
- [ ] **OWASP Top 10 scan** — Static analysis for common web vulnerabilities

### 6.3 Supply Chain
- [ ] **SBOM generation** — Software Bill of Materials for generated project
- [ ] **License compliance** — All generated deps have compatible licenses
- [ ] **Reproducible builds** — Lockfile generated, pinned versions

### 6.4 Continuous Verification
- [ ] **CI/CD integration** — `isl verify .` in GitHub Actions / GitLab CI
- [ ] **Pre-commit hook** — Block commits that break ISL contracts
- [ ] **PR gate** — GitHub App that comments SHIP/NO_SHIP on pull requests

---

## Phase 7: Launch
**Goal:** Ship the product. Get users.
**Timeline:** 2–3 weeks

### 7.1 Dogfooding
- [ ] **Build 5 real apps with vibe** — Todo, blog, e-commerce, chat, dashboard
- [ ] **Each must reach SHIP verdict** — Fix pipeline issues discovered during dogfooding
- [ ] **Measure: prompt → running app time** — Target: under 5 minutes
- [ ] **Measure: generated code quality** — Target: passes ESLint, tsc, tests

### 7.2 Beta Program
- [ ] **Invite 20 developers** — Mix of junior/senior, different frameworks
- [ ] **Feedback form** — What worked, what broke, what's missing
- [ ] **Bug bash** — Fix top 10 issues from beta

### 7.3 Landing Page
- [ ] **Hero demo** — Animated terminal showing `vibe` → generated app
- [ ] **"Before/After"** — Traditional coding vs. vibe coding comparison
- [ ] **Trust section** — "Every line verified against ISL contracts"
- [ ] **Pricing** — Free (3 vibes/month) / Pro ($29 lifetime) / Team (TBD)

### 7.4 Launch Channels
- [ ] **Show HN** — Post with demo GIF + link to try
- [ ] **Product Hunt** — Launch with video
- [ ] **Dev.to / Hashnode** — "How I built a full-stack app in 2 minutes" article
- [ ] **Twitter/X thread** — Pipeline architecture breakdown
- [ ] **VS Code Marketplace** — Extension published with vibe feature highlighted
- [ ] **npm publish** — `npx isl vibe "..."` works for anyone

---

## Success Metrics

| Metric | Current | Target (Launch) |
|--------|---------|-----------------|
| Prompt → runnable app | ~2 min, scaffold | < 5 min, production |
| Generated code passes tsc | No | Yes, 100% |
| Generated tests pass | No | Yes, 80%+ |
| SHIP verdict rate | 0% (NO_SHIP) | 60%+ on first run |
| ISL spec coverage | ~30% | 80%+ |
| Frameworks supported | Next.js only | Next.js + Express + Fastify |
| Databases supported | SQLite only | SQLite + Postgres |
| Time to first value | Install + API key + prompt | `npx isl vibe "..."` |

---

## Execution Priority

```
Week 1-2:  Phase 1 — Fix foundation (parser, deep codegen, verify coverage)
Week 3-4:  Phase 2 — Production code quality (templates, real implementations)
Week 5-6:  Phase 3 — Reliability + Phase 6.1 (proof bundles)
Week 7-8:  Phase 4 — Multi-framework (Express, Postgres)
Week 9-10: Phase 5 — DX polish (VS Code, docs, tutorial)
Week 11:   Phase 6.2-6.4 — Security + CI/CD
Week 12:   Phase 7 — Dogfood, beta, launch
```

**Critical path:** Phase 1 → Phase 2 → Phase 7.1 (dogfood). Everything else is parallelizable.

The single most important thing: **generated code must be runnable.** If `npm install && npm run dev` works after `isl vibe`, everything else follows.
