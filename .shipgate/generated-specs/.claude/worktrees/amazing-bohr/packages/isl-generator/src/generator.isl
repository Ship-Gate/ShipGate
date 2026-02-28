# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: POST, createGenerator, GenerationRequest, GenerationOptions, GenerationPlan, PlannedFile, PlannedModification, PlannedChange, PlannedDependency, RefusedAction, GenerationResult, FileDiff, DiffHunk, ProofLink, ISLGenerator, router
# dependencies: next/server, zod, express, vitest

domain Generator {
  version: "1.0.0"

  type GenerationRequest = String
  type GenerationOptions = String
  type GenerationPlan = String
  type PlannedFile = String
  type PlannedModification = String
  type PlannedChange = String
  type PlannedDependency = String
  type RefusedAction = String
  type GenerationResult = String
  type FileDiff = String
  type DiffHunk = String
  type ProofLink = String
  type ISLGenerator = String

  invariants exports_present {
    - true
  }
}
