# Rule: intent/no-pii-logging

**Severity:** Critical/High/Medium  
**Category:** Intent Enforcement  
**Fixable:** Yes (deterministic recipe)

## Summary

Production route handlers must not log PII (Personally Identifiable Information):
- **console.*** is forbidden (use structured logger)
- Raw request bodies/headers must not be logged
- PII fields (email, password, SSN, etc.) must be redacted before logging

## Why This Matters

PII in logs creates serious risks:
- **Compliance violations**: GDPR, CCPA, HIPAA, PCI-DSS
- **Data breaches**: Logs are often less secured than databases
- **Privacy violations**: User data exposed to developers, support, attackers
- **Legal liability**: Fines up to 4% of global revenue (GDPR)

`console.log` is particularly dangerous because:
- Logs go to stdout, often captured by logging services
- Developers add them for debugging and forget to remove
- No redaction, no filtering, no access control

## Detection (AST-Based)

The rule analyzes Next.js route handlers to:

1. **Find all console.* calls** - log, info, debug, warn, error, trace, dir, table
2. **Find PII patterns in log arguments** - email, password, token, etc.
3. **Find raw request data logging** - req.body, request.headers
4. **Check for safe wrappers** - safeLogger, redactPII, etc.

### Forbidden Sinks

| Sink | Severity | Reason |
|------|----------|--------|
| `console.log()` | Medium | May contain PII |
| `console.info()` | Medium | May contain PII |
| `console.debug()` | Low | May contain PII |
| `console.warn()` | Medium | May contain PII |
| `console.error()` | High | Often includes user data |
| `console.trace()` | Medium | May include PII in stack |

### PII Fields Detected

| Category | Fields | Severity |
|----------|--------|----------|
| Authentication | password, token, secret, apiKey, credential | Critical |
| Personal | email, ssn, phone, name, dateOfBirth | High |
| Financial | creditCard, cardNumber, cvv, bankAccount | Critical |
| Network | ipAddress, userAgent, location | Medium |
| Request | req.body, request.headers | High |

## Fix Recipe

The deterministic recipe:

1. **Adds safe logger import**:
   ```typescript
   import { safeLogger, redactPII } from '@/lib/logger';
   ```

2. **Removes console.log/info/debug/warn**:
   ```typescript
   // Before:
   console.log('Processing:', body);
   
   // After:
   // [Removed unsafe log statement]
   ```

3. **Replaces console.error with safeLogger**:
   ```typescript
   // Before:
   console.error('Error:', error);
   
   // After:
   safeLogger.error('Error:', { error: redactPII(error) });
   ```

## Examples

### ❌ FAIL: console.log with PII

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // BAD: Logs entire body which may contain passwords, SSNs, etc.
  console.log('Processing request:', body);
  console.log('User email:', body.email);
  
  return NextResponse.json({ ok: true });
}
```

### ❌ FAIL: Raw request body in logs

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // CRITICAL: Raw request body may contain any PII
  logger.info('Request received', { body: req.body });
  
  return NextResponse.json({ ok: true });
}
```

### ✅ PASS: No logging or safe logging

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // Option 1: No logging at all
  
  // Option 2: Safe logging with redaction
  safeLogger.info('Request received', { 
    userId: body.userId,  // Safe to log
    // email: body.email  // Never log PII
  });
  
  return NextResponse.json({ ok: true });
}
```

### ✅ PASS: Error logging with redaction

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Safe: error object is redacted before logging
    safeLogger.error('Request failed', { error: redactPII(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

## Safe Logging Patterns

Use a structured logger with automatic PII redaction:

```typescript
// @/lib/logger.ts
export const safeLogger = {
  info: (msg: string, meta?: unknown) => 
    console.log(JSON.stringify({ level: 'info', msg, meta: redactPII(meta) })),
  error: (msg: string, meta?: unknown) => 
    console.error(JSON.stringify({ level: 'error', msg, meta: redactPII(meta) })),
};

export function redactPII(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const redacted = { ...obj as Record<string, unknown> };
  const piiFields = ['email', 'password', 'token', 'secret', 'ssn', 'phone'];
  for (const field of piiFields) {
    if (field in redacted) redacted[field] = '[REDACTED]';
  }
  return redacted;
}
```

## Configuration

No configuration options. This rule enforces complete PII protection.

## Related Rules

- `intent/audit-required` - Audit payloads must also avoid PII
- `intent/encryption-required` - PII at rest must be encrypted
