# ShipGate CI Toolkit — Gumroad Page Copy
# Paste-ready. Edit prices before publishing.

---

## PRODUCT TITLE

ShipGate CI Toolkit — Local & CI Quality Gates for AI-Written Code

---

## SHORT DESCRIPTION (shown in listings)

One command. One verdict: SHIP or NO-SHIP. Stop shipping AI-generated code that passes linting but breaks in production. ShipGate runs behavioral verification, auth checks, placeholder detection, and env leak scanning locally and in CI — with consistent JSON output and a human-readable report.

---

## FULL GUMROAD PAGE COPY

---

### SHIP or NO-SHIP. Every commit. Every deploy.

Most quality tools tell you if your code is formatted.  
ShipGate tells you if it's **shippable**.

---

### The Problem

You're using Cursor, Copilot, or a custom AI agent to write code.  
The code looks fine. It lints. It compiles. It even has tests.

But somewhere in that AI-generated service there's a route with no auth guard.  
A function that always returns `null`.  
A hardcoded API key left in from a "temporary" fix.  
A spec that says the user must exist after creation — but the implementation forgets to save it.

**These don't show up in ESLint. They don't show up in TypeScript. They ship.**

ShipGate catches them before they do.

---

### How It Works

**Step 1 — Write a spec (or use an existing one)**
```
behavior RegisterUser {
  postconditions {
    success implies {
      - User.exists(result.id)
      - result.passwordHash != input.password
    }
  }
}
```

**Step 2 — Run the gate**
```bash
shipgate gate specs/user-auth.isl --impl src/auth --threshold 90
```

**Step 3 — Get a verdict**
```
  ┌─────────────────────────────────────┐
  │            ✓  SHIP                  │
  └─────────────────────────────────────┘

  Trust Score: 97%   Confidence: 88%
  Tests: 9 passed  0 failed  0 skipped

  Verified by Shipgate ✓
```

Or, if something's wrong:
```
  ┌─────────────────────────────────────┐
  │           ✗  NO-SHIP                │
  └─────────────────────────────────────┘

  Blocking Issues:
  • RegisterUser postcondition violated
    User.email !== input.email after successful creation
    File: src/auth/register.ts:44
```

---

### What Gates Catch

- **Behavioral failures** — pre/postconditions, invariants, error branches your spec defines
- **Auth gaps** — routes that require authentication in the spec but have no middleware in the implementation
- **Placeholder code** — `return null`, `return {}`, TODO comments, hardcoded stubs, fake data
- **Env leaks** — API keys, tokens, connection strings hardcoded in source files
- **Spec drift** — behaviors defined in your spec with no implementation, or implementation that never got specced
- **Chaos gaps** — missing error handling on I/O operations (strict preset)

---

### What You Get

**CLI**
- `shipgate gate` — full verdict with proof bundle
- `shipgate verify` — behavioral verification only
- `shipgate heal` — auto-fix flagged findings
- `shipgate drift` — spec-to-implementation drift report
- `shipgate coverage` — behavioral coverage percentage
- `shipgate trust-score` — score + confidence breakdown
- `shipgate compliance soc2` — SOC2 control mapping
- `shipgate lint` / `shipgate fmt` — spec quality tools

**Config Presets**
- `baseline` — 90% threshold, 4 core gates. Good starting point.
- `strict` — 95% threshold, all gates, fail-on-warn. For main branch protection.
- `ai-heavy` — 80% threshold, aggressive placeholder + drift detection. For fully AI-generated repos.

**CI Templates**
- GitHub Actions (with PR annotations and step summary)
- GitLab CI (with Code Quality artifact)
- CircleCI config

**Git Hooks**
- `pre-commit` — gate staged specs before commit
- `pre-push` — full gate before push to protected branches

**Demo Project**
- Working ISL spec + TypeScript implementation
- Expected output JSON so you know exactly what to compare against

**Output Schema**
- `shipgate-report.schema.json` — canonical JSON contract
- Consistent `verdict`, `score`, `confidence`, `findings[]`, `gates[]`, `metadata` across all commands
- Deterministic `fingerprint` for audit trails

---

### Demo Commands

```bash
# Install
npm install -g @shipgate/cli

# Gate the included demo project
shipgate gate examples/demo-repo/specs/user-service.isl \
  --impl examples/demo-repo/src \
  --threshold 90

# Gate your own project
shipgate gate specs/ --impl src --threshold 90 --output .shipgate/report.json

# CI mode — JSON to stdout, exit 1 on FAIL
shipgate gate specs/ --impl src --threshold 95 --ci

# Check a specific finding
cat .shipgate/report.json | jq '.findings[] | select(.severity == "critical")'
```

---

### Sample JSON Output

```json
{
  "verdict": "PASS",
  "score": 97,
  "confidence": 88,
  "summary": { "total": 9, "passed": 9, "failed": 0, "blockerCount": 0 },
  "gates": [
    { "id": "behavioral", "status": "pass", "score": 97, "findingsCount": 0 },
    { "id": "auth",        "status": "pass", "score": 100, "findingsCount": 0 },
    { "id": "placeholder", "status": "pass", "score": 100, "findingsCount": 0 },
    { "id": "env",         "status": "pass", "score": 100, "findingsCount": 0 }
  ],
  "findings": [],
  "metadata": {
    "toolVersion": "1.0.0",
    "preset": "baseline",
    "threshold": 90,
    "timestamp": "2026-01-15T14:32:11Z",
    "fingerprint": "a3f8c12d90e4b567"
  }
}
```

---

### What It Is NOT

- Not a linter. ESLint already does that.
- Not a type checker. TypeScript already does that.
- Not a test runner. Vitest already does that.
- Not a static analyzer that complains about semicolons.
- Not SaaS. No account. No data leaves your machine.
- Not a security scanner. It catches common patterns but is not a substitute for a dedicated security audit.
- Not magic. It works best when you write ISL specs for your behaviors. The better your spec, the stronger the verdict.

---

### Pricing Tiers

---

**Tier A — Solo Dev**  
**$49 one-time**

- 1 developer, personal use only
- Baseline preset
- GitHub Actions template
- Demo project + output schema

---

**Tier B — Pro Founder**  
**$149 one-time**

Everything in Solo, plus:
- Commercial use (one organization)
- Up to 3 developers
- All 3 presets (baseline, strict, ai-heavy)
- All CI templates (GitHub, GitLab, CircleCI)
- Git hooks pack
- Priority email support

---

**Tier C — Team**  
**$399 one-time**

Everything in Pro, plus:
- Up to 10 developers
- Agency use: gate client projects (no resale of toolkit)
- Gate Pack add-ons unlocked (AI Hallucination, Security Baseline)
- Priority support with 1-business-day response

---

**Add-ons (sold separately)**

- **Gate Pack: AI Hallucination** — $49 — Fake route detection, placeholder response catching, hardcoded-ID scanning, hallucinated-import detection
- **Gate Pack: Security Baseline** — $49 — OWASP Top 10 patterns, SQL injection surface, secret exposure, missing rate limiting
- **CI Pack: Multi-Provider** — $29 — Azure DevOps, Bitbucket Pipelines, Jenkins Jenkinsfile templates

---

### License Summary

- **Allowed:** Internal use, modification of configs and templates, using ShipGate-produced reports in your own deliverables
- **Not allowed:** Reselling or redistributing the toolkit, offering it as a competing product
- **Agency use:** Allowed for client projects under Team tier, no resale of toolkit files

---

### FAQ

**Q: Do I need to write specs for every file?**  
No. Start with your most critical behaviors — auth, data mutations, external integrations. ShipGate gates the behaviors you spec. Files without specs get a specless verification which still catches placeholders and env leaks.

**Q: Does this work with TypeScript? JavaScript? Python?**  
The CLI gates TypeScript and JavaScript implementations out of the box. The ISL spec language is implementation-language-agnostic. Python support is in the roadmap.

**Q: Will it break my existing CI pipeline?**  
No. The CI templates use `continue-on-error: true` on the gate step and only fail at a dedicated "Fail if NO-SHIP" step. You can integrate incrementally.

**Q: What if my score is 89% and threshold is 90%?**  
You get NO-SHIP. Fix the blockers or lower the threshold in your config. The toolkit is explicit about why the gate failed — check `findings[]` in the JSON output.

**Q: Can I use this without ISL specs?**  
Some gates (placeholder, env, auth pattern detection) run without specs. Behavioral verification requires a spec. Start with spec-less mode and add specs as you go.

**Q: Do I need an API key or account?**  
No. Everything runs locally. No data leaves your machine.

**Q: How is this different from SonarQube / CodeClimate?**  
Those tools check code quality patterns. ShipGate checks behavioral correctness — whether your implementation actually does what you said it would do, not just whether it's clean code.

**Q: What if I'm already using Vitest/Jest?**  
ShipGate does not replace your test suite. It adds a verification layer above it that checks spec compliance. Run both.

**Q: Can I run this in a monorepo?**  
Yes. Run `shipgate gate` in each package directory, or point `--impl` at the specific package's src folder.

**Q: What's the output format for GitLab?**  
Use `--format gitlab` to produce a GitLab Code Quality JSON artifact. The GitLab CI template handles this automatically.

---

### CTA

**→ Download ShipGate CI Toolkit**

Spend 5 minutes setting this up. The next time your AI-generated auth service ships without a middleware guard, you'll know you didn't.

---

## THANK-YOU PAGE COPY

---

### You're set. Here's what to do in the next 10 minutes.

1. **Unzip the toolkit** into a safe location (not inside your project, it's a toolkit — copy files out as needed)

2. **Run the demo first:**
   ```bash
   npm install -g @shipgate/cli
   shipgate gate examples/demo-repo/specs/user-service.isl \
     --impl examples/demo-repo/src \
     --threshold 90
   ```
   You should see SHIP with score 97%.

3. **Copy the GitHub Actions template** into your main repo:
   ```bash
   mkdir -p .github/workflows
   cp ci/github-actions/shipgate.yml .github/workflows/shipgate.yml
   ```

4. **Join the mailing list** (optional) — get notified when Gate Pack add-ons and major updates drop: support@shipgate.dev

---

### Upgrade

If you bought Solo and want commercial use or the strict preset, reply to your purchase receipt email or email support@shipgate.dev with your order ID. We'll send a discounted upgrade link.

---

## DEMO ASSETS PLAN

### 5 Screenshots to Capture

1. **Verdict screen** — Terminal showing the green `✓ SHIP` or red `✗ NO-SHIP` banner with score and confidence
2. **JSON output** — `cat .shipgate/report.json | jq` showing structured findings array
3. **CI pass** — GitHub Actions workflow run showing green ShipGate step with step summary
4. **Config preset** — VS Code showing the `baseline.json` preset file with gate weights
5. **Findings list** — Terminal output of a NO-SHIP run showing 2–3 blocking findings with file:line and recommendations

### Demo GIF/Video Storyboard (30 seconds)

```
0:00–0:05  Terminal: type `shipgate gate specs/ --impl src --threshold 90`
0:05–0:10  Spinner appears: "ShipGate: checking 4 gates..."
0:10–0:18  NO-SHIP banner appears, two findings listed (placeholder + auth gap)
0:18–0:22  Cut: fix the auth gap (add middleware), re-run
0:22–0:28  SHIP banner appears, score 97%, "Verified by Shipgate ✓"
0:28–0:30  ShipGate logo fade-out
```

### Command Snippet for Gumroad Page

```bash
$ shipgate gate specs/ --impl src --threshold 90

  ┌─────────────────────────────────────┐
  │            ✓  SHIP                  │
  └─────────────────────────────────────┘

  Trust Score: 97%   Confidence: 88%
  Tests: 9 passed  0 failed

  Verified by Shipgate ✓
```
