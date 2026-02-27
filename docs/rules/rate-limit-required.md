# Rule: intent/rate-limit-required

**Severity:** High/Critical  
**Category:** Intent Enforcement  
**Fixable:** Yes (deterministic recipe)

## Summary

Rate limiting must be checked **BEFORE**:
- Parsing the request body (`request.json()`)
- Any business logic (database queries, external API calls)

This prevents attackers from consuming server resources before being blocked.

## Why This Matters

Rate limiting protects against:
- **DoS attacks**: Overwhelming servers with requests
- **Brute force**: Password guessing, credential stuffing
- **Resource exhaustion**: Large body parsing, expensive computations
- **Cost attacks**: Running up API/database costs

**Order matters**: If you parse the body THEN check rate limits, attackers can:
1. Send large JSON payloads that consume memory
2. Trigger JSON parsing CPU cycles
3. THEN get rate limited (too late - damage done)

## Detection (AST-Based)

The rule analyzes Next.js route handlers to:

1. **Find rate limit check position** - `rateLimit()`, `ensureRateLimit()`, etc.
2. **Find body parse position** - `request.json()`, `req.body`
3. **Find business logic position** - Database calls, fetch(), etc.
4. **Verify order**: Rate limit must come first

### Detected Violations

| Violation | Severity | Example |
|-----------|----------|---------|
| No rate limiting | High | Handler has body parsing but no rate limit |
| Rate limit after body parse | Critical | `request.json()` comes before `rateLimit()` |
| Rate limit after business logic | Critical | Database query before rate limit check |
| 429 response without audit | High | Rate limit rejection not logged |

## Fix Recipe

The deterministic recipe:

1. **Adds rate limit import** if missing:
   ```typescript
   import { rateLimit } from '@/lib/rate-limit';
   ```

2. **Adds rate limit check at handler start**:
   ```typescript
   // @intent rate-limit-required - MUST be before body parsing
   const rateLimitResult = await rateLimit(request);
   if (!rateLimitResult.success) {
     await auditAttempt({ action, success: false, reason: 'rate_limited', requestId });
     return NextResponse.json(
       { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
       { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
     );
   }
   ```

3. **Ensures audit on 429 path** with `success: false`

## Examples

### ❌ FAIL: No rate limiting

```typescript
export async function POST(request: Request) {
  const body = await request.json();  // No rate limit!
  
  const user = await db.users.create({ data: body });
  return NextResponse.json(user);
}
```

### ❌ FAIL: Rate limit in wrong order

```typescript
export async function POST(request: Request) {
  // BAD: Body parsed first!
  const body = await request.json();
  
  // Rate limit too late - body already parsed
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  return NextResponse.json({ ok: true });
}
```

### ✅ PASS: Rate limit before body parsing

```typescript
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const action = 'create_user';

  // @intent rate-limit-required - MUST be before body parsing
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    await auditAttempt({ action, success: false, reason: 'rate_limited', requestId });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  // Now safe to parse body
  const body = await request.json();
  
  const user = await db.users.create({ data: body });
  
  await auditAttempt({ action, success: true, requestId });
  return NextResponse.json(user);
}
```

## Correct Order

```
1. Extract requestId (cheap)
2. Rate limit check (cheap, blocks attackers)
3. Parse body (potentially expensive)
4. Validate input (catches malformed data)
5. Business logic (expensive)
6. Audit + return
```

## Configuration

The rate limit implementation (`@/lib/rate-limit`) should be configured with:
- `limit`: Requests per window (e.g., 100)
- `window`: Time window (e.g., '60s')
- `keyGenerator`: How to identify clients (IP, user ID, API key)

## Related Rules

- `intent/audit-required` - 429 responses must be audited
- `intent/input-validation` - Validation should happen after rate limit
