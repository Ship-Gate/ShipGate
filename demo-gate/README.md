# ISL Gate Demo

**5-minute demo showing the SHIP/NO-SHIP gate in action.**

This demo shows:
1. AI generates code that "looks right" → **NO-SHIP** (shows why)
2. Fixed version → **SHIP** (shows evidence)

## Quick Start

```bash
# Install dependencies
npm install

# Run the gate on the BROKEN implementation
npm run gate:broken
# ❌ NO-SHIP: Postcondition failed - balance can go negative

# Run the gate on the FIXED implementation
npm run gate:fixed
# ✅ SHIP: All 5 verifications passed. Trust score: 100%
```

## The Scenario

**Intent:** Build a money transfer system with:
- Sender balance must not go negative
- Receiver balance must increase by exact amount
- Total money in system stays constant

**AI-Generated Code (Broken):**
```typescript
function transfer(sender, receiver, amount) {
  sender.balance -= amount;      // No validation!
  receiver.balance += amount;
  return { success: true };
}
```

**ISL Gate Result:** ❌ NO-SHIP
- Precondition failed: `sender.balance >= amount`
- Invariant violation: balance can be negative

**Fixed Code:**
```typescript
function transfer(sender, receiver, amount) {
  if (sender.balance < amount) {
    throw new Error('InsufficientFunds');
  }
  sender.balance -= amount;
  receiver.balance += amount;
  return { success: true };
}
```

**ISL Gate Result:** ✅ SHIP
- Trust Score: 100%
- All postconditions verified
- Evidence bundle generated

## Files

```
demo-gate/
├── spec.isl           # The ISL specification
├── broken.ts          # AI-generated code (fails gate)
├── fixed.ts           # Corrected code (passes gate)
├── package.json       # Demo scripts
└── evidence/          # Generated after running gate
    ├── manifest.json  # Fingerprint + hashes
    ├── results.json   # Clause-by-clause results
    └── report.html    # Human-readable report
```

## The Spec

```isl
domain MoneyTransfer version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
  
  invariant balance >= 0
}

behavior Transfer {
  input {
    senderId: UUID
    receiverId: UUID
    amount: Decimal
  }
  
  pre amount > 0
  pre sender.balance >= amount
  
  post success {
    sender.balance == old(sender.balance) - amount
    receiver.balance == old(receiver.balance) + amount
  }
}
```

## Why This Matters

1. **Deterministic** - Same inputs always produce same decision
2. **Auditable** - Evidence bundle proves what was verified
3. **CI-native** - Exit code gates merge/deploy
4. **No false positives** - If it says SHIP, you can trust it

## Next Steps

1. Add this spec to your repo
2. Run `isl gate` in CI
3. Block merges on NO-SHIP
4. Ship with confidence
