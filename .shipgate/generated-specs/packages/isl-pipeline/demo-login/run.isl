# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: login, sessionExists, lookupUser, getAuditLog, resetState, __isl_intents, LoginInput, Session, User, LoginResult, LoginError, testUserId
# dependencies: fs/promises, path, crypto, picocolors, vitest

domain Run {
  version: "1.0.0"

  type LoginInput = String
  type Session = String
  type User = String
  type LoginResult = String
  type LoginError = String

  invariants exports_present {
    - true
  }
}
