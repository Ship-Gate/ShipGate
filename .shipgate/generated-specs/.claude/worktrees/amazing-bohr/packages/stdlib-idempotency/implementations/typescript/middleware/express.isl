# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createIdempotencyMiddleware, skipIdempotency, Request, Response, NextFunction, ExpressMiddleware, ExpressIdempotencyOptions
# dependencies: express, @isl-lang/stdlib-idempotency/middleware/express, @isl-lang/stdlib-idempotency/store/memory

domain Express {
  version: "1.0.0"

  type Request = String
  type Response = String
  type NextFunction = String
  type ExpressMiddleware = String
  type ExpressIdempotencyOptions = String

  invariants exports_present {
    - true
  }
}
