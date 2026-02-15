# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createMockServer, createMockExecutor, MockServerOptions, MockEndpoint, MockResponse, MockRequest, MockServer
# dependencies: 

domain MockServer {
  version: "1.0.0"

  type MockServerOptions = String
  type MockEndpoint = String
  type MockResponse = String
  type MockRequest = String
  type MockServer = String

  invariants exports_present {
    - true
  }
}
