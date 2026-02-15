# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: hashPassword, verifyPassword, createLoginHandler, createLoginTestHarness, runLoginTests, runLoginTestsWithTraces, LOGIN_TEST_CASES, TraceEventKind, TraceEvent, TraceMetadata, Trace, UserStatus, User, Session, LoginInput, LoginResult, LoginError, TestCase, TestResult, TestSummary, FixtureStore, LoginHandlerConfig, LoginTestHarnessConfig, LoginTestHarness
# dependencies: crypto

domain LoginHarness {
  version: "1.0.0"

  type TraceEventKind = String
  type TraceEvent = String
  type TraceMetadata = String
  type Trace = String
  type UserStatus = String
  type User = String
  type Session = String
  type LoginInput = String
  type LoginResult = String
  type LoginError = String
  type TestCase = String
  type TestResult = String
  type TestSummary = String
  type FixtureStore = String
  type LoginHandlerConfig = String
  type LoginTestHarnessConfig = String
  type LoginTestHarness = String

  invariants exports_present {
    - true
  }
}
