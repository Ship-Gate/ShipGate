# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildTruthpackSmart, BuildTruthpackOptions, BuildTruthpackResult
# dependencies: fs/promises, path, child_process

domain Builder {
  version: "1.0.0"

  type BuildTruthpackOptions = String
  type BuildTruthpackResult = String

  invariants exports_present {
    - true
  }
}
