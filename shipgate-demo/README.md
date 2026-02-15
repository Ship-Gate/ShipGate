# ShipGate Demo

This is a demo application showcasing ShipGate's verification capabilities.

## The Bug

The implementation in `src/auth.ts` contains a **ghost feature**: it calls an API route
`/api/auth/audit-log` that doesn't actually exist. ShipGate detects this and blocks
the code from shipping.

## Running the Demo

1. **Initial state (NO_SHIP)**:
   ```bash
   shipgate gate specs/auth.isl --impl src/auth.ts
   ```
   
   This will show NO_SHIP due to the ghost route.

2. **Apply the fix**:
   ```bash
   shipgate demo --fix
   ```
   
   This replaces the buggy implementation with the fixed version.

3. **Verify SHIP**:
   ```bash
   shipgate gate specs/auth.isl --impl src/auth.ts
   ```
   
   Now it should show SHIP!

## What ShipGate Detected

- **Ghost Route**: The code calls `/api/auth/audit-log` but this route doesn't exist
- **Missing Implementation**: The route is referenced but never defined

## The Fix

The fixed version removes the ghost route call. In a real application, audit logging
would be handled by middleware or a dedicated service that actually exists.
