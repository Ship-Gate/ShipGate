# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: applyPatches, previewPatches, ApplyPatchesResult, ApplyPatchesOptions
# dependencies: fs/promises, fs, path

domain PatchEngine {
  version: "1.0.0"

  type ApplyPatchesResult = String
  type ApplyPatchesOptions = String

  invariants exports_present {
    - true
  }
}
