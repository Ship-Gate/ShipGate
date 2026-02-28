# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createWorkflowEngine, WorkflowEngine
# dependencies: uuid

domain Engine {
  version: "1.0.0"

  type WorkflowEngine = String

  invariants exports_present {
    - true
  }
}
