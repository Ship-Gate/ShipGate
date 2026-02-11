# Shipgate Landing Page Refactor — Summary

## 1. Repo Audit Summary

### Stack
- **Framework:** Vite + React (demos/playwright-showcase)
- **Router:** react-router-dom v6
- **Styling:** Tailwind CSS, custom CSS (index.css, ContentCard.css)
- **Animation:** Framer Motion (existing), GSAP (added), Lenis (CDN + npm)

### Landing Entry Points
- **Primary:** `demos/playwright-showcase/src/pages/Landing.tsx`
- **App shell:** `demos/playwright-showcase/src/App.tsx` (routes, StarBackground, MagicalNavbar)
- **Index:** `demos/playwright-showcase/index.html`

### Current Product Truth (Shipgate)
- **CLI commands:** `shipgate init`, `shipgate verify`, `shipgate gate`
- **Config:** `.shipgate.yml` (not `.shipgate/config.yml`)
- **Verdicts:** SHIP, NO_SHIP
- **Integrations:** VS Code, GitHub Actions (unified-gate.yml), SARIF/JSON
- **Artifacts:** Proof bundles, trust scores, evidence, HTML reports

### Existing Motion Libs
- Framer Motion (framer-motion)
- Lenis (CDN: unpkg.com/@studio-freight/lenis; also npm)
- GSAP (newly added)

### Design System
- Tailwind with intent/trust color tokens
- Design rules: green (#4ADE80) to teal (#0D9488) gradient; Instrument Serif + DM Sans

---

## 2. Proposed New Page Outline

| Section | Content |
|---------|---------|
| 1. Top Nav | Product name + How it works, Integrations, Docs, Pricing + Install CTA |
| 2. Hero | Headline, subhead, 3 bullets, Get Started + View Docs |
| 3. Solution | ISL spec + violation side-by-side |
| 4. How it works | 3 steps: init → verify → gate |
| 5. Terminal demo | Animated shipgate init + verify output |
| 6. Integrations | VS Code, GitHub Actions, SARIF/JSON |
| 7. Proof / Artifacts | Proof bundles, trust scores, HTML reports |
| 8. Use cases | Platform engineering, security, AI-assisted dev |
| 9. Pricing | Free, Team ($29/user/mo), Enterprise (Contact) |
| 10. FAQ | 6 dev-focused Q&As |
| 11. Footer | Docs, GitHub, Privacy, Security, Contact |

---

## 3. Final Copy

### Hero
- **Headline:** Stop AI from shipping fake features
- **Subhead:** Contracts and intent specs → verify → report → CI/IDE. Enterprise-grade verification for AI-generated code.
- **Bullets:** Behavioral contracts (ISL) | SHIP / NO_SHIP verdicts | Local-first, no code upload
- **Primary CTA:** Get Started
- **Secondary CTA:** View Docs

### How It Works (3 steps)
1. **shipgate init** — Auto-generates truthpack and config. Detects routes, env vars, and creates .shipgate.yml in seconds.
2. **shipgate verify** — Verifies implementation against ISL specs. Catches ghost routes, intent mismatches, and security violations.
3. **shipgate gate** — Deterministic SHIP/NO_SHIP verdict. Blocks broken code from merging. One YAML line in CI.

---

## 4. Final File Tree (Changed Subtree)

```
demos/playwright-showcase/
├── index.html                      # Fonts updated
├── package.json                    # gsap, @studio-freight/lenis added
├── src/
│   ├── index.css                   # DM Sans, Instrument Serif, prefers-reduced-motion
│   ├── lib/
│   │   └── motion.ts               # NEW: GSAP + Lenis orchestrator
│   ├── App.tsx                     # Hide MagicalNavbar on landing
│   ├── components/
│   │   ├── ShipgateFooter.tsx      # Updated links, enterprise styling
│   │   ├── SolutionSection.tsx     # Enterprise styling
│   │   └── TerminalDemo.tsx        # Enterprise styling
│   ├── data/
│   │   ├── pricing.ts              # Free, Team $29, Enterprise Contact
│   │   └── terminal-content.ts    # .shipgate.yml fix
│   └── pages/
│       └── Landing.tsx             # Full refactor
```

---

## 5. Run / Build Commands

```bash
# From repo root
pnpm --filter playwright-showcase dev

# Or from demos/playwright-showcase
cd demos/playwright-showcase
pnpm dev

# Build
pnpm --filter playwright-showcase build
```

---

## 6. QA Checklist

### Responsive
- [ ] Mobile (375px): nav collapses, sections stack, touch targets ≥44px
- [ ] Tablet (768px): grid layouts adapt
- [ ] Desktop (1280px+): 12-col feel, max-width containers

### Accessibility
- [ ] Semantic headings (h1 → h2 → h3)
- [ ] Focus states on buttons/links
- [ ] Contrast ≥4.5:1 for body text
- [ ] `prefers-reduced-motion` disables Lenis and reduces GSAP animations

### Performance
- [ ] Lighthouse Performance >80
- [ ] No blocking scripts
- [ ] Images optimized if added

### Motion
- [ ] Hero fade-in on load
- [ ] Section headers reveal on scroll (GSAP ScrollTrigger)
- [ ] Cards stagger in
- [ ] Reduced motion: animations disabled or minimal

### Known Limitations
- StarBackground still wraps the page (stars layer); Landing uses solid `bg-zinc-950`
- MagicalNavbar hidden on "/" only; other routes retain it
- Privacy/Security footer links point to `/privacy` and `/security` (may 404 if routes missing)
