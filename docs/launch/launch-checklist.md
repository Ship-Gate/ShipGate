# Launch Checklist — 2-Week Sprint

## Week 1: Pre-Launch (Days 1–7)

### Day 1 (Monday) — Foundation

| Task | Owner | Done |
|------|-------|------|
| Final README merged to main | You | [ ] |
| `packages/cli/package.json` polished (keywords, description, files) | You | [ ] |
| Run `npm pack --dry-run` — verify only intended files included | You | [ ] |
| Run full test suite: `pnpm test` — all green | You | [ ] |
| Run `pnpm --filter shipgate build` — clean build | You | [ ] |
| Tag v2.1.1 release on GitHub | You | [ ] |

**Metrics:** Build passing. Test suite green. Package contents verified.

### Day 2 (Tuesday) — npm + GitHub Release

| Task | Owner | Done |
|------|-------|------|
| `npm publish` — package live on npm registry | You | [ ] |
| Verify: `npx shipgate --version` works from clean install | You | [ ] |
| Write GitHub Release notes (changelog for v2.1.1) | You | [ ] |
| Upload evidence bundle + demo output as release assets | You | [ ] |
| Verify `shipgate init` → `shipgate verify` flow on a fresh project | You | [ ] |

**Metrics:** npm download count (baseline). GitHub stars (baseline).

### Day 3 (Wednesday) — Docs + Landing Page

| Task | Owner | Done |
|------|-------|------|
| Deploy Getting Started + CLI Reference to docs site | You | [ ] |
| Deploy landing page to shipgate.dev | You | [ ] |
| Verify all links on landing page work | You | [ ] |
| Test Quick Start instructions on macOS, Linux, Windows (WSL) | You + Community | [ ] |
| Set up analytics on landing page (Plausible or Simple Analytics — no cookies) | You | [ ] |

**Metrics:** Docs page views. Landing page bounce rate.

### Day 4 (Thursday) — Demo + Visual Assets

| Task | Owner | Done |
|------|-------|------|
| Record terminal demo using VHS (`vhs demo.tape`) | You | [ ] |
| Embed GIF in README | You | [ ] |
| Create ProductHunt media assets (hero, screenshots) | Need designer | [ ] |
| Create Open Graph image for shipgate.dev (for social sharing) | Need designer | [ ] |
| Record 60-second Loom walkthrough (backup for non-GIF contexts) | You | [ ] |

**Metrics:** Demo GIF file size < 5MB. Loom view count (after share).

### Day 5 (Friday) — Community Setup

| Task | Owner | Done |
|------|-------|------|
| Create Discord server with channel structure from plan | You | [ ] |
| Write #welcome, #rules, #getting-started pinned messages | You | [ ] |
| Invite 10–15 early testers from personal network | You | [ ] |
| Post 5 seed conversations in #general | You | [ ] |
| Configure bot commands (!docs, !install, etc.) | You | [ ] |
| Set up "Founding Member" role with perks | You | [ ] |

**Metrics:** Discord member count. Messages in #general.

### Day 6 (Saturday) — Content Prep

| Task | Owner | Done |
|------|-------|------|
| Finalize Twitter thread (all 10 tweets) | You | [ ] |
| Finalize HN "Show HN" post body | You | [ ] |
| Finalize ProductHunt submission (description, first comment) | You | [ ] |
| Schedule ProductHunt launch for Tuesday (Day 9) | You | [ ] |
| Write blog post: "Why We Built ShipGate" (technical, 1500 words) | You | [ ] |

**Metrics:** Content quality check — read each piece out loud. Does it sound like a developer? Cut anything that doesn't.

### Day 7 (Sunday) — Buffer + Final Review

| Task | Owner | Done |
|------|-------|------|
| Re-test `npm install -g shipgate && shipgate init && shipgate verify src/` | You | [ ] |
| Review all launch copy one final time | You | [ ] |
| Prepare DM list: 20 devs/influencers to ping on launch day | You | [ ] |
| Dry run: preview ProductHunt submission (don't submit) | You | [ ] |
| Rest. Launch week is intense. | You | [ ] |

---

## Week 2: Launch Week (Days 8–14)

### Day 8 (Monday) — Soft Launch

| Task | Owner | Done |
|------|-------|------|
| Post Twitter thread (10 tweets) at 10am ET | You | [ ] |
| Post blog: "Why We Built ShipGate" on dev.to / Hashnode | You | [ ] |
| Share in 3-5 relevant Discord communities (not spammy — genuine) | You | [ ] |
| DM 10 developer friends with a personal "I shipped this" message + link | You | [ ] |
| Monitor npm downloads, GitHub stars, Discord joins | You | [ ] |

**Metrics:** Twitter impressions. Blog views. npm downloads (target: 100 on day 1).

**Publish:** Twitter thread, blog post.

### Day 9 (Tuesday) — ProductHunt Launch Day

| Task | Owner | Done |
|------|-------|------|
| ProductHunt goes live at 12:01am PT | You | [ ] |
| Post maker comment immediately | You | [ ] |
| Respond to every PH comment within 30 minutes | You | [ ] |
| Share PH link on Twitter, LinkedIn, Discord | You | [ ] |
| DM remaining 10 devs/influencers with PH link | You | [ ] |
| Monitor PH ranking hourly — engage with every question | You | [ ] |

**Metrics:** PH upvotes (target: 100+). PH comments. Referral traffic to GitHub/npm.

**Publish:** ProductHunt submission.

### Day 10 (Wednesday) — Hacker News

| Task | Owner | Done |
|------|-------|------|
| Post "Show HN" at 10am ET (peak HN traffic) | You | [ ] |
| Respond to every HN comment — technical, honest, non-defensive | You | [ ] |
| If HN gains traction: post the pre-written "Why not tests?" reply | You | [ ] |
| Monitor GitHub issues from HN traffic (people will file bugs) | You | [ ] |
| Triage and respond to every new GitHub issue same-day | You | [ ] |

**Metrics:** HN points (target: 50+). GitHub issues from HN. npm daily downloads spike.

**Publish:** Show HN post.

### Day 11 (Thursday) — Community Momentum

| Task | Owner | Done |
|------|-------|------|
| Post "Day 3 Update" tweet: stats, feedback, what you're fixing | You | [ ] |
| Fix any bugs reported from PH/HN (fast turnaround = trust) | You | [ ] |
| Push patch release if needed (npm publish) | You | [ ] |
| Host first Discord Q&A (30 min, casual, text-based) | You | [ ] |
| Cross-post blog to Medium and LinkedIn | You | [ ] |

**Metrics:** Bug fix turnaround time. Discord active members.

### Day 12 (Friday) — Deepen

| Task | Owner | Done |
|------|-------|------|
| Write and publish: "ISL in 5 Minutes" tutorial (practical, no theory) | You | [ ] |
| Share in r/programming, r/node, r/typescript (if appropriate) | Community | [ ] |
| Review and merge any community PRs | You | [ ] |
| Update docs based on FAQ patterns from PH/HN/Discord | You | [ ] |

**Publish:** ISL tutorial.

### Day 13 (Saturday) — Reflect

| Task | Owner | Done |
|------|-------|------|
| Compile launch metrics report (downloads, stars, PH rank, HN points) | You | [ ] |
| Identify top 3 feature requests from community feedback | You | [ ] |
| Plan next 2-week sprint based on feedback | You | [ ] |
| Thank every contributor, reporter, and early adopter personally | You | [ ] |

### Day 14 (Sunday) — Ship the Retrospective

| Task | Owner | Done |
|------|-------|------|
| Write "Launch Retrospective" blog: what worked, what didn't, numbers | You | [ ] |
| Post launch week stats on Twitter | You | [ ] |
| Set v2.2.0 milestone on GitHub based on top feature requests | You | [ ] |

**Publish:** Retrospective blog.

---

## Key Metrics Dashboard

Track these daily during launch week:

| Metric | Baseline | Day 8 | Day 9 | Day 10 | Day 11 | Day 12 |
|--------|----------|-------|-------|--------|--------|--------|
| npm daily downloads | | | | | | |
| GitHub stars | | | | | | |
| Discord members | | | | | | |
| PH upvotes | — | — | | | | |
| HN points | — | — | — | | | |
| GitHub issues (new) | | | | | | |
| Landing page visits | | | | | | |
| Blog post views | | | | | | |

---

## Emergency Playbook

**If npm publish fails:** Fix, re-tag, re-publish. Don't launch without a working `npx shipgate --version`.

**If HN/PH surfaces a real bug:** Fix within 4 hours. Push patch. Comment with the fix. Speed of response matters more than the bug existing.

**If HN is hostile:** Stay technical. Answer every objection with code examples, not marketing language. Acknowledge limitations honestly. "You're right, the Python codegen is thinner than TypeScript right now" > "We're working on it!"

**If traffic overwhelms docs/landing page:** It's a static site. It won't go down. If npm registry has issues (rare), tell people to clone from GitHub.
