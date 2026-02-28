# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPatchEngine, applyPatches, insertImport, addHelperFunction, wrapHandler, replaceCall, createFile, DEFAULT_CONFIG, InsertImportPatch, AddHelperFunctionPatch, WrapHandlerPatch, ReplaceCallPatch, CreateFilePatch, Patch, AllowedFiles, PatchEngineConfig, PatchApplicationResult, ApplyPatchesResult, PatchEngine
# dependencies: diff

domain PatchEngine {
  version: "1.0.0"

  type InsertImportPatch = String
  type AddHelperFunctionPatch = String
  type WrapHandlerPatch = String
  type ReplaceCallPatch = String
  type CreateFilePatch = String
  type Patch = String
  type AllowedFiles = String
  type PatchEngineConfig = String
  type PatchApplicationResult = String
  type ApplyPatchesResult = String
  type PatchEngine = String

  invariants exports_present {
    - true
  }
}
