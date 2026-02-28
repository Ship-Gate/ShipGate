# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: seedUser, clearUsers, resetRateLimits, createRequest, parseResponse, generateLoginTests, LoginTestConfig, GeneratedTest, LoginTestGenerator
# dependencies: vitest, @jest/globals, next/server, ${this.config.routePath}, @isl-lang/test-runtime

domain TestGenerator {
  version: "1.0.0"

  type LoginTestConfig = String
  type GeneratedTest = String
  type LoginTestGenerator = String

  invariants exports_present {
    - true
  }
}
