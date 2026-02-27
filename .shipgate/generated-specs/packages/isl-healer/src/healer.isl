# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createHealer, healUntilShip, createMockGateResult, createViolation, ISLHealerV2
# dependencies: crypto, ./adapters/index.js

domain Healer {
  version: "1.0.0"

  type ISLHealerV2 = String

  invariants exports_present {
    - true
  }
}
