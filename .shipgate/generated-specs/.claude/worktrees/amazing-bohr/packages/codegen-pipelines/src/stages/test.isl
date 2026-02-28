# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateTestStage, generateGitHubTestJob, generateGitLabTestJob, generateCircleCITestJob, generateJenkinsTestStage, TestStageConfig, TestStep
# dependencies: 

domain Test {
  version: "1.0.0"

  type TestStageConfig = String
  type TestStep = String

  invariants exports_present {
    - true
  }
}
