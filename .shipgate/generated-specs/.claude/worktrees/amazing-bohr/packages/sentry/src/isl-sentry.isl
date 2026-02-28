# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLSentry, PreconditionError, PostconditionError, InvariantError
# dependencies: @sentry/node

domain IslSentry {
  version: "1.0.0"

  type ISLSentry = String

  invariants exports_present {
    - true
  }
}
