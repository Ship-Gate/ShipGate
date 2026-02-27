# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateDeployStage, generateGitHubDeployJob, generateGitLabDeployJob, generateCircleCIDeployJob, generateJenkinsDeployStage, DeployStageConfig
# dependencies: 

domain Deploy {
  version: "1.0.0"

  type DeployStageConfig = String

  invariants exports_present {
    - true
  }
}
