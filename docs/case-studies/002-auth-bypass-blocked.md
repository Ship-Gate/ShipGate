# Case Study: Auth Bypass Blocked Before Merge

**Date:** 2026-02-10  
**Rule(s):** `auth/bypass-detected`  
**Severity:** critical  
**Verdict:** NO_SHIP (blocked)

## Summary

AI-generated code included `skipAuth: true` on a sensitive admin endpoint. The firewall blocked the change before merge.

## Context

- **Scenario:** Developer asked AI to "add a quick admin endpoint to list users for internal use"
- **File(s):** `packages/dashboard-api/src/routes/admin.ts`
- **Gate:** firewall (Shipgate policy pack: auth)

## What Was Caught

The AI generated:

```ts
router.get('/admin/users', async (req, res) => {
  // TODO: add auth in production
  const users = await db.users.findMany({ skipAuth: true });
  res.json(users);
});
```

The firewall detected the `skipAuth` pattern.

**Why it would have been dangerous:**

- Any unauthenticated request could list all users
- PII (emails, names) would be exposed
- Compliance violation (GDPR, SOC2)

## Fix Applied

- **Manual fix:** Developer replaced with proper auth middleware: `requireAuth(['admin'])` before the handler.
- **Healer:** `auth/bypass-detected` has no healer recipe (security-critical; manual fix required).

## Evidence

- Firewall violation: `[auth/bypass-detected] Auth bypass pattern detected`
- Suggestion: "Remove auth bypass. Use test tokens for testing."

## Conclusion

Shipgate's auth policy pack catches patterns like `skipAuth`, `noAuth`, `bypassAuth` before they reach production. The firewall runs on every AI edit (Cursor rule) and in CI.
