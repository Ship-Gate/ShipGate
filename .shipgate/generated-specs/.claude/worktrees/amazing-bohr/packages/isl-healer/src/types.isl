# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Severity, GateVerdict, ProofVerdict, HealReason, Span, ViolationEvidence, Violation, SarifLocation, SarifResult, SarifRun, SarifReport, GateResultJSON, GateResult, MatchPattern, LocateStrategy, PatchOperation, PatchValidation, FixRecipe, FixContext, PatchRecord, SupportedFramework, FrameworkDetection, FrameworkAdapter, IterationSnapshot, BuildProof, TestProof, ClauseEvidence, ProofChainEntry, ProofBundleV2, HealResult, HealOptions, ISLAST, ISLEntity, ISLBehavior, ISLInvariant, ISLType, FixRecipeRegistry, WeakeningPattern, WeakeningCategory, WeakeningCheckResult, ForbiddenEditType, DiffHunk, PatchFile, PatchSet, ForbiddenEdit, PatchInspectionResult, HonestyGuardConfig, HonestyVerdict, HonestyGuardResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type Severity = String
  type GateVerdict = String
  type ProofVerdict = String
  type HealReason = String
  type Span = String
  type ViolationEvidence = String
  type Violation = String
  type SarifLocation = String
  type SarifResult = String
  type SarifRun = String
  type SarifReport = String
  type GateResultJSON = String
  type GateResult = String
  type MatchPattern = String
  type LocateStrategy = String
  type PatchOperation = String
  type PatchValidation = String
  type FixRecipe = String
  type FixContext = String
  type PatchRecord = String
  type SupportedFramework = String
  type FrameworkDetection = String
  type FrameworkAdapter = String
  type IterationSnapshot = String
  type BuildProof = String
  type TestProof = String
  type ClauseEvidence = String
  type ProofChainEntry = String
  type ProofBundleV2 = String
  type HealResult = String
  type HealOptions = String
  type ISLAST = String
  type ISLEntity = String
  type ISLBehavior = String
  type ISLInvariant = String
  type ISLType = String
  type FixRecipeRegistry = String
  type WeakeningPattern = String
  type WeakeningCategory = String
  type WeakeningCheckResult = String
  type ForbiddenEditType = String
  type DiffHunk = String
  type PatchFile = String
  type PatchSet = String
  type ForbiddenEdit = String
  type PatchInspectionResult = String
  type HonestyGuardConfig = String
  type HonestyVerdict = String
  type HonestyGuardResult = String

  invariants exports_present {
    - true
  }
}
