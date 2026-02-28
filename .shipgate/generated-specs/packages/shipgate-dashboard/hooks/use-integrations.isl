# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: useGitHubStatus, useGitHubRepos, useGitHubPrs, useGitHubCommits, useGitHubDisconnect, useSlackStatus, useSlackChannels, useDeploymentProviders, useDeployments, GitHubStatus, GitHubRepo, GitHubPR, GitHubCommit, SlackStatus, SlackRule, SlackChannel, DeploymentProviderInfo, DeploymentItem
# dependencies: @/lib/api-client, react

domain UseIntegrations {
  version: "1.0.0"

  type GitHubStatus = String
  type GitHubRepo = String
  type GitHubPR = String
  type GitHubCommit = String
  type SlackStatus = String
  type SlackRule = String
  type SlackChannel = String
  type DeploymentProviderInfo = String
  type DeploymentItem = String

  invariants exports_present {
    - true
  }
}
