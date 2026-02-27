# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateVerifyStage, generateGitHubVerifyJob, generateGitLabVerifyJob, generateCircleCIVerifyJob, generateJenkinsVerifyStage, getCircleCIVerifyJobNames, VerifyStageConfig
# dependencies: 

domain Verify {
  version: "1.0.0"

  type VerifyStageConfig = String

  invariants exports_present {
    - true
  }
}
