# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCheckService, CheckService, CreateCheckRunParams, UpdateCheckRunParams, CheckAnnotation
# dependencies: 

domain Checks {
  version: "1.0.0"

  type CheckService = String
  type CreateCheckRunParams = String
  type UpdateCheckRunParams = String
  type CheckAnnotation = String

  invariants exports_present {
    - true
  }
}
