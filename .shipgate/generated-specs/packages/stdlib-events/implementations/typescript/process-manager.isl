# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createProcessManager, ProcessManagerState, ProcessStep, ProcessEventHandler, IProcessManager, InMemoryProcessManager
# dependencies: 

domain ProcessManager {
  version: "1.0.0"

  type ProcessManagerState = String
  type ProcessStep = String
  type ProcessEventHandler = String
  type IProcessManager = String
  type InMemoryProcessManager = String

  invariants exports_present {
    - true
  }
}
