# ShipGate Demo

> See ISL Gate in action with three demo scenarios.

## Quick Start

```bash
# Run gate on this demo
isl gate

# Or use npx
npx @isl-lang/cli gate
```

## Demo Scenarios

This demo includes three branches demonstrating different gate outcomes:

### 🛑 `fails-auth` - NO_SHIP (Auth Issues)
- Unprotected admin route
- Missing rate limiting on login
- Auth bypass pattern detected

### 🛑 `fails-pii` - NO_SHIP (PII Issues)
- Sensitive data logged to console
- Unmasked PII in API response
- Missing encryption for stored data

### ✅ `passes` - SHIP (Clean Code)
- Proper authentication middleware
- Rate limiting on all endpoints
- PII properly masked/encrypted
- All policy checks pass

## What This Demo Shows

1. **Instant Feedback**: Gate returns SHIP/NO_SHIP in < 3 seconds
2. **Clear Reasons**: Exactly what failed and why
3. **Evidence Bundle**: Tamper-proof audit trail
4. **Fix Guidance**: How to resolve each issue

## Files

```
isl-demo/
├── src/
│   ├── auth/
│   │   ├── login.ts       # Auth endpoint
│   │   └── middleware.ts  # Auth middleware
│   ├── api/
│   │   ├── users.ts       # User API
│   │   └── admin.ts       # Admin API
│   └── utils/
│       └── logger.ts      # Logging utility
├── .shipgate/
│   └── config.json        # ShipGate config
└── package.json
```

## Try It

```bash
# Check current state
isl gate

# See detailed report
isl gate --output html
open .shipgate/evidence/report.html

# Verify evidence integrity
isl evidence verify
```

## Learn More

- [ShipGate Docs](https://github.com/Ship-Gate/ShipGate)
- [Policy Packs Reference](https://github.com/Ship-Gate/ShipGate/tree/main/packages/isl-policy-packs)
