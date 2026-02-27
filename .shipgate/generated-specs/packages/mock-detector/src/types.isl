# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MockSeverity, MockBehaviorType, MockLocation, MockFinding, MockDetectionResult, MockDetectorConfig, MockPattern, DetectionSummary, MockClaim
# dependencies: 

domain Types {
  version: "1.0.0"

  type MockSeverity = String
  type MockBehaviorType = String
  type MockLocation = String
  type MockFinding = String
  type MockDetectionResult = String
  type MockDetectorConfig = String
  type MockPattern = String
  type DetectionSummary = String
  type MockClaim = String

  invariants exports_present {
    - true
  }
}
