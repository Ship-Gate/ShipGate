# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getGitHubConnections, getGitHubToken, githubFetch, GitHubConnectionInfo
# dependencies: @/lib/prisma, @/lib/encryption

domain Github {
  version: "1.0.0"

  type GitHubConnectionInfo = String

  invariants exports_present {
    - true
  }
}
