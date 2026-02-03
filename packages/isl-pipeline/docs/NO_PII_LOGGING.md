# intent/no-pii-logging

**Semantic Rule for PII-Safe Logging**

## Overview

The `intent/no-pii-logging` rule enforces secure logging practices by:

1. **Forbidding `console.*`** in production code
2. **Detecting PII identifiers** being logged
3. **Blocking raw request body/headers** from being logged
4. **Allowing safe wrappers** like `safeLog()`, `redact()`, `maskPii()`

This is a **semantic rule**, not just string matching. It understands code context and allows legitimate use cases while blocking dangerous patterns.

## Quick Start

```typescript
// ❌ VIOLATION: console.* in production
console.log('User logged in');

// ❌ VIOLATION: PII in logs
logger.info('Login', { email: user.email });

// ❌ VIOLATION: Raw request body
console.log('Request:', req.body);

// ✅ SAFE: Using structured logger with redaction
import { safeLog, redact } from '@isl-lang/pipeline/safe-logging';

safeLog('User logged in', { userId: user.id });
logger.info('Login', redact({ email: user.email }));
```

## Sinks (Where Logging Happens)

The rule monitors these logging sinks:

### Console Methods (FORBIDDEN)

All `console.*` methods are forbidden in production code:

| Method | Severity | Fix |
|--------|----------|-----|
| `console.log()` | medium | `logger.info(safeError(data))` |
| `console.error()` | high | `logger.error(safeError(err))` |
| `console.warn()` | medium | `logger.warn(safeError(data))` |
| `console.info()` | medium | `logger.info(safeError(data))` |
| `console.debug()` | low | `logger.debug(safeError(data))` |
| `console.trace()` | medium | Remove or use logger |
| `console.dir()` | medium | `logger.debug(redact(obj))` |
| `console.table()` | medium | `logger.debug(redact(data))` |

### Logger Methods (Allowed, but PII Must Be Redacted)

These are allowed but monitored for PII:

- `logger.*()`
- `log.*()`
- `winston.*()`
- `pino.*()`
- `bunyan.*()`

### Audit Methods (PII Must Be Masked)

Audit calls are monitored for raw PII:

- `audit({})`
- `auditAttempt({})`
- `auditLog()`

## PII Identifiers

### Authentication (CRITICAL Severity)

| Pattern | Examples |
|---------|----------|
| password | `password`, `passwd`, `pwd` |
| token | `token`, `accessToken`, `refreshToken`, `idToken` |
| secret | `secret`, `apiSecret`, `clientSecret` |
| credential | `credential`, `credentials` |
| apiKey | `apiKey`, `api_key` |
| privateKey | `privateKey`, `private_key` |
| authorization | `authorization`, `auth` |
| sessionId | `sessionId`, `session_id` |

### Personal Information (HIGH Severity)

| Pattern | Examples |
|---------|----------|
| email | `email`, `e-mail`, `emailAddress` |
| ssn | `ssn`, `socialSecurity`, `social_security` |
| phone | `phone`, `phoneNumber`, `mobile`, `cellphone` |
| name | `name`, `firstName`, `lastName`, `fullName` |
| dob | `dateOfBirth`, `dob`, `birthDate` |
| id | `nationalId`, `taxId`, `passport`, `driverLicense` |

### Financial (CRITICAL Severity)

| Pattern | Examples |
|---------|----------|
| card | `creditCard`, `cardNumber`, `card_number` |
| cvv | `cvv`, `cvc`, `securityCode` |
| account | `bankAccount`, `accountNumber`, `routingNumber` |
| transfer | `iban`, `swift`, `bic` |

### Network/Location (MEDIUM Severity)

| Pattern | Examples |
|---------|----------|
| ip | `ipAddress`, `ip_address`, `clientIp`, `remoteAddr` |
| userAgent | `userAgent`, `user_agent` |
| location | `gps`, `latitude`, `longitude`, `location`, `address` |

### Request Data (HIGH Severity)

| Pattern | Examples |
|---------|----------|
| body | `req.body`, `request.body`, `requestBody` |
| headers | `req.headers`, `request.headers`, `headers[*]` |
| query | `req.query`, `request.query` |
| params | `req.params`, `request.params` |
| form | `formData`, `rawBody` |

## Safe Wrappers

These wrappers are recognized and exempt from violations:

```typescript
// All of these suppress PII violations:
safeLog('message', data);           // Auto-redacts
safeLogger.info('message', data);   // Auto-redacts
redact(data);                       // Manual redaction
redactPii(event);                   // PII-specific redaction
maskPii(actor);                     // Masks instead of removes
sanitize(data);                     // Generic sanitization
sanitizeLogs(data);                 // Log-specific sanitization
safeError(err);                     // Error wrapper
scrub(data);                        // Alias for redact
mask(value);                        // Partial masking
obfuscate(data);                    // Alias for redact
```

## Auto-Fix Recipe

### Replace console.* with Safe Logger

```typescript
// Before
console.log('Processing request', data);
console.error('Failed:', error);

// After
import { createSafeLogger, safeError } from '@isl-lang/pipeline/safe-logging';

const logger = createSafeLogger({ service: 'my-service' });

logger.info('Processing request', { ...redact(data) });
logger.error('Failed:', safeError(error));
```

### Redact PII in Logs

```typescript
// Before
logger.info('User action', { 
  email: user.email,
  token: session.token,
});

// After
import { redact } from '@isl-lang/pipeline/safe-logging';

logger.info('User action', redact({ 
  email: user.email,  // -> '[REDACTED]'
  token: session.token, // -> '[REDACTED]'
}));
```

### Handle Request Body Safely

```typescript
// Before (CRITICAL VIOLATION)
console.log('Request body:', req.body);
logger.debug('Payload:', request.body);

// After - Option 1: Log only safe fields
logger.info('Request received', { 
  path: req.path,
  method: req.method,
  contentType: req.headers['content-type'],
});

// After - Option 2: Redact the body
logger.debug('Payload:', redact(req.body));

// After - Option 3: Log specific safe fields only
const { action, timestamp } = req.body;
logger.info('Action', { action, timestamp });
```

### Handle Errors Safely

```typescript
// Before
console.error('Error:', error);
console.error('Error for user:', error.message, user.email);

// After
import { safeError } from '@isl-lang/pipeline/safe-logging';

logger.error('Operation failed', safeError(error));
logger.error('User operation failed', safeError(error), { 
  userId: user.id,  // ID is safe
  // email removed - not needed for debugging
});
```

### Handle Audit Metadata

```typescript
// Before
await audit({
  action: 'user.login',
  success: true,
  email: user.email,  // VIOLATION: raw PII
});

// After
import { maskEmail } from '@isl-lang/pipeline/safe-logging';

await audit({
  action: 'user.login',
  success: true,
  userId: user.id,  // Use ID instead
  email: maskEmail(user.email),  // j***n@e*****e.com
});
```

## Examples

### Valid Code (No Violations)

```typescript
import { createSafeLogger, redact, safeError } from '@isl-lang/pipeline/safe-logging';

const logger = createSafeLogger({ service: 'auth-service' });

export async function POST(req: Request) {
  const body = await req.json();
  const validated = schema.parse(body);
  
  // ✅ Safe: Using safeLog
  safeLog('Login attempt', { userId: validated.userId });
  
  try {
    const result = await authenticate(validated);
    
    // ✅ Safe: No PII, using structured logger
    logger.info('Authentication successful', { 
      userId: result.userId,
      method: 'password',
    });
    
    // ✅ Safe: Audit with masked PII
    await audit({
      action: 'auth.login',
      success: true,
      userId: result.userId,
      email: maskEmail(validated.email),
    });
    
    return Response.json({ success: true });
  } catch (err) {
    // ✅ Safe: Using safeError wrapper
    logger.error('Authentication failed', safeError(err));
    
    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
```

### Invalid Code (Violations)

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  
  // ❌ VIOLATION: console.log in production
  console.log('Request received');
  
  // ❌ VIOLATION: Raw request body logged
  console.log('Body:', body);
  
  // ❌ VIOLATION: PII (email) in logs
  logger.info('Login for:', body.email);
  
  // ❌ VIOLATION: Headers logged (may contain Authorization)
  console.log('Headers:', req.headers);
  
  // ❌ VIOLATION: Token in logs
  logger.debug('Session token:', session.token);
  
  try {
    // ... logic
  } catch (err) {
    // ❌ VIOLATION: console.error + raw error
    console.error('Error:', err);
    
    // ❌ VIOLATION: PII in error context
    console.error('Failed for user:', body.email, err);
  }
  
  // ❌ VIOLATION: Raw PII in audit
  await audit({
    action: 'login',
    email: body.email,  // Should be masked
    password: body.password,  // NEVER log passwords
  });
}
```

## Severity Levels

| Severity | Patterns | Action |
|----------|----------|--------|
| **CRITICAL** | password, token, secret, apiKey, creditCard, cvv, request body | Block deployment |
| **HIGH** | email, ssn, phone, request headers | Block deployment |
| **MEDIUM** | console.log, ipAddress, userAgent, location | Warning, consider blocking |
| **LOW** | console.debug | Warning |

## Skipped Files

The rule automatically skips:

- Test files: `*.test.ts`, `*.spec.ts`
- Type definitions: `*.types.ts`, `*.d.ts`
- Schemas: `*.schema.ts`

## Integration with ISL Pipeline

```typescript
import { runSemanticRules } from '@isl-lang/pipeline';

const codeMap = new Map([
  ['api/login/route.ts', loginRouteCode],
  ['api/users/route.ts', usersRouteCode],
]);

const violations = runSemanticRules(codeMap);

const piiViolations = violations.filter(v => v.ruleId === 'intent/no-pii-logging');

if (piiViolations.some(v => v.severity === 'critical')) {
  throw new Error('CRITICAL: PII may be exposed in logs');
}
```

## Related Rules

- `SEC-PII-001` (security-policies): No PII in logs (policy pack)
- `pii/logged-sensitive-data` (policy-packs): PII logging detection
- `pii/console-in-production` (policy-packs): Console.log detection

## References

- OWASP Logging Cheat Sheet
- GDPR Article 5 (Data Minimization)
- PCI DSS Requirement 3.4 (Render PAN unreadable)
- HIPAA § 164.312 (Technical Safeguards)
