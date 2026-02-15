# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BuildContext, BuildOrchestratorOptions, BuildRunResult, McpToolResponse, McpClientAbstraction, BuildOrchestratorService, SpecStorageService, EvidenceStorageService
# dependencies: vscode

domain BuildOrchestratorService {
  version: "1.0.0"

  type BuildContext = String
  type BuildOrchestratorOptions = String
  type BuildRunResult = String
  type McpToolResponse = String
  type McpClientAbstraction = String
  type BuildOrchestratorService = String

  invariants exports_present {
    - true
  }
}
