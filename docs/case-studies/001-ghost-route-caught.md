# Case Study: Ghost Route Caught Before Merge

**Date:** 2026-02-10  
**Rule(s):** `ghost-route`  
**Severity:** high  
**Verdict:** NO_SHIP (blocked)

## Summary

AI-generated code referenced an API endpoint `/api/v2/users` that did not exist in the project's truthpack. The firewall blocked the change before merge.

## Context

- **Scenario:** Developer asked AI to "add a user profile page that fetches from the users API"
- **File(s):** `packages/dashboard-web/src/app/profile/page.tsx`
- **Gate:** firewall (truthpack validation)

## What Was Caught

The AI generated:

```tsx
const res = await fetch('/api/v2/users/me');
```

The truthpack (`.guardrail/truthpack/routes.json` or `.shipgate/truthpack`/`.vibecheck/truthpack`) only listed routes such as `/api/users`, `/api/auth/login`. The route `/api/v2/users` was not declared.

**Why it would have been dangerous:**

- The fetch would 404 in production
- Users would see a broken profile page
- No compile-time or runtime error during development if the dev server mocked unknown routes

## Fix Applied

- **Manual fix:** Developer updated the route to `/api/users/me` (which exists in truthpack) or added the new route to the API and truthpack.
- **Healer:** N/A — ghost-route violations require manual truthpack update or route addition.

## Evidence

- Firewall violation: `[ghost-route] Ghost route detected: /api/v2/users/me is not defined in the truthpack`
- Suggestion: "Add this route to your routes configuration or fix the endpoint path"

## Conclusion

Shipgate's ghost-route policy blocks AI from inventing endpoints that don't exist. The firewall runs on every edit (Cursor rule) and in CI, so this would have been caught before merge regardless of when the developer ran checks.
