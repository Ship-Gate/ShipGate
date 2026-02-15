# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MockAuthAdapter, MockPaymentAdapter, MockUserAdapter, InMemoryAuthAdapter, InMemoryPaymentAdapter, InMemoryUserAdapter
# dependencies: 

domain MockAdapters {
  version: "1.0.0"

  type MockAuthAdapter = String
  type MockPaymentAdapter = String
  type MockUserAdapter = String
  type InMemoryAuthAdapter = String
  type InMemoryPaymentAdapter = String
  type InMemoryUserAdapter = String

  invariants exports_present {
    - true
  }
}
