# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTag, deleteTag, pushTags, getTag, listTags, getLatestTag, getTagsBetween, tagExists, deriveNextVersion, getCommitsSinceTag, getChangedFilesSinceTag, isGitRepo, getCurrentBranch, getCurrentCommit, GitTag, CreateTagOptions
# dependencies: child_process

domain Tags {
  version: "1.0.0"

  type GitTag = String
  type CreateTagOptions = String

  invariants exports_present {
    - true
  }
}
