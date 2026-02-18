# ShipGate Demo — User Service

A minimal TypeScript user service with an ISL behavioral spec.  
Use this to verify your ShipGate install and see what a SHIP verdict looks like.

## Run the gate

```bash
# From the toolkit root:
shipgate gate examples/demo-repo/specs/user-service.isl \
  --impl examples/demo-repo/src \
  --threshold 90

# Expected: SHIP, score 97%, confidence 88%, 9 tests passed
```

## Files

- `specs/user-service.isl` — ISL spec defining RegisterUser and GetUser behaviors with 3 scenarios
- `src/user-service.ts` — TypeScript implementation that satisfies the spec

## Break it intentionally (to see a NO-SHIP)

```typescript
// In src/user-service.ts, change registerUser to return a stub:
export async function registerUser(input) {
  return { success: true, user: null };  // placeholder — will trigger FAIL
}
```

Re-run the gate and you'll see:
```
  ✗  NO-SHIP
  Blocking Issues:
  • RegisterUser postcondition violated
    User.exists(result.id) — result.user is null
```
