# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAuthAdapter, UserFixture, SessionFixture, ApiKeyFixture, AuthFixtures, AuthAdapterOptions, AuthDomainAdapter
# dependencies: 

domain AuthAdapter {
  version: "1.0.0"

  type UserFixture = String
  type SessionFixture = String
  type ApiKeyFixture = String
  type AuthFixtures = String
  type AuthAdapterOptions = String
  type AuthDomainAdapter = String

  invariants exports_present {
    - true
  }
}
