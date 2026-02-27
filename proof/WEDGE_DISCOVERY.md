# Wedge Discovery Framework

**Purpose:** Find the single segment where ISL wins first. You can't serve everyone — pick one wedge, dominate it, then expand.

---

## Wedge Scorecard

Fill this in for each candidate. Score 1–5 (5 = strongest).

| Wedge | Pain intensity | ISL fit | Distribution | Proof needed | Total |
|-------|----------------|---------|--------------|--------------|-------|
| Cursor power users | | | | | |
| GitHub/Copilot teams | | | | | |
| Enterprise compliance | | | | | |
| Startup/solo devs | | | | | |
| Dev agencies | | | | |

---

## Wedge 1: Cursor Power Users

**Who:** Developers who use Cursor daily, build features with AI, care about quality.

**Pain:**
- AI suggests code that compiles but breaks at runtime
- No way to verify AI output beyond "looks right"
- Trust gap: "Did it actually do what I asked?"

**Why ISL fits:**
- Spec-first → AI generates to spec → verify before accept
- MCP integration already exists (gate tool)
- Fits in-flow: verify before accepting AI suggestion

**Distribution:**
- Cursor Rules / MCP
- Cursor marketplace / extensions
- Content: "How I ship AI code with confidence"

**Proof needed:**
- [ ] Run proof benchmark, publish: "ISL caught 100% of known AI bugs in corpus"
- [ ] 5 Cursor users use ISL for 2 weeks, report: "X fewer bugs, Y faster iteration"
- [ ] Video: Prompt → AI code → ISL catches bug → fix → SHIP

**Risks:** Cursor may build this themselves. Move fast.

---

## Wedge 2: GitHub / Copilot Teams

**Who:** Teams using GitHub Copilot, want to gate AI code at PR level.

**Pain:**
- Copilot suggests code in PRs, reviewers can't verify everything
- No automated "does this match our intent?" check
- Merge first, discover bugs in prod

**Why ISL fits:**
- GitHub Action (isl-gate.yml) already exists
- Spec in repo = team contract
- Gate blocks merge on NO-SHIP

**Distribution:**
- GitHub Marketplace (ISL Gate Action)
- Docs: "Add this workflow to gate Copilot PRs"
- Partner with GitHub (stretch)

**Proof needed:**
- [ ] 10 teams run ISL gate on Copilot PRs for 1 month
- [ ] "ISL blocked X merges that would have shipped bugs"
- [ ] Case study: Team Y reduced prod incidents by Z%

**Risks:** Copilot has built-in filters. ISL is deeper (behavioral) — different value prop.

---

## Wedge 3: Enterprise Compliance

**Who:** Security, compliance, audit teams in regulated industries (fintech, healthcare, gov).

**Pain:**
- "We're adopting AI coding — how do we prove the code is correct?"
- Auditors want evidence, not "we reviewed it"
- Regulatory pressure: AI code needs assurance

**Why ISL fits:**
- Proof bundles = audit trail
- Spec = documented intent
- Gate = deterministic, reproducible

**Distribution:**
- Enterprise sales
- Compliance whitepaper
- Security conference talks

**Proof needed:**
- [ ] "ISL produces evidence bundles suitable for audit"
- [ ] 1 pilot customer in fintech/healthcare
- [ ] Map ISL outputs to SOC2/ISO controls

**Risks:** Sales cycle long. Need compliance expertise.

---

## Wedge 4: Startup / Solo Devs

**Who:** Indie hackers, small teams, shipping fast with AI.

**Pain:**
- No QA team — AI is the "junior dev"
- Can't afford to ship broken AI code
- Need simple, fast verification

**Why ISL fits:**
- `isl init --from-prompt` = zero spec authoring
- One-command gate
- Free, open source

**Distribution:**
- Twitter/X, indie hacker communities
- "Ship safe AI code in 5 minutes"
- Simple landing page + demo

**Proof needed:**
- [ ] 90-second demo (done)
- [ ] "Solo dev ships X with ISL, zero AI-induced bugs"
- [ ] Friction test: Can someone go from zero to gated in < 10 min?

**Risks:** Solo devs are price-sensitive. Need free tier that works.

---

## Wedge 5: Dev Agencies / Consultants

**Who:** Agencies building software for clients, need to deliver quality.

**Pain:**
- Clients don't trust "AI wrote it"
- Need to demonstrate quality
- Liability if AI code fails

**Why ISL fits:**
- "We verify all AI code with ISL" = sales pitch
- Evidence bundles = client deliverables
- Spec = client sign-off on intent

**Distribution:**
- Agency partnerships
- "How we ship AI code clients trust"

**Proof needed:**
- [ ] 1 agency uses ISL for client work
- [ ] Client case study: "We received verified evidence with every release"

---

## Next Steps

### This Week

1. **Run proof benchmark** — `pnpm proof:benchmark`
   - Generates `proof/PROOF_REPORT.md` — publish this
   - Claim: "ISL caught 100% of known bad code in our corpus"

2. **Pick one wedge** — Fill in the scorecard above. Commit for 90 days.

3. **Build wedge-specific proof** — Check off the "Proof needed" items for your wedge.

4. **Talk to 5 people in that wedge** — "When you use AI to write code, what goes wrong? Would you use something that verifies it before you ship?"

---

## Wedge Decision Template

```
I'm betting on: [WEDGE NAME]

Because:
- [Reason 1]
- [Reason 2]

For 90 days I will:
1. [Action 1]
2. [Action 2]
3. [Action 3]

Success = [measurable outcome]
```
