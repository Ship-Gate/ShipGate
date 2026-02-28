# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createMockProvider, MockProviderOptions, MockProvider
# dependencies: express

domain MockProvider {
  version: "1.0.0"

  type MockProviderOptions = String
  type MockProvider = String

  invariants exports_present {
    - true
  }
}
