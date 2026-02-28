# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_OPTIONS, DEFAULT_MIDDLEWARE_OPTIONS, Verdict, CheckType, CoverageCategory, ISLSentryOptions, ISLContext, VerifyResult, CoverageInfo, FailedCheck, PassedCheck, ISLEvent, BehaviorTrackingOptions, ISLBreadcrumbData, ISLSpanData, MiddlewareOptions, ISLCaptureOptions, SanitizeOptions, ISLRequest, ISLResponse, NextFunction
# dependencies: 

domain Types {
  version: "1.0.0"

  type Verdict = String
  type CheckType = String
  type CoverageCategory = String
  type ISLSentryOptions = String
  type ISLContext = String
  type VerifyResult = String
  type CoverageInfo = String
  type FailedCheck = String
  type PassedCheck = String
  type ISLEvent = String
  type BehaviorTrackingOptions = String
  type ISLBreadcrumbData = String
  type ISLSpanData = String
  type MiddlewareOptions = String
  type ISLCaptureOptions = String
  type SanitizeOptions = String
  type ISLRequest = String
  type ISLResponse = String
  type NextFunction = String

  invariants exports_present {
    - true
  }
}
