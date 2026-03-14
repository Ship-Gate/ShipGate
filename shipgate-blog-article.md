# ShipGate: The Verification Layer AI-Generated Code Has Been Missing

*Every AI coding tool has the same blind spot. Here's what we built to fix it.*

---

AI code generators write code faster than any human. But speed without verification is just a faster way to ship bugs. Cursor, Copilot, Claude, ChatGPT — they all generate code that compiles, passes linting, gets approved in PR review, and does absolutely nothing. Or worse: it does something dangerous that nobody catches until production.

ShipGate is a multi-tier verification pipeline that produces independently verifiable proof bundles for AI-generated code. It doesn't just scan for patterns — it tracks data flows across modules, reasons about code with SMT solvers, generates property-based tests, monitors runtime behavior, and creates cryptographic evidence of what was verified and how.

This is what it actually does.

---

## The Problem Nobody Else Is Solving

Existing tools were built for human developers writing code by hand. They assume the coder understands what they're writing. AI changes that assumption.

AI code generators produce three categories of failure that traditional tools miss entirely:

**Hallucinated APIs.** The model invents plausible-sounding functions that don't exist in any SDK. `prisma.user.findByEmail()` looks right, compiles with any-typed schemas, and fails at runtime. ShipGate's hallucination scanner resolves every import against actual package manifests, follows re-exports through barrel files using the TypeScript module resolver, and flags phantom packages across TypeScript, Go, Rust, and Java.

**Fake success patterns.** AI-generated catch blocks that return `{ success: true }` on error. Try/catch blocks that show success toasts when the operation failed. Functions that wrap `Promise.resolve({ delivered: true })` without calling any external service. ShipGate's fake-success detector and mock detector track object construction through variable assignments and bracket notation, not just literal patterns.

**Security blind spots at scale.** A human writes one SQL query and knows whether they parameterized it. AI generates 50 endpoints in an afternoon and loses track. ShipGate doesn't just grep for `+` next to `query` — it builds a cross-module taint graph using the TypeScript compiler API, tracks user input from `req.body` through function calls, template literals, and variable assignments to every dangerous sink, and reports unsanitized flows with the complete path.

---

## What ShipGate Actually Does

### 10 Integrated Detection Engines

Every time ShipGate runs — whether through the CLI, GitHub Action, VS Code extension, or hosted API — it executes a pipeline of specialized detectors. Each one targets a different failure mode, and any critical finding flips the verdict to **NO_SHIP**.

| Engine | What It Catches |
|--------|----------------|
| **Security Scanner** | SQL injection, XSS, SSRF, command injection, hardcoded secrets, auth bypass — across TypeScript, JavaScript, Python, Go, and Java (90+ patterns) |
| **Taint Tracker** | Unsanitized data flows from user input to dangerous sinks, tracked across module boundaries with TypeScript type checker integration |
| **Hallucination Scanner** | Ghost imports, phantom packages, deprecated APIs, barrel file re-export validation |
| **Mock Detector** | Hardcoded success returns, placeholder data arrays, dynamically constructed fake responses |
| **Fake Success Detector** | Try/catch blocks with success toasts on error, promise.catch returning success |
| **Phantom Dependency Scanner** | Imports not in package.json, typosquatting candidates via Levenshtein distance |
| **Auth Drift Detector** | Mismatches between ISL-declared auth requirements and actual route protection |
| **Supply Chain Verifier** | OSV.dev vulnerability lookup, lockfile integrity checking, typosquatting detection against 200+ popular packages |
| **Semgrep Integration** | 8 custom AI-specific rules plus Semgrep's auto config, with graceful fallback when not installed |
| **Race Condition Detector** | Shared mutable state in async handlers, TOCTOU patterns, database read-modify-write without transactions |

### Deep Analysis Beyond Regex

Most SAST tools match text patterns. ShipGate goes further with a type-checker-based deep analysis engine:

**Constant folding.** AI sometimes obfuscates secrets — `Buffer.from("c2tfbGl2ZV8...", "base64").toString()`, `String.fromCharCode(115, 107, 95, ...)`, split-and-concat across variables. ShipGate's constant folder evaluates these expressions at analysis time and checks the result against secret patterns.

**Computed sink resolution.** When code uses `element[propName] = userInput` instead of `element.innerHTML = userInput`, regex-based scanners miss it. ShipGate uses the TypeScript type checker to resolve `propName`'s literal type and flags it when it's `"innerHTML"`, `"outerHTML"`, or `"srcdoc"`.

**Interprocedural call graphs.** If a function takes user input, passes it through three helper functions, and eventually feeds it to a SQL query — ShipGate follows the entire chain using function summaries and type checker symbol resolution.

This is why ShipGate catches 68% of adversarial evasion techniques in our red-team test suite, compared to ~26% for Semgrep and ~16% for ESLint security plugins on the same evasion corpus.

### Formal Verification with SMT Solving

ShipGate doesn't stop at static analysis. For properties that can be expressed formally, it encodes ISL specifications into SMT-LIB and solves them with Z3:

- **String theory** for reasoning about string operations (length, concatenation, contains)
- **Array theory** for data structure access patterns
- **Real arithmetic** for numerical constraints
- **Quantifiers** for universal and existential properties

When Z3 produces a proof, the claim in the proof bundle is classified as `smt-proof`. When it can't, ShipGate falls back to property-based testing (classified as `pbt-exhaustive`) or static analysis. Every claim carries its method classification — there is no ambiguity about what was formally proven versus heuristically checked.

### Independently Verifiable Proof Bundles

This is the part that matters for compliance teams and auditors.

Every ShipGate verification run produces a **proof bundle** — a structured artifact containing:

- Per-claim evidence with method classification (`smt-proof`, `pbt-exhaustive`, `static-analysis`, `runtime-trace`, `heuristic`)
- SHA-256 bundle ID computed from canonical manifest content
- Optional HMAC-SHA256 signature for tamper detection
- SMT proof certificates when Z3's `produce-proofs` is enabled

The proof bundle is verified by a separate, independent **proof checker** — 462 lines of code with zero dependencies on the proof generator. An auditor can review the checker in an afternoon and verify any bundle without trusting the system that created it.

Proof bundles chain across versions. Each bundle references its predecessor, and the proof checker validates the chain is unbroken. If a property was formally proven in version 1.0 but downgraded to heuristic in version 1.1, ShipGate flags it as a regression.

### Runtime and Continuous Verification

Static analysis ends at deploy time. ShipGate continues:

**Runtime contract monitors.** From ISL specifications, ShipGate generates Express-compatible middleware that checks preconditions on request entry and postconditions on response. If a contract is violated at runtime, it reports to the dashboard.

**Production traffic verification.** A sampling middleware validates live requests and responses against ISL specs. Statistical anomaly detection catches latency spikes, error rate increases, and response schema drift using z-score and chi-squared analysis.

**Differential testing.** Given an ISL spec and two implementations (e.g., AI-generated vs. human-reviewed), ShipGate generates random inputs, sends them to both, and reports behavioral disagreements — with shrinking to find the minimal failing input.

**Continuous re-verification.** The dashboard watches for dependency updates and proof bundle drift. When your lockfile changes, it re-runs vulnerability checks. When your deployed code hash diverges from the verified bundle, it alerts.

---

## How It Fits Into Your Workflow

### CLI (runs locally, your code never leaves your machine)

```bash
npx shipgate init          # Auto-detect stack, generate specs
npx shipgate verify        # Full verification with proof bundle
npx shipgate scan --taint  # Taint analysis on its own
npx shipgate gate          # SHIP/NO_SHIP verdict
```

### GitHub Action (zero-config)

```yaml
- uses: shipgate/gate-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

The action posts a PR comment with the verdict, creates a GitHub Check Run, and uploads SARIF findings to GitHub Advanced Security. No ISL spec required — specless mode runs all 10 detectors automatically.

### VS Code / Cursor Extension

Real-time inline diagnostics as you type — debounced to 500ms, under 100ms per check. SQL injection, hardcoded secrets, eval usage, taint indicators, and mock patterns show as red and yellow squiggles with remediation hints. Full verification on save when enabled.

### Hosted API

```bash
curl -X POST https://app.shipgate.dev/api/v1/scan \
  -H "Authorization: Bearer sg_key_..." \
  -H "Content-Type: application/json" \
  -d '{"source": "...", "language": "typescript"}'
```

OpenAPI spec at `/api/v1/openapi.json`. Docker-ready for self-hosting.

### Plugin Ecosystem

Build custom checks with `npx create-shipgate-check my-check`. The `SpeclessCheck` interface is simple:

```typescript
interface SpeclessCheck {
  name: string;
  run(file: string, context: GateContext): Promise<GateEvidence[]>;
}
```

Register your check, and it runs in the gate pipeline alongside the built-in detectors.

---

## What ShipGate Cannot Do (and We Tell You)

We publish a formal soundness statement (`docs/SOUNDNESS.md`) that says exactly what is guaranteed and what isn't:

- **2 of 10 safety properties** are formally sound (import integrity for static imports, dependency safety relative to advisory databases)
- **1 property** is conditionally sound (auth enforcement, if the ISL spec is correct)
- **7 properties** are heuristic (SQL injection, XSS, secrets, SSRF, error handling, mock detection, type safety)
- Rice's theorem means we can never verify arbitrary semantic properties
- Cross-module data flow has known false negatives for dynamic imports and computed property chains
- Business logic correctness is not verified — ShipGate checks safety properties, not whether your checkout calculates tax correctly

This honesty is by design. A tool that claims to guarantee everything actually guarantees nothing.

---

## Why This Matters Now

The EU AI Act requires transparency about AI system capabilities and limitations. SOC 2 auditors are asking how teams verify AI-generated code. Enterprise security teams are evaluating every AI coding tool purchase against their risk framework.

ShipGate produces the artifact those conversations need: a proof bundle that says exactly what was checked, how it was checked, and what the result was. Not a green checkbox — a verifiable claim with evidence.

Every proof bundle maps to SOC 2 (CC6.1, CC6.2), HIPAA, PCI-DSS, and EU AI Act controls. The compliance report generator produces audit-ready documents, not template-filled PDFs.

---

## Pricing

**Open Source ($0/forever):** CLI with all 10 detectors, GitHub Action, VS Code extension, unsigned proof bundles, 25 API scans per month. Your code never leaves your machine.

**Pro ($29/mo):** Dashboard with analytics, signed proof bundles, compliance mapping (SOC 2, HIPAA, EU AI Act), dynamic verification badges for READMEs, baseline mode, SARIF export, unlimited scans, priority support.

**Enterprise ($149/mo):** SSO/SAML, RBAC with audit log export, hosted verification API access, self-hosted deployment (Docker Compose), proof chains with regression detection, custom compliance frameworks, SLA with dedicated support.

---

## The One-Sentence Version

ShipGate is a multi-tier verification pipeline that produces independently verifiable proof bundles for AI-generated code — with formal soundness documentation that tells you exactly what it guarantees and what it doesn't.

That's a true statement. It's not "guaranteed safe" in the absolute mathematical sense — no tool can be. But it's the most rigorous, honest, and comprehensive verification pipeline for AI-generated code that exists today.

---

*ShipGate is open source. Install it now: `npx shipgate init`*

*Read the whitepaper: `docs/WHITEPAPER.md`*

*See the benchmark report: `docs/BENCHMARK_REPORT.md`*

*Review the soundness statement: `docs/SOUNDNESS.md`*
