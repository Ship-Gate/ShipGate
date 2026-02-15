# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: truthpackBuild, truthpackDiff, printTruthpackBuildResult, printTruthpackDiffResult, getTruthpackBuildExitCode, getTruthpackDiffExitCode, TruthpackBuildOptions, TruthpackBuildResult, TruthpackDiffOptions, TruthpackDiffResult
# dependencies: path, fs/promises, @isl-lang/truthpack-v2, @isl-lang/truthpack-v2/drift

domain Truthpack {
  version: "1.0.0"

  type TruthpackBuildOptions = String
  type TruthpackBuildResult = String
  type TruthpackDiffOptions = String
  type TruthpackDiffResult = String

  invariants exports_present {
    - true
  }
}
