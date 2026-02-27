# Rule: quality/no-stubbed-handlers

**Category:** Quality  
**Severity:** Error (Ship Blocker)  
**Tier:** hard_block

## Purpose

Prevents shipping code with stubbed or placeholder implementations. This is a **critical ship blocker** because:

1. Code that throws "Not implemented" will crash in production
2. TODO markers in postconditions indicate unfinished contract fulfillment
3. Placeholder handlers (like `userLogin()` that throws) mean core functionality is broken

## What It Detects

### 1. "Not implemented" Throws

```typescript
// ❌ BLOCKED
throw new Error('Not implemented');
throw new Error('TODO');
throw new Error('STUB');
throw new Error('PLACEHOLDER');
```

### 2. TODO Markers in Postconditions

```typescript
// ❌ BLOCKED - TODOs under postconditions section
// ISL postconditions to satisfy:
// - TODO: Validate user credentials
// - TODO: Create session token
```

### 3. Placeholder Handler Functions

```typescript
// ❌ BLOCKED - Common handlers that throw
export async function userLogin(email: string, password: string) {
  throw new Error('Authentication not implemented');
}

export async function handleCheckout(cart: Cart) {
  throw new Error('Not yet implemented');
}
```

### 4. Placeholder Comments

```typescript
// ❌ BLOCKED
// Implementation goes here
// TODO: implement this
// FIXME: implement
// placeholder implementation
```

## Configurable Allowlist

By default, stubs ARE allowed in certain files/directories:

### Default Allowlist

| Pattern | Purpose |
|---------|---------|
| `**/*.test.ts` | Test files |
| `**/*.spec.ts` | Test files |
| `**/__mocks__/**` | Mock implementations |
| `**/mocks/**` | Mock implementations |
| `**/__fixtures__/**` | Test fixtures |
| `**/fixtures/**` | Test fixtures |
| `**/test-fixtures/**` | Test fixtures |
| `**/*.mock.ts` | Mock files |
| `**/*.types.ts` | Type definition files |
| `**/*.schema.ts` | Schema files |
| `**/*.d.ts` | TypeScript declarations |
| `**/demo/**` | Demo code |
| `**/examples/**` | Example code |

### Custom Allowlist

You can extend the allowlist via configuration:

```typescript
// In your ISL config or truthpack
{
  "stubAllowlist": [
    "**/sandbox/**",
    "**/prototypes/**"
  ]
}
```

Or via semantic rules config:

```typescript
import { runSemanticRules } from '@isl-lang/pipeline';

const violations = runSemanticRules(codeMap, {
  stubAllowlist: ['**/experimental/**']
});
```

## How to Fix

### Replace Stub with Implementation

```typescript
// Before: ❌
export async function userLogin(email: string, password: string) {
  throw new Error('Not implemented');
}

// After: ✅
export async function userLogin(email: string, password: string) {
  const user = await db.users.findByEmail(email);
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    throw new UnauthorizedError('Invalid credentials');
  }
  return createSession(user);
}
```

### Complete Postconditions

```typescript
// Before: ❌
// ISL postconditions to satisfy:
// - TODO: Validate input
// - TODO: Audit action

export function updateUser(id: string, data: unknown) {
  return db.users.update(id, data);
}

// After: ✅
// ISL postconditions to satisfy:
// ✓ Validate input
// ✓ Audit action

export async function updateUser(id: string, data: unknown) {
  const validated = UserSchema.parse(data);
  const result = await db.users.update(id, validated);
  await audit({ action: 'user_update', userId: id, success: true });
  return result;
}
```

### Move Test Stubs to Allowlisted Location

```typescript
// Before: ❌ In src/auth/login.ts (production code)
export function mockLogin() {
  throw new Error('Not implemented - test stub');
}

// After: ✅ In src/__mocks__/auth.ts (allowlisted)
export function mockLogin() {
  return { userId: 'test-123', token: 'mock-token' };
}
```

## Integration with ISL Pipeline

This rule is included in both:

1. **Semantic Rules** (`@isl-lang/pipeline`): For direct code analysis
2. **Policy Packs** (`@isl-lang/policy-packs`): As part of the "quality" pack

### Using with Semantic Rules

```typescript
import { runSemanticRules } from '@isl-lang/pipeline';

const codeMap = new Map([
  ['src/api/users.ts', userCode],
]);

const violations = runSemanticRules(codeMap);
// violations includes quality/no-stubbed-handlers checks
```

### Using with Policy Packs

```typescript
import { qualityPolicyPack } from '@isl-lang/policy-packs';

const rule = qualityPolicyPack.rules.find(
  r => r.id === 'quality/no-stubbed-handlers'
);

const violation = rule.evaluate({
  filePath: 'src/api/users.ts',
  content: code,
  claims: [],
  evidence: [],
  truthpack: {},
});
```

## Related Rules

- `quality/no-todo-comments` - Detects TODO/FIXME comments
- `quality/no-debug-code` - Detects debugger statements and debug flags

## Why This Matters

| Risk | Impact |
|------|--------|
| Production crashes | Users hit "Not implemented" errors |
| Incomplete features | ISL postconditions not fulfilled |
| Security gaps | Auth/payment handlers not working |
| Failed compliance | Cannot prove implementation meets spec |

This rule ensures that when you ship, your code actually does what it claims to do.
