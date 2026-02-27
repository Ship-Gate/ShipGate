# Show HN Launch Posts - ISL Verify

## Version A: Evidence-First Angle

**Title:** Show HN: Proof bundles for AI-generated code — verifiable evidence of what was checked

**Body:**

Every AI tool says "trust us." We built a tool that says "here's the evidence."

ISL Verify produces cryptographically signed proof bundles documenting exactly what was verified in your codebase — and explicitly disclosing what wasn't.

**Every bundle includes:**
- **Verification Surface:** Languages, frameworks, tiers run, properties verified, properties out-of-scope
- **Evidence:** Code locations, test results, confidence scores
- **Residual Risk Ledger:** Every unverified property becomes a documented risk with mitigation steps
- **Signature:** Ed25519 tamper-proofing

**What it proves:**
- Static analysis proves import integrity, auth coverage, input validation, secret exposure
- Runtime testing verifies API contracts and auth enforcement
- Property-based testing catches edge cases
- Every claim backed by evidence. Every gap disclosed.

**What makes it different:**
- Structured honesty: verification surface explicitly declares scope
- Residual risks: unverified properties → documented risks with owners and severity
- Not a scanner — a verification system for governance
- Cryptographically signed proof bundles for audit trails

**Try it:**
```bash
npx isl-verify .
```

We scanned 10 AI-generated codebases and found 347 issues. ESLint caught 31%. TypeScript caught 18%. ISL Verify caught 76%. The 69 issues no other tool detected included: hallucinated package APIs, missing auth on payment endpoints, referenced env vars that don't exist.

The honest alternative to "trust me, the AI is fine."

GitHub: https://github.com/shipgate/shipgate
Docs: https://shipgate.dev/docs

---

## Version B: Benchmark-First Angle

**Title:** Show HN: We scanned 10 AI-generated codebases — here's what linters miss

**Body:**

Lead with findings: **347 issues across 10 AI-generated projects.**
- ESLint caught 31%
- TypeScript caught 18%
- ISL Verify caught 76%

**The 69 issues NO other tool detected:**
- Hallucinated package APIs (imports that don't exist)
- Missing auth on payment endpoints
- Referenced env vars that don't exist in .env.example
- SQL injection vectors ESLint missed
- Race conditions in async handlers

**The Problem:** If your team uses Cursor/Copilot/Claude, you have zero documentation of code quality. Linters catch syntax. Type checkers catch types. But behavioral bugs slip through.

**The Solution:** ISL Verify runs static analysis + runtime testing + property-based testing, then produces cryptographically signed proof bundles documenting what was checked.

**Proof Bundle = Verifiable Evidence:**
- Every property either PROVEN, PARTIAL, or explicitly NOT VERIFIED
- Links to specific code locations and test results
- Can be mapped to SOC 2, HIPAA, PCI-DSS controls
- Signed with Ed25519 for tamper-proofing

**Try it (no config needed):**
```bash
npx isl-verify .
```

Works on any TypeScript project. Open source core (MIT). VS Code extension with inline evidence display.

We built this because we were tired of AI code reviews that just say "looks good" without showing their work. Every claim should be backed by evidence.

GitHub: https://github.com/shipgate/shipgate
Live demo: https://shipgate.dev/playground

Full benchmark methodology: https://github.com/shipgate/shipgate/tree/main/bench/ai-verify-benchmark

---

## Version C: Compliance Angle

**Title:** Show HN: The missing audit trail for AI-generated code

**Body:**

**If your team uses Cursor/Copilot, you have zero documentation of code quality.**

SOC 2 auditors are starting to ask about AI code. HIPAA auditors want to know how you verify compliance. PCI-DSS auditors need proof of input validation and auth coverage.

"We ran ESLint" doesn't cut it anymore.

**ISL Verify produces proof bundles mapping to compliance controls:**
- SOC 2 CC6.1 (logical access controls) → auth coverage evidence
- SOC 2 CC7.2 (system monitoring) → runtime verification evidence  
- HIPAA 164.308(a)(1) (security management) → vulnerability scan evidence
- PCI-DSS 6.5.1 (injection flaws) → SQL injection prover evidence

**Every PR gets a signed verification certificate.**
Every property either PROVEN, PARTIAL, or explicitly disclosed as NOT VERIFIED.

**What it checks:**
- Static analysis: import integrity, auth coverage, input validation, secret exposure
- Runtime testing: API contracts, auth enforcement, error handling
- Property-based testing: edge cases, boundary conditions
- Behavioral testing: race conditions, async bugs

**Example output:**
```
Proof Bundle v2
Trust Score: 87/100
Verdict: SHIP

Properties:
✅ Auth Required on Protected Routes (PROVEN, 95% confidence)
✅ Input Validation on User-Submitted Data (PROVEN, 92% confidence)
⚠️ SQL Injection Protection (PARTIAL, 68% confidence)
   → 3/5 queries parameterized, 2 need review
❌ Rate Limiting on Public Endpoints (NOT VERIFIED)
   → No rate limiter detected
```

**The honest alternative to "trust me, the AI is fine."**

Try it:
```bash
npx isl-verify .
npx isl-verify . --compliance soc2 --output report.md
```

Works on any TypeScript project, no config. Open source core (MIT). VS Code extension shows inline evidence as you code.

GitHub: https://github.com/shipgate/shipgate
Compliance docs: https://shipgate.dev/compliance

We're not selling silver bullets. We're selling honesty: if we didn't check it, we say so. Every gap disclosed. Every claim backed by evidence.
