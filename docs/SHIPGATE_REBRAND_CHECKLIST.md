# Shipgate Rebrand — Execution Checklist

Execute these changes to officially launch as **Shipgate**.

---

## Phase 1: Core Branding

### 1.1 Product Identity
- [x] Add to root README: "**Shipgate** — Stop AI from shipping fake features"
- [x] Subtitle: "Powered by ISL (Intent Specification Language)"
- [x] Update `docs/PRICING.md`: ISL Studio → Shipgate, team@shipgate.dev
- [x] Update `docs/OUTREACH.md`: ISL Studio → Shipgate, `npx islstudio` → `npx shipgate`

### 1.2 CLI & npm
- [x] Add `shipgate` as primary binary in `packages/islstudio` (renamed to shipgate package)
- [ ] Publish to npm as `shipgate` (check name availability: `npm search shipgate`)
- [ ] Update quickstart: `npx shipgate init` / `npx shipgate gate`

### 1.3 Domain
- [ ] Register shipgate.dev (or shipgate.io)
- [ ] Set up redirect: shipgate.dev → GitHub or landing page

---

## Phase 2: User-Facing Copy

### 2.1 Find-Replace (case-sensitive)
| Find | Replace |
|------|---------|
| ISL Studio | Shipgate |
| islstudio | shipgate |
| islstudio.dev | shipgate.dev |
| @islstudio | @shipgate |

### 2.2 Package Display Names
- [ ] `packages/islstudio`: Consider rename to `packages/shipgate` or keep internal
- [ ] VS Code extension: Display name "Shipgate"
- [ ] GitHub Action: `shipgate/gate-action` (new repo or rename)

---

## Phase 3: What Stays "ISL"

Keep these as ISL (the language):
- ISL (Intent Specification Language)
- ISL files (.isl)
- ISL parser, typechecker, evaluator
- `isl check`, `isl gen`, `isl verify` (CLI subcommands)
- @isl-lang/* package scope (internal)

**Rule:** ISL = the spec language. Shipgate = the product that uses it.

---

## Phase 4: Launch Assets

- [x] Landing page (demos/playwright-showcase: hero, pricing, FAQ, /pricing, /dashboard)
- [ ] Deploy landing (Vercel/Netlify or GitHub Pages)
- [ ] Demo video (Three Big Lies, 2 min)
- [ ] HN post draft
- [ ] Twitter/X post
- [ ] Logo (optional: gate icon + "Shipgate")

---

## Quick Wins (Do First)

1. **README**: Add one line at top: "**Shipgate** — Stop AI from shipping fake features. [Learn more](link)."
2. **npm**: Publish `shipgate` package pointing to current CLI
3. **Docs**: Create `shipgate.dev` redirect to repo/docs

---

---

## Subscription product (playwright-showcase)

- [x] Dedicated `/pricing` page with Free / Team / Enterprise and CTAs
- [x] Clerk auth (optional): sign-in, sign-up, UserButton, Dashboard link
- [x] Stripe: checkout session (Team trial), customer portal, webhook handler
- [x] Dashboard: current plan, “Manage billing”, “Upgrade to Team”, contact sales
- [x] `SUBSCRIPTION_SETUP.md` in demos/playwright-showcase for env and wiring

To go live: set `VITE_CLERK_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_TEAM_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`; implement webhook TODOs to persist plan/customerId.

---

*Run `rg -l "ISL Studio|islstudio"` to find all files needing updates.*
