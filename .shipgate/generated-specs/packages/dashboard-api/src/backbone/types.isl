# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RunTriggerSchema, RunStatusSchema, ArtifactKindSchema, VerdictValueSchema, CreateOrgSchema, CreateProjectSchema, ArtifactRefSchema, SubmitRunSchema, ListRunsQuerySchema, RunTrigger, RunStatus, ArtifactKind, VerdictValue, Org, Project, Run, Artifact, Verdict, CreateOrgInput, CreateProjectInput, ArtifactRefInput, SubmitRunInput, ListRunsQuery, RunWithDetails
# dependencies: zod

domain Types {
  version: "1.0.0"

  type RunTrigger = String
  type RunStatus = String
  type ArtifactKind = String
  type VerdictValue = String
  type Org = String
  type Project = String
  type Run = String
  type Artifact = String
  type Verdict = String
  type CreateOrgInput = String
  type CreateProjectInput = String
  type ArtifactRefInput = String
  type SubmitRunInput = String
  type ListRunsQuery = String
  type RunWithDetails = String

  invariants exports_present {
    - true
  }
}
