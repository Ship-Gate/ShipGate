# Shipgate — Product Delivery Plan

**Official product name:** Shipgate  
**Tagline:** *Stop AI from shipping fake features.*

---

## 1. Naming & Brand Architecture

| Layer | Name | Purpose |
|-------|------|---------|
| **Product** | **Shipgate** | The gate that decides if code is ready to ship. SHIP or NO_SHIP. |
| **Spec language** | ISL (Intent Specification Language) | The behavioral contract DSL. Think "TypeScript for behavior." |
| **Truth source** | Truthpack | Auto-generated contracts (routes, env, types) in `.vibecheck/truthpack` |
| **CLI binary** | `shipgate` or `sg` | User-facing command |

**Brand hierarchy:** Shipgate (product) uses ISL (language) + Truthpack (truth source) to enforce behavioral contracts.

---

## 2. Product Readiness Checklist

### ✅ What You Have (Shippable Today)

| Component | Status | Notes |
|-----------|--------|-------|
| ISL parser + type checker | ✅ Production | 95%+ expression eval, semantic passes |
| SHIP/NO_SHIP gate engine | ✅ Production | `isl-gate`, trust score 0–100 |
| Truthpack generation | ✅ Working | `.vibecheck/truthpack` (routes, contracts, env, auth) |
| AI Firewall (MCP) | ✅ Working | Blocks ghost routes, ghost env, auth bypass |
| Policy packs | ✅ 25 rules | auth, PII, payments, rate-limit, intent |
| CLI commands | ✅ Working | `gate`, `verify`, `pbt`, `chaos`, `trust-score` |
| GitHub Action | ✅ Working | `isl-gate.yml`, merge gate |
| Three Big Lies demo | ✅ Working | Money transfer, login, registration scenarios |
| Evidence bundles | ✅ Working | JSON + HTML reports, proof bundles |
| Reality Mode | ✅ Playwright | E2E validation |

### ⚠️ Gaps Before Public Launch

| Gap | Priority | Effort |
|-----|----------|--------|
| **Published npm package** | P0 | 1–2 days |
| **Brand consistency** | P0 | 2–3 days |
| **Landing page** | P0 | 1–2 days |
| **Quickstart (< 5 min)** | P0 | 1 day |
| **Domain + redirects** | P1 | 1 day |
| **Docs site** | P1 | 2–3 days |
| **VS Code extension** | P1 | Polish existing |
| **Social proof** | P2 | Ongoing |

---

## 3. Launch Sequence

### Phase A: Rebrand & Package (Week 1)

1. **Rename product references**
   - ISL Studio → Shipgate in all user-facing docs
   - `islstudio` package → `shipgate` (or keep as internal, expose `shipgate` CLI)
   - Update README, PRICING, OUTREACH, etc.

2. **Publish `shipgate` CLI to npm**
   - Package name: `shipgate` or `@shipgate/cli`
   - Entry: `npx shipgate init`, `npx shipgate gate`
   - Replace placeholder `@isl-lang/cli` with real publish

3. **Domain**
   - `shipgate.dev` or `shipgate.io` — register and point to landing page

### Phase B: Landing & Quickstart (Week 2)

1. **Landing page** (`shipgate.dev`)
   - Problem: "Ghost features" — AI ships code that doesn't work
   - Solution: Behavioral contracts, Truthpack, SHIP/NO_SHIP gate
   - One-liner setup: `npx shipgate init`
   - Link to Three Big Lies demo (recorded or interactive)

2. **Quickstart**
   - 5-minute path: clone demo → run gate → see NO_SHIP → fix → see SHIP
   - Copy-paste commands that work

3. **Docs**
   - Quickstart, Concepts (Truthpack, ISL, Ship Score), CLI reference
   - Can start as GitHub wiki or simple Docusaurus/Nextra

### Phase C: Distribution (Week 3–4)

1. **GitHub**
   - Repo: `shipgate/shipgate` or keep `guardiavault-oss/ISL-LANG` and brand as Shipgate
   - README: Shipgate branding, clear value prop
   - Topics: `ai-safety`, `code-verification`, `behavioral-contracts`, `ci-cd`, `typescript`

2. **Social**
   - HN launch: "I built Shipgate to stop AI from shipping fake features"
   - Twitter/X: Same post, link to demo
   - Dev.to, Reddit r/typescript, r/programming

3. **Integrations**
   - GitHub Action: `shipgate/gate-action@v1`
   - Cursor MCP: Already works; document as "Shipgate AI Firewall"
   - VS Code: Publish extension as "Shipgate"

---

## 4. Go-to-Market Narrative

### The Pitch

> AI coding assistants ship code fast. But they hallucinate — calling APIs that don't exist, using env vars you never defined, returning types that don't match your backend. The code compiles. Tests pass. But it doesn't work.
>
> **Shipgate** is a behavioral gate that blocks ghost features before merge. It auto-generates a Truthpack from your codebase (routes, env, contracts), then verifies every PR against it. When AI tries to call `POST /api/users/upgrade` but that route doesn't exist? **NO_SHIP.** When it uses `process.env.STRIPE_KEY` but you have `STRIPE_SECRET_KEY`? **Caught.**
>
> One command: `npx shipgate init`. Two minutes to first gate.

### Differentiators

- **Invisible setup** — Truthpack is auto-generated; you don't write ISL by hand
- **AI Firewall** — MCP integration blocks violations in Cursor/Copilot before they're accepted
- **Ship Score** — 0–100 score, not just pass/fail
- **Proof bundles** — Verifiable evidence for every decision (PROVEN, VIOLATED, etc.)
- **Reality Mode** — Playwright-based tests that actually run the code

---

## 5. Technical Rebrand Checklist

Files/areas to update for "Shipgate" branding:

| Location | Change |
|----------|--------|
| `package.json` (root) | `"name": "shipgate"` or keep monorepo name |
| `packages/islstudio/` | Consider rename to `packages/shipgate` |
| `docs/PRICING.md` | ISL Studio → Shipgate |
| `docs/OUTREACH.md` | ISL Studio → Shipgate, `islstudio` → `shipgate` |
| `README.md` | Add Shipgate as product name, ISL as language |
| `packages/cli/` | Binary: `shipgate` or `sg` |
| npm publish | `shipgate` or `@shipgate/cli` |
| GitHub Action | `shipgate/gate-action` |
| VS Code extension | Display name: Shipgate |
| `.cursor/rules/` | Reference Shipgate where relevant |

---

## 6. Monetization (From PRICING.md)

Keep the current philosophy; rebrand:

- **Free:** 25 rules, CLI, GitHub Action, evidence bundles, unlimited repos
- **Team ($29/user):** Custom rules, approval workflows, audit export
- **Enterprise:** SSO, compliance packs, multi-repo dashboard

**Update:** team@shipgate.dev, support@shipgate.dev

---

## 7. Success Metrics

| Metric | Target (3 months) |
|--------|-------------------|
| npm weekly downloads | 1,000+ |
| GitHub stars | 500+ |
| Repos using Shipgate | 50+ |
| HN front page | 1 launch |
| Enterprise inbound | 2+ |

---

## 8. Next Actions

1. [ ] Register `shipgate.dev` (or similar)
2. [ ] Create `SHIPGATE_REBRAND.md` with exact find-replace list
3. [ ] Publish `shipgate` to npm (replace placeholder)
4. [ ] Build minimal landing page
5. [ ] Record Three Big Lies demo (2 min)
6. [ ] Draft HN post
7. [ ] Update README with Shipgate branding

---

*Plan created: 2026-02-08*
