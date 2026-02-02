# ISL Studio - Outreach Templates

## GitHub Issue Template (for open-source repos)

**Title:** Add ISL Studio Gate - Block auth/PII issues before merge

**Body:**

Hi 👋

I'd like to suggest adding [ISL Studio](https://github.com/ISL-Studio/ISL-Studio-) to this repo's CI. It's a free, zero-config gate that blocks common security issues before merge:

- Auth bypass patterns
- Hardcoded credentials
- PII in logs
- Missing rate limits
- Payment security issues

**Setup (2 minutes):**

```bash
npx islstudio init
git add .islstudio .github/workflows/isl-gate.yml
git commit -m "Add ISL Studio gate"
```

Or just add the GitHub Action:

```yaml
- uses: ISL-Studio/islstudio-gate-action@v1
```

**Why it's different:**

- Zero config to start
- Baseline support (doesn't break existing code)
- Evidence bundle for every decision
- 25 rules across auth/pii/payments/rate-limit/intent

Happy to open a PR if you're interested!

---

## Twitter/X DM Template

Hey! Built a free tool that blocks auth/PII issues in PRs before merge. 

Zero config: `npx islstudio init`

25 rules for auth bypass, hardcoded creds, PII logging, missing rate limits.

Would love feedback from [project name] - mind if I open a quick PR?

---

## Discord/Slack Message

**For dev communities:**

Just shipped ISL Studio - a free gate that blocks auth/PII issues before merge.

Quick demo: https://github.com/ISL-Studio/islstudio-hello-gate

- PR #1: NO_SHIP (auth bypass, PII in logs)
- PR #2: SHIP (fixed, 95/100)

Setup: `npx islstudio init`

25 rules, zero config, baseline for legacy code.

---

## Email Template (for maintainers)

**Subject:** Quick security gate for [project] PRs?

Hi [name],

I built ISL Studio - a free security gate that runs on PRs. It catches common issues:

- Auth bypass patterns
- Hardcoded credentials  
- PII in logs
- Missing rate limits

**2-minute setup:**
```bash
npx islstudio init
```

**What makes it different:**
- Zero config to start
- Baseline mode (doesn't break existing code)
- Tamper-proof evidence for every decision

Would you be open to a quick PR adding it to [project]?

Demo: https://github.com/ISL-Studio/islstudio-hello-gate

Best,
[Your name]

---

## Target Repo Criteria

**Good targets:**

1. **JS/TS APIs** (Express, Fastify, Nest, Hono)
   - Have auth endpoints
   - Handle user data
   - Active development

2. **Next.js apps** with API routes
   - Auth patterns
   - Data handling
   - Stripe integrations

3. **Open-source with active PRs**
   - Shows value immediately
   - Community can validate

**Look for:**
- `/login`, `/auth`, `/register` endpoints
- User data handling
- Payment integrations
- `console.log` statements
- Missing rate limiting

**Avoid:**
- Inactive repos (no PRs in 30 days)
- Pure frontend (no API)
- Already using competing tools

---

## Tracking Spreadsheet

| Repo | Stars | Last PR | Contact | Status | Notes |
|------|-------|---------|---------|--------|-------|
| example/api | 1.2k | 2d ago | @maintainer | Pending | Has auth, no rate limiting |
| ... | ... | ... | ... | ... | ... |

---

## Follow-up Template (if no response after 1 week)

Hey [name], just following up on the ISL Studio suggestion. Happy to:

1. Open a draft PR for you to review
2. Jump on a quick call to demo it
3. Answer any questions async

No pressure either way - just want to make sure it didn't get lost!

---

## Success Story Template (after adoption)

🎉 [Project] now uses ISL Studio!

Before: Auth bypass patterns could slip through
After: Every PR gets checked, evidence for every decision

Setup took 2 minutes. Try it: `npx islstudio init`
