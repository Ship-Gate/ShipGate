# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: expressVerificationMiddleware, ExpressVerificationOptions
# dependencies: express, @isl-lang/runtime-adapters/express, node:crypto

domain Express {
  version: "1.0.0"

  type ExpressVerificationOptions = String

  invariants exports_present {
    - true
  }
}
