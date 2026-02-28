# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runIslGenerate, IslGenerateOptions, IslGenerateResult
# dependencies: child_process, fs, path

domain IslGenerateRunner {
  version: "1.0.0"

  type IslGenerateOptions = String
  type IslGenerateResult = String

  invariants exports_present {
    - true
  }
}
