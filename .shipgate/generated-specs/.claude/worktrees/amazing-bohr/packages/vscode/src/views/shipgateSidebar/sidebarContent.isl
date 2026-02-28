# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: stateToResults, getWebviewContent, SidebarFinding, SidebarPipelineJob, SidebarPipelineRun, SidebarPipeline, SidebarResultsData, FileFindingInput
# dependencies: vscode

domain SidebarContent {
  version: "1.0.0"

  type SidebarFinding = String
  type SidebarPipelineJob = String
  type SidebarPipelineRun = String
  type SidebarPipeline = String
  type SidebarResultsData = String
  type FileFindingInput = String

  invariants exports_present {
    - true
  }
}
