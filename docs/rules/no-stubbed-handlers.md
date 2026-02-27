# Rule: quality/no-stubbed-handlers

**Severity:** Critical  
**Category:** Quality  
**Fixable:** Yes (deterministic recipe)

## Summary

Route handlers must not contain stub/placeholder code that prevents shipping:
- `throw new Error('Not implemented')` blocks deployment
- TODO markers in postconditions indicate incomplete work
- Empty handlers that only throw are not shippable

## Why This Matters

Stubbed handlers cause:
- **False confidence**: Tests may pass, CI may be green, but the feature doesn't work
- **Production incidents**: Endpoints return 500 errors in production
- **Security risks**: Attackers find unimplemented endpoints via error messages
- **Technical debt**: "Temporary" stubs become permanent

The rule enforces: **If it can't work, it can't ship.**

## Detection (AST-Based)

The rule analyzes source files to:

1. **Find "Not implemented" throws**:
   - `throw new Error('Not implemented')`
   - `throw new Error('TODO')`
   - `throw new Error('STUB')`
   - `throw new Error('PLACEHOLDER')`

2. **Find TODO markers in postconditions**:
   - `// ISL postconditions to satisfy: ... TODO`
   - `// @postcondition ... TODO`

3. **Find empty handlers**:
   - Handlers with only a throw statement
   - Handlers with no real business logic

4. **Find placeholder comments**:
   - `// TODO: implement`
   - `// Implementation goes here`
   - `// placeholder`

### Detected Violations

| Violation | Severity | Example |
|-----------|----------|---------|
| "Not implemented" error | Critical | `throw new Error('Not implemented')` |
| TODO in postconditions | Critical | `// @postcondition ... TODO` |
| Handler only throws | Critical | No real implementation |
| Placeholder comment | High | `// TODO: implement` |

## Fix Recipe

The deterministic recipe:

1. **Replaces stub throws with implementation skeleton**:
   ```typescript
   // Before:
   throw new Error('Not implemented');
   
   // After:
   // [IMPLEMENTATION REQUIRED] create_user
   // TODO: Implement the following:
   // 1. Validate input data
   // 2. Execute business logic
   // 3. Return appropriate response
   
   return NextResponse.json(
     { error: 'Implementation pending', action: 'create_user' },
     { status: 501 }
   );
   ```

This makes it clear the endpoint is incomplete while providing a proper HTTP response instead of crashing.

## Examples

### ❌ FAIL: Stubbed handler

```typescript
export async function POST(request: Request) {
  throw new Error('Not implemented');
}
```

### ❌ FAIL: TODO in postconditions

```typescript
// ISL postconditions to satisfy:
// - TODO: user must be authenticated
// - TODO: audit must be logged

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ ok: true });
}
```

### ❌ FAIL: Placeholder comment

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // TODO: implement the actual logic
  
  return NextResponse.json({ ok: true });
}
```

### ✅ PASS: Properly implemented handler

```typescript
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const action = 'create_user';

  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    await auditAttempt({ action, success: false, reason: 'rate_limited', requestId });
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await request.json();
  const validationResult = CreateUserSchema.safeParse(body);
  if (!validationResult.success) {
    await auditAttempt({ action, success: false, reason: 'validation_failed', requestId });
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const user = await db.users.create({ data: validationResult.data });
  
  await auditAttempt({ action, success: true, requestId });
  return NextResponse.json(user);
}
```

## Allowlist

The rule skips certain files where stubs are acceptable:

- Test files: `.test.ts`, `.spec.ts`
- Type files: `.types.ts`, `.d.ts`
- Schema files: `.schema.ts`
- Mock directories: `__mocks__/`, `__fixtures__/`, `/mocks/`
- Demo/example code: `/demo/`, `/examples/`

You can extend the allowlist via configuration:

```typescript
const config: SemanticRuleConfig = {
  stubAllowlist: ['/prototypes/', '/scratch/'],
};
```

## Why 501 Not 500?

The fix recipe returns 501 (Not Implemented) instead of 500 (Internal Server Error):

- **501** clearly indicates "this feature isn't built yet"
- **500** suggests something is broken, triggering alerts
- **501** is appropriate for planned but unimplemented functionality
- Clients can handle 501 specifically (e.g., show "Coming Soon")

## Related Rules

- `intent/audit-required` - Even 501 responses should be audited
- `quality/validation-before-use` - Input should be validated even in stubs
