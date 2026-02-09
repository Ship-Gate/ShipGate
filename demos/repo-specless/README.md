# checkout-api

> A payment processing API. Built with an AI coding assistant in one afternoon.

The code compiles. The linter passes. The tests are green.
**But it doesn't actually work.**

---

## What happened

We asked an AI to build a checkout API with three features:

1. **Charge a credit card** via Stripe
2. **Issue refunds** against previous charges
3. **Password reset** flow with secure tokens

The AI generated clean, well-typed TypeScript. It has JSDoc comments, input
validation, proper error types, idempotency handling. It looks *professional*.

Here's what CI saw:

```
 tsc --noEmit        ✓ passed
 eslint src/         ✓ 0 errors, 0 warnings
 vitest run          ✓ 12 tests passed

  ✅ All checks passed — ready to merge
```

Ship it, right?

---

## What's actually wrong

### 1. `src/payments/charge.ts` — The Stripe call is commented out

The function validates inputs, generates a charge ID, builds a receipt URL...
and returns `{ success: true }` without ever calling Stripe. Every charge
"succeeds" but no money moves. The `stripe.paymentIntents.create` call is
sitting right there — in a comment block.

A human reviewer would need to read 100+ lines of legitimate-looking payment
code to catch that the 6-line block that actually matters is commented out.

### 2. `src/payments/refund.ts` — The refund is a stub

The function accepts the right parameters, validates them, checks for
over-refunding, records in a ledger — and then just fabricates a success
response. It never calls the payment processor. Your customers think they
got a refund. They didn't.

### 3. `src/auth/reset.ts` — Tokens never expire

The reset token flow looks secure: cryptographically random tokens, SHA-256
hashing, one-time use. But there's no expiry check. A leaked token from 6
months ago still works. The `createdAt` timestamp is stored but never read.

---

## What ShipGate catches (specless mode)

No `.isl` specs needed. ShipGate analyzes the code structure and flags what
doesn't add up:

```bash
$ npx shipgate verify src/
```

```
  File                        Result  Reason                        Score
  ─────────────────────────── ─────── ───────────────────────────── ─────
  src/payments/charge.ts      ⚠ WARN  Fake feature detected          0.31
  src/payments/refund.ts      ✗ FAIL  Stub function detected         0.15
  src/auth/reset.ts           ⚠ WARN  Security: no token expiry      0.52

  ───────────────────────────────────────────────────────────────────────
  Verdict: NO_SHIP
  3 issues found (1 error, 2 warnings)
  Scanned 3 files in 1.2s
```

**`charge.ts`** (score: 0.31) — ShipGate sees a function that imports Stripe
types, validates payment parameters, and generates Stripe-format IDs... but
never makes an outbound API call. The payment processing code exists only in
comments. Flagged as a **fake feature**.

**`refund.ts`** (score: 0.15) — The function signature promises to "submit
refund to payment processor" but the implementation generates a UUID, waits
80ms, and returns a hardcoded success. No external call, no state mutation
beyond a local Map. Flagged as a **stub**.

**`reset.ts`** (score: 0.52) — The token has a `createdAt` field that is
written but never read. There is no expiry check in `resetPassword()`. The
comments say "time-limited reset tokens" but the code enforces no time limit.
Flagged as a **security gap**.

---

## How to fix it

### charge.ts — Actually call Stripe

```typescript
const intent = await stripe.paymentIntents.create({
  amount: Math.round(req.amount * 100),
  currency,
  customer: req.customerId,
  payment_method: req.paymentMethodId,
  confirm: true,
  description: req.description,
  metadata: req.metadata,
});
```

### refund.ts — Call the payment processor

```typescript
const refund = await stripe.refunds.create({
  charge: req.chargeId,
  amount: req.amount ? Math.round(req.amount * 100) : undefined,
  reason: req.reason,
});
```

### reset.ts — Add expiry enforcement

```typescript
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const elapsed = Date.now() - record.createdAt.getTime();
if (elapsed > TOKEN_EXPIRY_MS) {
  resetTokens.delete(tokenHash);
  return { success: false, message: 'Reset token has expired' };
}
```

After fixing, ShipGate passes:

```
  File                        Result  Reason                        Score
  ─────────────────────────── ─────── ───────────────────────────── ─────
  src/payments/charge.ts      ✓ PASS  Stripe integration verified    0.94
  src/payments/refund.ts      ✓ PASS  Processor call verified        0.91
  src/auth/reset.ts           ✓ PASS  Token lifecycle enforced       0.97

  ───────────────────────────────────────────────────────────────────────
  Verdict: SHIP
  0 issues found
  Scanned 3 files in 1.1s
```

---

## The point

Traditional CI checks syntax and tests. But AI-generated code can pass every
syntax check and every test while doing literally nothing.

- **TypeScript** says the types are correct. (They are.)
- **ESLint** says the style is fine. (It is.)
- **Tests** say the functions return the right shape. (They do — hardcoded.)

ShipGate catches the gap between what code *claims* to do and what it
*actually* does. No specs needed. No config beyond telling it where to look.

**Your CI says SHIP. ShipGate says prove it.**

---

## Quick start

```bash
# see the bugs get caught
npx shipgate verify src/

# see detailed analysis
npx shipgate verify src/ --verbose

# output as JSON for CI integration
npx shipgate verify src/ --format json
```

## Learn more

- [ShipGate Documentation](https://github.com/isl-lang/isl)
- [Specless Mode Guide](https://github.com/isl-lang/isl/tree/main/packages/isl-gate)
- [Adding ISL Specs](https://github.com/isl-lang/isl/tree/main/packages/parser) — for when you want even stronger guarantees
