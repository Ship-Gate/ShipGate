# Hacker News Post — ShipGate

## Title (pick one):

**Primary:** Show HN: ShipGate – SHIP/NO_SHIP verdict for every commit, with tamper-proof evidence

**Alternatives:**
- Show HN: I built a gate that blocks AI-generated code from shipping fake features
- Show HN: ShipGate – 25 rules that catch what linters miss in AI-generated code
- Show HN: Intent specs + runtime verification = trust score for AI code

---

## Post Body:

I built ShipGate — a CLI that gives every commit a SHIP or NO_SHIP verdict with evidence you can audit.

**The problem:** AI coding tools generate code that compiles, passes lint, and looks correct. Then it ships with empty function bodies, hallucinated API calls, missing auth checks, and PII in logs. Code review catches some of it. Production catches the rest.

**What ShipGate does:**

```
shipgate init      # auto-generates behavioral specs from your codebase
shipgate verify    # catches fake features, hallucinated APIs, security gaps
shipgate gate      # SHIP or NO_SHIP — use in CI to block merges
```

It works in two layers:

1. **Firewall (zero config)** — 25 built-in rules across 5 policy packs: auth bypass, PII exposure, payment issues, missing rate limits, and intent violations. Runs against a "truthpack" of your actual routes, env vars, and contracts. Catches ghost routes, ghost imports, ghost env vars.

2. **ISL Specs (optional, deeper)** — Write behavioral contracts in ISL (Intent Specification Language). Preconditions, postconditions, invariants. ShipGate generates tests, runs them, and produces a trust score (0-100).

Example ISL spec:

```isl
domain Auth {
  entity User {
    id: UUID
    email: String @unique
    invariants { email.is_valid() }
  }

  behavior Login {
    input { email: String, password: String }
    output { token: JWT, errors { INVALID_CREDS, LOCKED } }
    preconditions { email.is_valid() }
    postconditions {
      success implies result.token.expires_in <= 3600
    }
  }
}
```

Every run produces a tamper-proof **proof bundle** — JSON manifest with SHA-256 hashes, violation details, test results, and an HTML report you can attach to PRs.

**What's shipped:**

- CLI: `shipgate init`, `verify`, `gate`, `scan`, `compliance soc2`, `provenance`
- ISL parser with entities, behaviors, contracts, scenarios, chaos blocks, APIs, storage, workflows, events, screens
- 25 policy rules across 5 packs (auth, PII, payments, rate-limit, intent)
- VS Code extension with diagnostics, heal UI, and sidebar
- GitHub Action (`isl-gate`) for CI integration
- Proof bundles with HTML viewer and HMAC signatures
- SOC 2 compliance mapping from proof bundles
- AI provenance tagging (model, prompt digest, timestamps)
- LSP server for any editor

**Try it:**

```bash
npx shipgate init
npx shipgate verify src/
```

Or without specs (firewall only):

```bash
npx shipgate scan src/
```

**Open source.** MIT license. Core CLI, parser, firewall, all 25 rules, proof bundles — all free.

- GitHub: https://github.com/Ship-Gate/ShipGate
- npm: `npx shipgate`
- VS Code: Search "ShipGate" in extensions

In the age of AI code generation, verification matters more than generation. TypeScript checks types. ShipGate checks behavior.

---

## Follow-up comment (post immediately after):

Happy to answer questions about:

- How the 25 rules work (regex-based policy packs, not ML)
- Trust scoring algorithm (composite of contract coverage, test results, policy violations)
- ISL language design (why a new DSL instead of extending TypeScript)
- The truthpack concept (how we detect ghost routes/imports)
- Why SHIP/NO_SHIP instead of a score threshold

---

## Prepared Responses:

**Q: How is this different from ESLint/Semgrep/SonarQube?**

Linters check syntax patterns. ShipGate checks behavioral intent. ESLint can tell you a function exists. ShipGate can tell you it does nothing. The firewall layer catches things linters miss: ghost routes that exist in code but not in your router, env vars referenced but never set, imports that resolve to empty modules. The ISL layer goes further — verifying that implementations satisfy preconditions and postconditions.

**Q: Why a new DSL instead of TypeScript decorators or JSDoc?**

ISL is stack-agnostic. Same spec works whether you generate TypeScript, Python, or Go. It's also designed for AI consumption — LLMs can read ISL specs and generate implementations against them, then ShipGate verifies the output. TypeScript decorators would tie you to one runtime.

**Q: How is this different from TLA+/Alloy/formal methods?**

TLA+ proves properties of distributed systems. ShipGate verifies implementations of web apps. Different scale, different audience. We use runtime verification and property-based testing, not model checking. A working developer can write an ISL spec in 5 minutes. TLA+ takes weeks to learn.

**Q: Does it work with existing codebases?**

Yes. `shipgate init` scans your project, detects your stack, and auto-generates ISL specs. You can also run `shipgate scan` for firewall-only mode (no specs needed). Incremental adoption — start with one critical path.

**Q: What's the trust score?**

Composite of: precondition coverage, postcondition verification, invariant maintenance, policy violations, test pass rate. Not just pass/fail — it tells you exactly what's verified vs what's missing. Score < 70 = NO_SHIP by default (configurable).

**Q: Is the AI healing feature using an LLM?**

The healer uses deterministic fix recipes — not LLM-generated patches. Each of the 25 rules has a corresponding fix recipe that adds the missing enforcement (rate limiting, audit logging, input validation, etc.). The healer is constrained: it cannot remove intents, add suppressions, or downgrade severity. It can only strengthen code.

**Q: What about false positives?**

`shipgate-ignore <rule-id>` suppresses individual violations with justification. Allowlists in `.shipgate.yml` for known patterns. The firewall is tuned to minimize false positives — we benchmark against a corpus of real-world fixtures and track false positive/negative rates.

---

## Timing:

- **Post:** Tuesday-Thursday, 8-10 AM PST
- **Monitor:** First 30 min, respond to every comment
- **Backup:** If no traction in 2h, repost at 6 PM PST

## Posting Checklist:

- [ ] npm package published and `npx shipgate` works
- [ ] Landing page deployed (shipgate.dev or GitHub Pages)
- [ ] GitHub repo is public with clean README
- [ ] VS Code extension published
- [ ] Post between 8-10 AM PST on Tue-Thu
- [ ] Monitor and respond to all comments for first 2 hours
- [ ] Post on Twitter/X with same hook immediately after
- [ ] Cross-post to r/typescript, r/webdev if HN does well

## Metrics to Track:

- Upvotes in first hour (target: 50+)
- GitHub stars in 24h (target: 100+)
- npm installs in 24h (target: 200+)
- VS Code installs (target: 50+)
