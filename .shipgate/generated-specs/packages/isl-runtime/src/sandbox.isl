# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSandbox, SandboxConfig, RecordedExecution, Sandbox
# dependencies: 

domain Sandbox {
  version: "1.0.0"

  type SandboxConfig = String
  type RecordedExecution = String
  type Sandbox = String

  invariants exports_present {
    - true
  }
}
