# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generatePatchDiff, generatePatchSet, formatPatchSet, writePatchSet, PatchDiff, PatchSet
# dependencies: fs/promises, fs

domain PatchWriter {
  version: "1.0.0"

  type PatchDiff = String
  type PatchSet = String

  invariants exports_present {
    - true
  }
}
