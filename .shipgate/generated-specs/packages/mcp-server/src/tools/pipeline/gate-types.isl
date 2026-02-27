# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: hashContent, generateFingerprint, GATE_TOOL_SCHEMA, GateDecision, EvidenceArtifact, ClauseResult, EvidenceManifest, EvidenceResults, GateInput, GateResult
# dependencies: crypto

domain GateTypes {
  version: "1.0.0"

  type GateDecision = String
  type EvidenceArtifact = String
  type ClauseResult = String
  type EvidenceManifest = String
  type EvidenceResults = String
  type GateInput = String
  type GateResult = String

  invariants exports_present {
    - true
  }
}
