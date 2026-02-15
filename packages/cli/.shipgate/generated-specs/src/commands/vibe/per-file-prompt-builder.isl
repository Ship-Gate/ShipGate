# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getBackendFilesToGenerate, buildPerFilePrompt, GET, POST, FileToGenerate, PerFilePromptContext, DomainLike
# dependencies: next/server

domain PerFilePromptBuilder {
  version: "1.0.0"

  type FileToGenerate = String
  type PerFilePromptContext = String
  type DomainLike = String

  invariants exports_present {
    - true
  }
}
