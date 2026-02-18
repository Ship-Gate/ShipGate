# Twitter/X Launch Thread

## Thread (12 tweets)

**Tweet 1:**
We scanned 10 AI-generated codebases. The results were worse than we expected. 🧵

347 issues found.
ESLint: 31%
TypeScript: 18%
ISL Verify: 76%

Here's what every tool missed →

---

**Tweet 2:**
Most shocking finding: a payment endpoint with NO authentication.

```typescript
app.post('/api/payment/charge', async (req, res) => {
  const charge = await stripe.charges.create({
    amount: req.body.amount * 100,
    source: req.body.cardToken,
  });
  res.json({ success: true });
});
```

ESLint: ✅
TypeScript: ✅
Runtime: 💥

---

**Tweet 3:**
Category 1: Hallucinations (23 unique issues)

AI invented packages that don't exist:
```typescript
import { validateEmail } from '@stripe/validators';
// ❌ This package doesn't exist
```

Compiles fine. Crashes at runtime.

Only behavioral analysis caught it.

---

**Tweet 4:**
Category 2: Ghost environment variables (12 occurrences)

AI referenced env vars it never defined:
```typescript
const redisUrl = process.env.REDIS_URL;
// ❌ Not in .env.example
```

Deploys to prod. Crashes immediately.

TypeScript can't catch this.

---

**Tweet 5:**
Category 3: Missing auth (18 occurrences)

30% of sensitive endpoints had zero authentication:
- Payment endpoints
- Admin routes  
- File uploads
- User deletion

All passed linting. All would have shipped to production.

---

**Tweet 6:**
ESLint caught 31%. TypeScript caught 18%. Together they still missed 69 issues that only behavioral analysis detected.

Linters check syntax.
Type checkers check types.
Behavioral verification checks behavior.

Different problem. Different solution.

---

**Tweet 7:**
So we built ISL Verify. It produces proof bundles — cryptographically signed evidence of what was checked.

Not "the AI says it's fine."
Not "ESLint passed."

But verifiable evidence:
✅ What was checked
⚠️ What was partially verified
❌ What wasn't checked

---

**Tweet 8:**
Example output:

```
✅ Import integrity: 47/47 verified
⚠️ Auth coverage: 42/60 routes (18 missing)
❌ Input validation: 23 endpoints unvalidated
✅ SQL injection: 0 vulnerabilities

Trust Score: 68/100
Verdict: NO_SHIP
```

Proof bundle → .shipgate/proof-bundle.json

---

**Tweet 9:**
Try it on your project right now:

```bash
npx isl-verify .
```

Works on any TypeScript project. No config needed.

See what linters are missing in your AI-generated code.

---

**Tweet 10:**
Every other AI tool says "trust us."

We say "here's the evidence, here's what we didn't check."

If we can't prove it, we don't claim it.
If we didn't check it, we disclose it.

The honest alternative to rubber-stamping.

---

**Tweet 11:**
GitHub Action (4 lines):

```yaml
- uses: shipgate/action@v1
  with:
    verdict: ship
    min-score: 70
```

Block PRs that don't meet your quality bar.

Every AI-generated PR should include a proof bundle.

---

**Tweet 12:**
Open source core (MIT). Runtime provers + compliance reports are paid.

📦 GitHub: github.com/shipgate/shipgate
📖 Docs: shipgate.dev/docs
🔌 VS Code: marketplace (search "shipgate")
🎯 Benchmark: github.com/shipgate/shipgate/tree/main/bench

What behavioral bugs have you found that linters missed?

---

## Alternative Tweet Formats

### Short Version (5 tweets):

**T1:** We scanned 10 AI codebases. Found 347 issues. ESLint caught 31%. TypeScript caught 18%. ISL Verify caught 76%. Here's what linters miss in AI-generated code 🧵

**T2:** Payment endpoint with no auth. SQL queries with injection risks. Env vars that don't exist. Endpoints that trust all user input. All passed ESLint + TypeScript. All would ship to production.

**T3:** Why? Linters check syntax. Type checkers check types. But behavioral bugs (missing auth, unvalidated inputs, race conditions) are invisible to syntax-level tools. You need behavioral verification.

**T4:** ISL Verify produces proof bundles — signed evidence of what was checked. Not "trust the AI." But verifiable evidence: what passed, what failed, what wasn't checked. Try it: `npx isl-verify .`

**T5:** Open source (MIT). Works on any TypeScript project. GitHub Action for CI. VS Code extension with inline evidence. github.com/shipgate/shipgate

### Technical Deep-Dive Version (15 tweets):

**T1:** Thread: How we found 69 behavioral bugs in AI code that ESLint + TypeScript missed. Technical breakdown of our verification pipeline. 🧵

**T2:** Standard toolchain:
- ESLint: 108/347 issues (31%)
- TypeScript: 63/347 issues (18%)  
- Semgrep: 87/347 issues (25%)

Combined coverage: 192/347 (55%)

ISL Verify: 264/347 (76%)

What's the extra 21%?

**T3:** Category 1: Import integrity (23 issues)

AI hallucinates packages:
```ts
import { x } from '@stripe/validators'; // DNE
```

tsc error? No. Declaration files make imports unverifiable without runtime checks.

Our solution: Cross-reference package.json + node_modules at verify-time.

**T4:** Category 2: Environment variable validation (12 issues)

AI references vars not in .env.example:
```ts
const url = process.env.REDIS_URL;
```

TypeScript sees: string | undefined
But can't verify: is this var actually defined?

Our solution: Static analysis of all process.env.* references vs .env.example

**T5:** Category 3: Auth coverage (18 issues)

30% of sensitive routes missing auth middleware.

ESLint can't detect (requires semantic understanding of route → middleware chain).

Our solution: Build control-flow graph, trace middleware application, verify auth on protected resources.

**T6:** Category 4: Input validation (23 issues)

Unvalidated req.body.* access:
```ts
const user = await db.create(req.body);
```

No Zod. No Joi. No manual validation.

Our solution: Runtime testing with invalid inputs. Expect 400, not 500.

**T7:** Category 5: SQL injection (7 issues)

```ts
db.query(`SELECT * FROM users WHERE email = '${email}'`)
```

Semgrep catches some (with rules). But misses template literals in helper functions.

Our solution: Taint analysis + runtime fuzzing with SQL metacharacters.

**T8:** Category 6: Race conditions (5 issues)

```ts
const post = await getPost(id);
post.likes += 1;
await updatePost(post);
```

Read-modify-write race under concurrency.

Our solution: Property-based testing with concurrent requests. Assert increment correctness.

**T9:** The verification pipeline:

1. Static analysis (import integrity, auth coverage)
2. Runtime testing (API contracts, error handling)
3. Property-based testing (concurrency, boundary conditions)
4. Proof bundle generation (signed evidence)

Each stage adds coverage.

**T10:** Proof bundle structure:

```json
{
  "properties": [{
    "id": "auth-coverage",
    "status": "partial",
    "confidence": 0.7,
    "evidence": [{
      "type": "static-analysis",
      "files": ["src/routes/payment.ts:12"]
    }]
  }]
}
```

Every claim backed by evidence.

**T11:** Honesty-first design:

- If we didn't check it → NOT VERIFIED
- If we checked it but can't prove it → PARTIAL
- If we have high-confidence evidence → PROVEN

No rubber-stamping. No "trust us." Just evidence.

**T12:** Compliance mapping:

SOC 2 CC6.1 (access controls) → auth coverage evidence
HIPAA 164.308 (security mgmt) → vulnerability scan evidence
PCI-DSS 6.5.1 (injection flaws) → SQL injection prover evidence

Auditable trail.

**T13:** VS Code integration:

- Inline evidence decorations (gutter icons)
- CodeLens on route handlers (Auth: ✅ | Validation: ⚠️)
- Proof bundle panel (trust score + property list)
- File decorations (badges in explorer)

See verification status as you code.

**T14:** Performance:

10k LOC codebase:
- Static analysis: ~3s
- Runtime testing: ~15s (spins up dev server)
- Property-based testing: ~10s
- Total: ~30s

Parallelized. Cacheable. Incremental.

**T15:** Try it:
```bash
npx isl-verify .
```

Open source (MIT): github.com/shipgate/shipgate
Docs: shipgate.dev/docs
VS Code: search "shipgate"

What behavioral verification would you want to see? Reply with ideas 👇
