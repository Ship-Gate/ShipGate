# README Updates for Launch

## Suggested README.md Structure

```markdown
# ISL Verify

**Evidence-producing verification system for AI-assisted development**

[![Trust Score](https://img.shields.io/badge/trust%20score-87%2F100-green)](https://shipgate.dev/proof-bundle)
[![CI](https://github.com/shipgate/shipgate/workflows/CI/badge.svg)](https://github.com/shipgate/shipgate/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/isl-verify.svg)](https://www.npmjs.com/package/isl-verify)

ISL Verify produces cryptographically signed, machine-verifiable evidence of what properties were actually checked in a codebase — and explicitly discloses what was not verified.

**It is not a security scanner. It is a verification system for governance.**

Every proof bundle includes:
- **Verification Surface:** Explicit scope declaration (languages, frameworks, properties verified, properties out-of-scope)
- **Evidence:** Code locations, test results, confidence scores
- **Residual Risk Ledger:** Every unverified property becomes a documented risk with mitigation steps
- **Signature:** Ed25519 tamper-proofing for audit trails

## Quick Start

```bash
# Run verification
npx isl-verify .

# Output
✅ Import integrity: 47/47 imports verified
⚠️ Auth coverage: 42/60 routes protected (18 missing auth)
❌ Input validation: 23 endpoints accept unvalidated input
✅ SQL injection: 0 vulnerabilities detected

Trust Score: 68/100
Verdict: NO_SHIP

Proof bundle → .shipgate/proof-bundle.json
```

## What Makes It Different

**Structured Honesty:**
- If we didn't check it → Explicitly declared in `explicitlyOutOfScope`
- If we checked it but can't prove it → PARTIAL with confidence score
- If we have evidence → PROVEN with code locations

**Governance-Ready:**
- Verification Surface declares exact scope
- Residual Risk Ledger documents gaps with owners and severity
- Bundle diffing tracks verification over time
- Cryptographically signed for tamper-proofing

**Not a linter. A governance system.**

---

## What It Verifies

| Property | How We Verify | Example Finding |
|----------|---------------|-----------------|
| **Import Integrity** | Cross-reference imports with package.json + node_modules | `import { x } from 'fake-pkg'` → package doesn't exist |
| **Auth Coverage** | Trace middleware chains on all routes | Payment endpoint missing auth middleware |
| **Input Validation** | Runtime testing with invalid inputs | Endpoint accepts unvalidated user input |
| **SQL Injection** | Taint analysis + parameterization check | Query uses string interpolation |
| **Secret Exposure** | Scan for hardcoded credentials | API key hardcoded in source |
| **Error Handling** | Runtime testing with edge cases | Endpoint returns 500 instead of 400 |
| **Race Conditions** | Property-based concurrent testing | Counter loses increments under load |

## Verification Surface (Structured Honesty)

Every bundle explicitly declares what was checked:

```json
"verificationSurface": {
  "languages": ["typescript", "javascript"],
  "frameworks": ["nextjs", "express"],
  "tiersRun": [1, 2],
  "propertiesVerified": [
    "import-integrity",
    "auth-coverage",
    "input-validation",
    "sql-injection",
    "error-handling"
  ],
  "explicitlyOutOfScope": [
    "rate-limiting",
    "csrf-protection",
    "business-logic-correctness",
    "performance-scalability"
  ]
}
```

**Why this matters:**
- Auditors can see exactly what was checked
- Security teams know what gaps exist
- No surprises in production

## Residual Risk Ledger

Every unverified property becomes a documented risk:

```json
"residualRisks": [
  {
    "id": "rate-limiting-e5f6a7b8",
    "risk": "No rate limiting verified",
    "impact": "Potential abuse via repeated requests",
    "reasonNotVerified": "No generic static indicator",
    "recommendedMitigation": "Add express-rate-limit middleware",
    "owner": "Engineering",
    "status": "acknowledged",
    "severity": "medium"
  }
]
```

**This turns limitations into governance value:**
- Security teams: documented risk acceptance
- Compliance: traceable mitigation steps
- Audit-compatible instead of "just a scanner"

## Installation

### CLI

```bash
npm install -g isl-verify

# Or use without installing
npx isl-verify .
```

### VS Code Extension

```bash
code --install-extension shipgate.shipgate-isl
```

**Features:**
- Inline evidence decorations (gutter icons show verification status)
- CodeLens on route handlers (`Auth: ✅ | Validation: ⚠️`)
- Proof bundle panel (trust score + property list)
- File badges in explorer (green/yellow/red)

### GitHub Action

```yaml
name: Verify
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: shipgate/action@v1
        with:
          verdict: ship
          min-score: 70
```

## Usage

### Basic Verification

```bash
isl-verify .
```

### Generate Compliance Report

```bash
isl-verify . --compliance soc2 --output report.md
```

Supported frameworks: `soc2`, `hipaa`, `pci-dss`, `iso27001`

### Verify Specific File

```bash
isl-verify src/routes/payment.ts
```

### CI Mode

```bash
isl-verify . --ci --min-score 70
# Exit code 0 if score ≥ 70, exit code 1 otherwise
```

### View Proof Bundle

```bash
cat .shipgate/proof-bundle.json
```

## Proof Bundle Example (Enterprise-Ready)

```json
{
  "version": "2.0.0",
  "bundleId": "sha256:7f3e9a2b1c4d...",
  "timestamp": "2026-02-17T16:40:00Z",
  
  "verificationSurface": {
    "languages": ["typescript"],
    "frameworks": ["nextjs"],
    "tiersRun": [1, 2],
    "propertiesVerified": [
      "import-integrity",
      "auth-coverage",
      "input-validation"
    ],
    "explicitlyOutOfScope": [
      "rate-limiting",
      "csrf-protection"
    ]
  },
  
  "properties": [
    {
      "id": "auth-coverage",
      "name": "Auth Required on Protected Routes",
      "status": "proven",
      "confidence": 0.95,
      "evidence": [
        {
          "type": "static-analysis",
          "status": "proven",
          "description": "42/42 routes use requireAuth middleware",
          "files": ["src/middleware/auth.ts:12"]
        },
        {
          "type": "runtime-testing",
          "status": "proven",
          "description": "All routes return 401 on missing token",
          "testResults": { "passed": 42, "failed": 0 }
        }
      ]
    },
    {
      "id": "input-validation",
      "name": "Input Validation on User-Submitted Data",
      "status": "partial",
      "confidence": 0.68,
      "evidence": [
        {
          "type": "static-analysis",
          "status": "partial",
          "description": "37/60 endpoints use Zod validation",
          "files": ["src/routes/user.ts:23", "src/routes/payment.ts:12"]
        }
      ],
      "suggestion": "Add Zod validation to remaining 23 endpoints"
    }
  ],
  "residualRisks": [
    {
      "id": "rate-limiting-e5f6a7b8",
      "risk": "No rate limiting verified",
      "impact": "Potential abuse via repeated requests",
      "reasonNotVerified": "No generic static indicator",
      "recommendedMitigation": "Add express-rate-limit middleware",
      "owner": "Engineering",
      "status": "acknowledged",
      "severity": "medium"
    }
  ],
  "trustScore": 87,
  "verdict": "SHIP",
  "signature": "ed25519:a7b3c2d4e5f6..."
}
```

## Benchmark Results

We scanned 10 AI-generated codebases and found 347 issues:

| Tool | Issues Caught | Percentage |
|------|---------------|------------|
| ESLint | 108 | 31% |
| TypeScript | 63 | 18% |
| Semgrep | 87 | 25% |
| **ISL Verify** | **264** | **76%** |

**Issues only ISL Verify detected (69 total):**
- 23 hallucinated package imports
- 18 missing auth on sensitive endpoints
- 12 ghost environment variables
- 7 SQL injection vulnerabilities
- 5 race conditions
- 4 other behavioral bugs

[Full benchmark methodology →](./bench/ai-verify-benchmark/README.md)

## How It Works

### 1. Static Analysis (Tier 1)
- Import integrity (cross-reference with package.json)
- Auth coverage (trace middleware chains)
- Secret exposure (scan for hardcoded credentials)
- SQL injection patterns (detect string interpolation in queries)

### 2. Runtime Testing (Tier 2)
- Spin up dev server
- Call every API endpoint with valid/invalid inputs
- Verify error codes (expect 400 for bad input, not 500)
- Check auth enforcement (expect 401 on missing token)

### 3. Property-Based Testing (Tier 3)
- Generate random inputs based on type constraints
- Run concurrent requests to detect race conditions
- Verify boundary conditions (empty strings, large numbers, null values)

### 4. Proof Bundle Generation
- Build verification surface (scope declaration)
- Collect all evidence with code locations
- Generate residual risk ledger from gaps
- Calculate trust score (weighted by confidence)
- Sign bundle with Ed25519
- Write to `.shipgate/proof-bundle.json`

### 5. Bundle Diffing (Enterprise Feature)
- Compare verification between releases
- Track property coverage changes
- Detect regressions before production
- Generate audit trails

```bash
isl verify diff v1.0.0 v1.1.0
# Auth Coverage: 42/60 routes → 58/62 routes (+16)
# Trust Score: 68% → 87% (+19%)
```

## Configuration

Create `.shipgate.yml` in your project root:

```yaml
verify:
  minScore: 70
  frameworks: [soc2, hipaa]
  
provers:
  auth:
    enabled: true
    excludeRoutes: ['/health', '/metrics']
  
  input-validation:
    enabled: true
    requireZod: true
  
  sql-injection:
    enabled: true
    allowedOrmOnly: false
```

## Pricing

**Free (MIT License):**
- Static analysis (import integrity, auth coverage, secret exposure)
- Basic runtime testing
- Proof bundle generation
- VS Code extension
- Self-hosted verification

**Pro ($29/month):**
- Advanced runtime testing (property-based, concurrent)
- Compliance reports (SOC 2, HIPAA, PCI-DSS)
- Priority support
- Cloud-hosted verification API

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Areas we'd love help with:**
- Python/Go/Rust support
- Custom prover plugins
- Integration with other testing frameworks
- Documentation improvements

## Roadmap

**Q1 2026 (Completed):**
- ✅ TypeScript/JavaScript support
- ✅ VS Code extension
- ✅ SOC 2 compliance mapping
- ✅ GitHub Action

**Q2 2026 (In Progress):**
- 🚧 Python support
- 🚧 Go support
- 🚧 HIPAA/PCI-DSS compliance
- 🚧 Custom prover SDK

**Q3 2026 (Planned):**
- 📋 Rust support
- 📋 Multi-language projects
- 📋 Cloud verification API
- 📋 Slack/Discord integration

## Enterprise Questions

**Q: How is this different from SAST tools?**  
A: We're not competing with Snyk/Sonar/Semgrep. We're competing with manual security sign-off, ad-hoc checklists, and "LGTM" approvals. ISL Verify is a governance tool, not a linter.

**Q: Can I defend decisions made using this tool?**  
A: Yes — because every claim is evidence-backed, signed, scoped, and reproducible. Verification Surface declares what was checked. Residual Risk Ledger documents what wasn't.

**Q: What about false positives?**  
A: We don't optimize for low false positive rate. We optimize for honesty. If we can't prove it → PARTIAL. If we didn't check it → Explicitly disclosed.

**Q: Can you verify everything?**  
A: No. And we're explicit about that. `explicitlyOutOfScope` lists properties we can't verify. This communicates restraint and credibility.

**Q: How do I track verification over time?**  
A: Bundle diffing. Compare releases, detect regressions, show security improvements. No other scanner does this.

**Q: Does it work with [framework]?**  
A: Currently supports Express, Fastify, Next.js API routes. More frameworks coming soon.

**Q: Can I use this in CI?**  
A: Yes! GitHub Action supports policy enforcement: `min-score: 80`, `max-residual-risks-critical: 0`, `fail-on-regression: true`

## License

MIT License - see [LICENSE](LICENSE) for details.

Core verification engine is open source. Runtime provers and compliance reports are paid.

## Links

- **Documentation:** https://shipgate.dev/docs
- **VS Code Extension:** https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl
- **GitHub Action:** https://github.com/marketplace/actions/shipgate-verify
- **Benchmark Repo:** https://github.com/shipgate/shipgate/tree/main/bench/ai-verify-benchmark
- **Discord Community:** https://discord.gg/shipgate

---

## The Enterprise Positioning

**ISL Verify produces cryptographically signed, machine-verifiable evidence of what properties were actually checked in a codebase — and explicitly discloses what was not verified.**

**It is not a security scanner.**  
**It is a verification system for modern, AI-assisted software development.**

For organizations using AI coding assistants:
- Security teams get documented risk acceptance
- Compliance teams get explicit scope declarations  
- Auditors get cryptographically signed audit trails
- Engineering teams get actionable mitigation steps

**Can you defend decisions made using this tool?**  
**Yes — because every claim is evidence-backed, signed, scoped, and reproducible.**

---

**Every AI-generated PR should include a proof bundle.**
```

## Key Sections to Add

### Top of README
- Trust score badge (dogfood our own tool)
- Quick value proposition
- Sample output

### New Sections
1. **What It Proves** table (clear value)
2. **What It Doesn't Prove** (honesty)
3. **Benchmark Results** (credibility)
4. **Proof Bundle Example** (transparency)
5. **How It Works** (technical depth)
6. **Pricing** (clarity)
7. **FAQ** (address objections)

### Remove/Minimize
- Long architecture explanations (move to docs/)
- API reference (move to docs/)
- Internal package structure (not user-facing)

### Tone
- Direct, no fluff
- Evidence-based claims
- Honest about limitations
- Focus on value, not features
