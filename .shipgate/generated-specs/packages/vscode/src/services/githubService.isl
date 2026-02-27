# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseGitHubRemote, fetchRepoInfo, fetchPullRequests, fetchWorkflowRuns, GitHubRepoInfo, GitHubPullRequest, GitHubWorkflowRun, GitHubConnectionState
# dependencies: 

domain GithubService {
  version: "1.0.0"

  type GitHubRepoInfo = String
  type GitHubPullRequest = String
  type GitHubWorkflowRun = String
  type GitHubConnectionState = String

  invariants exports_present {
    - true
  }
}
