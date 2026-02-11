# Case Study: PII in Logs Blocked Before Merge

**Date:** 2026-02-10  
**Rule(s):** `pii/console-in-production`  
**Severity:** critical  
**Verdict:** NO_SHIP (blocked)

## Summary

AI-generated code used `console.log` to output user email for debugging. The firewall blocked the change before merge.

## Context

- **Scenario:** Developer asked AI to "add error logging for the login handler"
- **File(s):** `packages/auth-api/src/handlers/login.ts`
- **Gate:** firewall (ISL Studio policy pack: pii)

## What Was Caught

The AI generated:

```ts
try {
  const user = await validateLogin(email, password);
  return { token: user.token };
} catch (err) {
  console.log('Login failed for', email);
  throw err;
}
```

The firewall detected `console.log` with a variable that could contain PII (email).

**Why it would have been dangerous:**

- Logs may be aggregated (Datadog, Splunk) and retained
- Email addresses are PII — GDPR, CCPA violations
- Logs can be exposed in plaintext or through support tools

## Fix Applied

- **Manual fix:** Developer replaced with structured logger and redaction: `logger.warn('Login failed', { userId: user?.id })` (no email).
- **Healer:** `pii/console-in-production` has healer recipe — can remove `console.log` or replace with logger.

## Evidence

- Firewall violation: `[pii/console-in-production] console.log in production code`
- Suggestion: "Use a proper logger. Do not log PII (email, phone, etc.)."

## Conclusion

Shipgate's PII policy pack blocks `console.log` and patterns that log sensitive data. The healer can auto-fix some violations; critical ones require manual review.
