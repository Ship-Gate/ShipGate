# ShipGate — Enabled Gates Reference

Each gate is an independent check. Gates are weighted and combined into the final trust score.
A gate can produce `pass`, `warn`, `fail`, or `skip`.

---

## Gate: `behavioral` (weight: 0.50)

**What it checks:**
Runs behavioral verification against your ISL spec. Tests pre/postconditions, invariants, error branches, and scenario coverage.

**Blocks ship when:**
- Any scenario defined in the spec fails verification
- Trust score falls below `threshold` (default: 95)
- Confidence is below `minConfidence` (default: 20) — not enough evidence to trust the score

**Example finding:**
```
[FAIL] behavioral — CreateUser postcondition violated
  File: src/auth/create-user.ts
  Evidence: User.email !== input.email after successful creation
  Recommendation: Ensure the email field is persisted before returning the result
```

---

## Gate: `auth` (weight: 0.20)

**What it checks:**
- Routes that should require authentication but have no auth guard
- Middleware chain gaps (e.g., JWT validation present but role check missing)
- AI-generated code that exports auth helpers without actually calling them

**Blocks ship when:**
- Any unauthenticated route reaches a resource marked `authenticated` in the spec
- Auth bypass patterns detected (always-true guards, commented-out middleware)

**Example finding:**
```
[FAIL] auth — Route /api/admin/users has no auth middleware
  File: src/routes/admin.ts:42
  Severity: critical
  Recommendation: Apply requireAdmin() middleware before the route handler
```

---

## Gate: `placeholder` (weight: 0.15)

**What it checks:**
- Stub implementations: `return null`, `return []`, `return {}` on non-trivial behaviors
- TODO/FIXME comments in critical path code
- Functions that always return the same hardcoded value regardless of input
- `throw new Error("Not implemented")`
- AI-generated fake data (sequential IDs, lorem ipsum, hardcoded UUIDs)

**Blocks ship when:**
- Any behavior from the spec maps to a placeholder implementation
- Confidence that the implementation is real is below threshold

**Example finding:**
```
[FAIL] placeholder — getUserById returns hardcoded stub
  File: src/users/user-service.ts:88
  Evidence: return { id: "abc123", name: "Test User" }
  Severity: critical
  Recommendation: Implement real database lookup
```

---

## Gate: `env` (weight: 0.15)

**What it checks:**
- Secrets or API keys hardcoded in source files
- `process.env.SOMETHING` used without fallback or validation
- Missing `.env.example` entries for required variables
- Config values that should be environment-specific but are hardcoded

**Blocks ship when:**
- Any secret pattern detected (API keys, tokens, connection strings with credentials)

**Example finding:**
```
[FAIL] env — Hardcoded API key detected
  File: src/integrations/stripe.ts:12
  Evidence: const apiKey = "sk_live_..."
  Severity: critical
  Recommendation: Move to process.env.STRIPE_SECRET_KEY
```

---

## Gate: `drift` (weight: 0.05 — strict/ai-heavy only)

**What it checks:**
- Spec-to-implementation drift: behaviors defined in ISL that no longer have a corresponding implementation file
- Implementation functions that have no spec coverage
- API contract drift between the ISL spec and generated OpenAPI

**Blocks ship when (strict only):**
- More than 20% of spec behaviors have no implementation
- Implementation exports behaviors not declared in the spec

---

## Gate: `chaos` (weight: 0.05 — strict/ai-heavy only)

**What it checks:**
- Resilience of the implementation under fault injection (network errors, database timeouts, malformed inputs)
- Missing error handling on I/O operations
- Cascading failure paths

---

## Gate Weights Summary

| Gate        | Baseline | Strict | AI-Heavy |
|-------------|----------|--------|----------|
| behavioral  | 0.50     | 0.45   | 0.35     |
| auth        | 0.20     | 0.20   | 0.20     |
| placeholder | 0.15     | 0.15   | 0.20     |
| env         | 0.15     | 0.10   | 0.10     |
| drift       | —        | 0.05   | 0.10     |
| chaos       | —        | 0.05   | 0.05     |

Weights sum to 1.0 within each preset.
