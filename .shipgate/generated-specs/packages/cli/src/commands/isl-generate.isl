# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: islGenerate, printIslGenerateResult, getIslGenerateExitCode, IslGenerateOptions, GeneratedFileEntry, DetectedPattern, IslGenerateResult
# dependencies: fs/promises, fs, path, glob, chalk, ora, @isl-lang/parser, readline

domain IslGenerate {
  version: "1.0.0"

  type IslGenerateOptions = String
  type GeneratedFileEntry = String
  type DetectedPattern = String
  type IslGenerateResult = String

  invariants exports_present {
    - true
  }
}
