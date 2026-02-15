# What Shipgate Does — and Can It Stop AI from Shipping Bad Code?

**Short answer: Yes.** When the gate is run in CI (or on every AI edit via the firewall), it can **block** bad or unsafe code from being merged and deployed. The gate returns a single verdict: **SHIP** or **NO_SHIP**. **NO_SHIP** means “do not merge”; in enforce mode, CI fails (exit code 1) and the PR cannot be merged.

---

## What the product actually does

Shipgate is a **gate** that runs in two complementary ways:

| Layer | What it checks | When it runs |
|-------|----------------|--------------|
| **Spec gate** | Implementation vs. ISL spec: preconditions, postconditions, invariants, generated tests | When you have an `.isl` spec and run the gate on spec + implementation |
| **Firewall** | Security and policy: 25+ rules (auth, PII, payments, rate-limit, intent) + ghost routes/env/imports | On every file you point at it (e.g. changed files in CI, or every AI edit in the IDE) |

- **One verdict:** SHIP or NO_SHIP. If either the spec gate or the firewall says NO_SHIP, the **unified gate** returns NO_SHIP.
- **One exit code:** 0 (SHIP) or 1 (NO_SHIP). CI uses this to block merge when the gate fails.
- **Evidence:** The gate produces an evidence bundle (and optional HTML report) so you can see *why* it failed (which rules, which lines, which tests).

So in practice the product:

1. **Parses and type-checks ISL specs** — invalid or inconsistent specs fail early.
2. **Verifies implementation against the spec** — runs generated tests for preconditions, postconditions, invariants; computes a trust score; fails if tests fail or score is below threshold.
3. **Scans code with the firewall** — detects hardcoded secrets, auth bypass, PII in logs, unsafe payment patterns, missing rate limiting, ghost routes/imports, and other policy violations.
4. **Makes a single SHIP/NO_SHIP decision** — and in CI, NO_SHIP means “block merge.”

---

## Can it stop AI from shipping bad code to production?

**Yes, under these conditions:**

1. **You run the gate in CI** (e.g. GitHub Action) in **enforce** mode. Then:
   - Every PR (or push) runs the unified gate.
   - If the verdict is **NO_SHIP**, the job fails (exit 1) and the PR cannot be merged.
   - So bad code that triggers a blocker **never gets merged** and therefore never reaches production via that flow.

2. **You run the firewall on AI-written edits** (e.g. via the Cursor rule + MCP). Then:
   - The AI is instructed to run the firewall on each modified file and not leave code in place if the result is NO_SHIP.
   - So many security/policy issues (secrets, auth bypass, PII in logs, etc.) are caught before commit.

**What gets caught:**

- **By the spec gate (when you have an ISL spec):**
  - Missing precondition checks (e.g. debit without checking balance, or without `amount > 0`).
  - Implementation that doesn’t satisfy postconditions or invariants (caught by generated tests and trust score).
  - Spec parse/type errors.

- **By the firewall (always, on the files you scan):**
  - Auth bypass, hardcoded credentials, JWT “none”, session fixation.
  - PII in logs, console.log in production, sensitive data in URLs.
  - Payment amount from client, missing webhook verification, missing idempotency.
  - Missing rate limiting on auth/password-reset/OTP.
  - Missing error handling, missing validation, storing secrets without encryption.
  - “Ghost” references: routes, env vars, or imports that don’t exist in your project (truthpack).

So: **logic bugs** (e.g. “forgot to check balance”) are caught by the **spec gate** when that behavior is specified in ISL and the generated tests run. **Security and policy bugs** are caught by the **firewall** even without a spec.

---

## What it does *not* do

- **It does not prove correctness in the mathematical sense.** It uses tests and pattern-based rules, not full formal verification.
- **It only checks what you run it on.** If you don’t run the gate in CI, or you don’t point it at the right files, it can’t block anything.
- **The spec gate only runs when you have an ISL spec.** Code with no spec is not checked for preconditions/postconditions by the spec gate; only the firewall runs (pattern-based security/policy).
- **The firewall is pattern-based.** It’s very good at the 25+ rules and ghost checks it knows; it won’t catch every possible bug or novel attack.

---

## How to use it so it actually stops bad code

1. **Add the gate to CI** (e.g. `.github/workflows/isl-gate.yml` or use the Shipgate GitHub Action). Set `mode: enforce` and `fail-on: blocker` (or `any` if you want any violation to block).
2. **Optionally use an ISL spec** for critical domains (e.g. auth, payments, transfers). Write behaviors with preconditions and postconditions; the gate will generate tests and fail if the implementation doesn’t satisfy them.
3. **Point the unified gate at changed files** (or the whole repo) so the firewall runs on the code that could go to production.
4. **In the IDE**, use the Cursor rule + firewall so the AI doesn’t leave NO_SHIP code in place.

Then: **if the gate says NO_SHIP, the code doesn’t get merged, and it doesn’t reach production** (for that pipeline). So yes — the product can stop AI (or human) from shipping bad code to production, for the kinds of issues it checks for and when it’s actually run in your workflow.
