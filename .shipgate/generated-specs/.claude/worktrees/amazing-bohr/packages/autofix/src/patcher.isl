# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPatch, insertPatch, replacePatch, deletePatch, mergePatches, formatPatch, Patch, PatchContext, PatchResult, CodePatcher
# dependencies: diff

domain Patcher {
  version: "1.0.0"

  type Patch = String
  type PatchContext = String
  type PatchResult = String
  type CodePatcher = String

  invariants exports_present {
    - true
  }
}
