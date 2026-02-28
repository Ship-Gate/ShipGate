# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: GitHubComment, GitHubCheckRun, GitHubCheckAnnotation, GitHubPullRequestFile
# dependencies: 

domain Types {
  version: "1.0.0"

  type GitHubComment = String
  type GitHubCheckRun = String
  type GitHubCheckAnnotation = String
  type GitHubPullRequestFile = String

  invariants exports_present {
    - true
  }
}
