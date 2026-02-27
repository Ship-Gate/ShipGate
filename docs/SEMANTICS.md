# ISL Semantic Diagnostics

This document lists all semantic diagnostics produced by ISL's static analysis passes.

## Overview

ISL performs semantic analysis in two phases:

1. **Semantic Analysis Passes** - AST-level checks (type resolution, symbol lookup)
2. **Semantic Rules** - Code-level checks (gate rules for implementations)

---

## Semantic Analysis Passes

Located in `packages/isl-semantic-analysis/`.

### Pass: Symbol Resolver

**ID:** `symbol-resolver`
**Description:** Resolves symbol references to their definitions.

| Code | Severity | Message |
|------|----------|---------|
| `E0500` | error | Semantic pass failed: {reason} |
| `E0501` | error | Undefined symbol: {name} |
| `E0502` | error | Duplicate symbol definition: {name} |
| `W0501` | warning | Unused import: {name} |
| `W0502` | warning | Shadowed definition: {name} |

### Pass: Type Checker (Future)

**ID:** `type-checker`
**Description:** Validates type correctness.

| Code | Severity | Message |
|------|----------|---------|
| `E0600` | error | Type mismatch: expected {expected}, got {actual} |
| `E0601` | error | Unknown type: {name} |
| `E0602` | error | Invalid refinement type |
| `E0603` | error | Circular type reference |
| `W0601` | warning | Type narrowing may fail at runtime |

### Pass: Unreachable Code (Future)

**ID:** `unreachable-code`
**Description:** Detects unreachable clauses.

| Code | Severity | Message |
|------|----------|---------|
| `W0701` | warning | Unreachable precondition clause |
| `W0702` | warning | Unsatisfiable precondition combination |
| `W0703` | warning | Dead postcondition (precondition always false) |

### Pass: Unused Symbols (Future)

**ID:** `unused-symbols`
**Description:** Detects unused definitions.

| Code | Severity | Message |
|------|----------|---------|
| `W0801` | warning | Unused entity: {name} |
| `W0802` | warning | Unused behavior: {name} |
| `W0803` | warning | Unused input field: {name} |
| `W0804` | warning | Unused output field: {name} |
| `H0801` | hint | Entity has no behaviors |

---

## Semantic Rules (Gate Checks)

Located in `packages/isl-pipeline/src/semantic-rules.ts`.

### Rule: intent/audit-required

**Severity:** critical
**Description:** Audit must be called on ALL exit paths with correct semantics (100% coverage).

**Checks:**
1. Every `return` statement has a preceding `audit()` call
2. Audit payload includes required fields: `action`, `success`, `timestamp`
3. Audit payload includes recommended field: `requestId` or `correlationId`
4. Failure paths have `reason` field
5. `success` boolean matches the exit path type (true for 2xx, false for 4xx/5xx)
6. No PII in audit payloads

**Violations:**

| Message | Fix |
|---------|-----|
| Missing audit on {type} exit path | Add `auditAttempt()` before return |
| Audit payload missing required field: {field} | Add the field to audit payload |
| Audit payload missing recommended field: {field} | Add for request tracing |
| Audit for failure path missing "reason" field | Add reason explaining the failure |
| Audit has success:true on {type} path | Change to `success: false` |
| Potential PII ({field}) in audit payload | Remove or redact sensitive data |

**Example Fix:**
```typescript
// BEFORE (violation)
return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

// AFTER (compliant)
await auditAttempt({
  action: 'api_request',
  success: false,
  reason: 'rate_limited',
  timestamp: Date.now(),
  requestId,
});
return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
```

---

### Rule: intent/rate-limit-required

**Severity:** high
**Description:** Rate limit must be checked BEFORE parsing body or hitting DB.

**Checks:**
1. `rateLimit()` call exists before `request.json()` or `req.body`
2. 429 responses have audit with `success: false`

**Violations:**

| Message | Fix |
|---------|-----|
| No rate limiting before body parsing | Add rate limit check first |
| Rate limit check happens AFTER body parsing | Move rate limit before `request.json()` |
| Rate limit 429 response must audit | Add `audit({ success: false, reason: "rate_limited" })` |

**Example Fix:**
```typescript
// BEFORE (violation)
export async function POST(request: Request) {
  const body = await request.json();  // Body parsed first!
  const limited = await rateLimit(request);
}

// AFTER (compliant)
export async function POST(request: Request) {
  const limited = await rateLimit(request);  // Rate limit first!
  if (!limited.success) {
    await auditAttempt({ success: false, reason: 'rate_limited', ... });
    return new Response('Too many requests', { status: 429 });
  }
  const body = await request.json();
}
```

---

### Rule: intent/no-pii-logging

**Severity:** critical
**Description:** No PII in logs - must use safe logger with redaction.

**Sinks Checked:**
- `console.log/error/warn/info/debug/trace/dir/table`
- `logger.*/log.*/winston.*/pino.*/bunyan.*`
- `audit()/auditAttempt()/auditLog()`

**PII Categories:**

| Category | Fields | Severity |
|----------|--------|----------|
| Authentication | password, token, secret, apiKey, privateKey | critical |
| Personal | email, ssn, phone, name, dob, passport | high |
| Financial | creditCard, cvv, bankAccount, routingNumber | critical |
| Network | ipAddress, userAgent, location, address | medium |
| Request | req.body, request.headers, formData | high |

**Safe Wrappers (Allowed):**
- `safeLog()`, `safeLogger.*`
- `redact()`, `redactPii()`
- `maskPii()`, `sanitize()`
- `safeError()`, `scrub()`, `mask()`, `obfuscate()`

**Violations:**

| Message | Fix |
|---------|-----|
| {method} in production code | Use structured logger |
| CRITICAL: Raw request body logged | Use `redact(req.body)` |
| CRITICAL: Request headers logged | Never log raw headers |
| PII ({category}): "{field}" may be logged | Use `redact()` wrapper |
| PII in audit metadata: "{field}" | Use `maskPii()` |

**Example Fix:**
```typescript
// BEFORE (violation)
console.log('Login attempt', { email, password });

// AFTER (compliant)
logger.info('Login attempt', safeError({ email: maskEmail(email) }));
```

---

### Rule: intent/input-validation

**Severity:** high
**Description:** Input must be validated with schema before use.

**Checks:**
1. Schema validation (`safeParse`, `.parse()`, `validate()`) exists
2. Validation happens BEFORE database/business logic
3. Validation result is actually checked

**Violations:**

| Message | Fix |
|---------|-----|
| Input not validated with schema | Add `Schema.safeParse(body)` |
| Validation happens AFTER database call | Move validation first |
| Validation result not checked | Check `validationResult.success` |

**Example Fix:**
```typescript
// BEFORE (violation)
const body = await request.json();
const user = await db.user.findUnique({ where: { email: body.email } });

// AFTER (compliant)
const body = await request.json();
const validation = LoginSchema.safeParse(body);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
const user = await db.user.findUnique({ where: { email: validation.data.email } });
```

---

### Rule: intent/encryption-required

**Severity:** critical
**Description:** Sensitive data must be encrypted before storage.

**Sensitive Fields:**
- password, ssn, creditCard, cardNumber, secret, apiKey, privateKey

**Checks:**
1. Encryption utility used before DB write
2. Passwords use proper hashing (bcrypt/argon2), not encryption
3. Encryption keys not hardcoded

**Violations:**

| Message | Fix |
|---------|-----|
| Sensitive field '{field}' stored without encryption | Encrypt before storage |
| Password must use proper hashing | Use `bcrypt.hash()` or `argon2.hash()` |
| Encryption key appears hardcoded | Use `process.env.ENCRYPTION_KEY` |

---

### Rule: quality/no-stubbed-handlers

**Severity:** critical
**Description:** No stubbed handlers or TODO markers can SHIP.

**Patterns Detected:**
- `throw new Error('Not implemented')`
- `// TODO: implement`
- `// ISL postconditions ... TODO`
- `// placeholder implementation`
- `{ // TODO }`

**Allowlist (Stubs OK):**
- `.test.`, `.spec.` files
- `__mocks__/`, `__fixtures__/`
- `/demo/`, `/examples/`

**Violations:**

| Message | Fix |
|---------|-----|
| SHIP BLOCKED: "Not implemented" error | Implement the handler |
| SHIP BLOCKED: TODO markers in postconditions | Implement postconditions |
| SHIP BLOCKED: {funcName}() is a placeholder | Implement proper logic |
| SHIP BLOCKED: Placeholder implementation | Complete implementation |

---

### Rule: quality/validation-before-use

**Severity:** high
**Description:** Input must be validated before use in business logic.

**Checks:**
1. Body parsing has validation call
2. Validation uses schema (safeParse, parse, validate)

---

## Diagnostic Output Format

```typescript
export interface SemanticViolation {
  ruleId: string;       // e.g., 'intent/audit-required'
  file: string;         // File path
  line: number;         // Line number
  message: string;      // Human-readable message
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;     // Code snippet or context
  fix?: string;         // Suggested fix
}
```

### Example Output

```json
{
  "ruleId": "intent/audit-required",
  "file": "src/app/api/login/route.ts",
  "line": 45,
  "message": "Missing audit on error exit path",
  "severity": "critical",
  "evidence": "return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })",
  "fix": "Add auditAttempt({ action: \"login\", success: false, reason: \"unauthorized\", ... }) before return"
}
```

---

## Running Semantic Analysis

### Via CLI

```bash
# Run all semantic rules (gate)
shipgate gate ./src --policy intent-pack

# Run specific rules
shipgate gate ./src --rules intent/audit-required,intent/rate-limit-required

# Verbose output
shipgate gate ./src -v
```

### Via API

```typescript
import { runSemanticRules } from '@isl-lang/pipeline';

const codeMap = new Map<string, string>();
codeMap.set('src/route.ts', sourceCode);

const violations = runSemanticRules(codeMap, {
  stubAllowlist: ['src/mocks/'],
});

for (const v of violations) {
  console.log(`[${v.severity}] ${v.ruleId}: ${v.message}`);
  console.log(`  ${v.file}:${v.line}`);
  if (v.fix) console.log(`  Fix: ${v.fix}`);
}
```

---

## Adding Custom Rules

### Rule Interface

```typescript
export interface SemanticRule {
  id: string;
  description: string;
  check: (code: string, file: string, config?: SemanticRuleConfig) => SemanticViolation[];
}
```

### Example Custom Rule

```typescript
const myRule: SemanticRule = {
  id: 'custom/no-hardcoded-urls',
  description: 'No hardcoded URLs in production code',
  check(code, file) {
    const violations: SemanticViolation[] = [];
    
    const urlPattern = /https?:\/\/[^\s'"]+/g;
    let match;
    
    while ((match = urlPattern.exec(code)) !== null) {
      if (!match[0].includes('localhost')) {
        violations.push({
          ruleId: 'custom/no-hardcoded-urls',
          file,
          line: findLineNumber(code, match[0]),
          message: 'Hardcoded URL detected',
          severity: 'medium',
          evidence: match[0],
          fix: 'Use environment variable',
        });
      }
    }
    
    return violations;
  },
};

// Register
SEMANTIC_RULES.push(myRule);
```

---

## Severity Levels

| Level | Description | Gate Impact |
|-------|-------------|-------------|
| `critical` | Must fix before ship | Hard blocker (NO_SHIP) |
| `high` | Should fix | Soft blocker (score penalty) |
| `medium` | Should consider | Warning (minor penalty) |
| `low` | Nice to have | Info only |

---

## Related Documentation

- [VERIFICATION.md](./VERIFICATION.md) - Proof bundle system
- [IMPORTS.md](./IMPORTS.md) - Module resolution
- [rules/README.md](./rules/README.md) - Individual rule details
- [rules/audit-required.md](./rules/audit-required.md)
- [rules/rate-limit-required.md](./rules/rate-limit-required.md)
- [rules/no-pii-logging.md](./rules/no-pii-logging.md)
