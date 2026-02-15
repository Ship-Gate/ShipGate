# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isInsertImportPatch, isAddHelperFunctionPatch, isWrapHandlerPatch, isReplaceCallPatch, isCreateFilePatch, Span, BasePatch, InsertImportPatch, AddHelperFunctionPatch, WrapHandlerPatch, ReplaceCallPatch, CreateFilePatch, Patch, PatchType, SinglePatchResult, PatchResult, AllowedFileCategory, PatchEngineOptions, FileContext, PatchValidationResult, PreflightResult
# dependencies: bar

domain Types {
  version: "1.0.0"

  type Span = String
  type BasePatch = String
  type InsertImportPatch = String
  type AddHelperFunctionPatch = String
  type WrapHandlerPatch = String
  type ReplaceCallPatch = String
  type CreateFilePatch = String
  type Patch = String
  type PatchType = String
  type SinglePatchResult = String
  type PatchResult = String
  type AllowedFileCategory = String
  type PatchEngineOptions = String
  type FileContext = String
  type PatchValidationResult = String
  type PreflightResult = String

  invariants exports_present {
    - true
  }
}
