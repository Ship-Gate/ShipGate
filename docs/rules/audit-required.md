# Rule: intent/audit-required

**Severity:** Critical  
**Category:** Intent Enforcement  
**Fixable:** Yes (deterministic recipe)

## Summary

Audit logging must be called on **ALL exit paths** with correct `success` semantics:
- Success paths must have `success: true`
- Error paths (4xx, 5xx) must have `success: false` with a `reason`

## Why This Matters

Audit logs are critical for:
- **Compliance**: SOC2, HIPAA, PCI-DSS require comprehensive audit trails
- **Security**: Detecting attack patterns, failed login attempts, rate limiting events
- **Debugging**: Understanding what happened in production incidents
- **Business Intelligence**: Tracking conversion rates, error rates, user behavior

A partial audit trail is worse than none - it gives false confidence while missing critical events.

## Detection (AST-Based)

The rule analyzes Next.js route handlers to:

1. **Parse all HTTP method exports** (GET, POST, PUT, PATCH, DELETE)
2. **Extract all exit paths** (return statements returning NextResponse/Response)
3. **Classify each exit path** as success, error, rate_limit, validation, auth, etc.
4. **Check for audit calls** before each return statement
5. **Validate audit payloads** for required fields

### Detected Violations

| Violation | Severity | Example |
|-----------|----------|---------|
| Missing audit on exit path | Critical | Return without audit call |
| Missing required field (action, timestamp) | Critical | `audit({ success: true })` |
| `success: true` on error path | Critical | 400/401/429/500 with success: true |
| Missing `reason` on failure | High | `success: false` without reason |
| Missing `requestId` | Medium | No request correlation ID |

## Fix Recipe

The deterministic recipe:

1. **Adds audit import** if missing:
   ```typescript
   import { audit, auditAttempt } from '@/lib/audit';
   ```

2. **Adds auditAttempt helper** for consistent audit calls:
   ```typescript
   async function auditAttempt(input: {
     action: string;
     success: boolean;
     reason?: string;
     requestId: string;
   }) {
     await audit({
       ...input,
       timestamp: new Date().toISOString(),
     });
   }
   ```

3. **Extracts requestId** at handler start:
   ```typescript
   const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
   const action = 'user_login';
   ```

4. **Adds audit call before each return**:
   - Success: `await auditAttempt({ action, success: true, requestId });`
   - Failure: `await auditAttempt({ action, success: false, reason: 'validation_failed', requestId });`

## Examples

### ❌ FAIL: No audit on error path

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.email) {
    // Missing audit!
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  await audit({ action: 'login', success: true });
  return NextResponse.json(result);
}
```

### ❌ FAIL: Wrong success value on error path

```typescript
export async function POST(request: Request) {
  if (!body.email) {
    // BUG: success should be false!
    await audit({ action: 'login', success: true });
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
}
```

### ✅ PASS: All paths audited with correct semantics

```typescript
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const action = 'user_login';

  const body = await request.json();
  
  if (!body.email) {
    await auditAttempt({ action, success: false, reason: 'validation_failed', requestId });
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  const result = await processLogin(body);
  
  await auditAttempt({ action, success: true, requestId });
  return NextResponse.json(result);
}
```

## Required Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `action` | Yes | Identifies the operation (e.g., "user_login") |
| `success` | Yes | Boolean - true for success, false for failure |
| `timestamp` | Yes | ISO timestamp for ordering and analysis |
| `requestId` | Recommended | Correlates logs across services |
| `reason` | Required on failure | Explains why the operation failed |

## Configuration

No configuration options. This rule enforces complete audit coverage.

## Related Rules

- `intent/rate-limit-required` - Rate limit events should be audited
- `intent/no-pii-logging` - Audit payloads must not contain PII
