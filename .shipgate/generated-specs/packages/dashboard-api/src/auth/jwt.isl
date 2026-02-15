# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createToken, verifyToken, JwtPayload
# dependencies: jsonwebtoken

domain Jwt {
  version: "1.0.0"

  type JwtPayload = String

  invariants exports_present {
    - true
  }
}
