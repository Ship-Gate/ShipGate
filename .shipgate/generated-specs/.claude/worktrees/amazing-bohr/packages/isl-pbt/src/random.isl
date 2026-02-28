# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPRNG, integer, float, boolean, string, email, password, uuid, timestamp, ipAddress, array, oneOf, constant, fromEnum, optional, record, set, map, money, moneyAmount, duration, durationMs, fromConstraints, BaseGenerator
# dependencies: 

domain Random {
  version: "1.0.0"

  type BaseGenerator = String

  invariants exports_present {
    - true
  }
}
