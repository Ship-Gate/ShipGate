# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLSpec, DeploymentPlatform, DeploymentAdapter
# dependencies: 

domain Types {
  version: "1.0.0"

  type ISLSpec = String
  type DeploymentPlatform = String
  type DeploymentAdapter = String

  invariants exports_present {
    - true
  }
}
