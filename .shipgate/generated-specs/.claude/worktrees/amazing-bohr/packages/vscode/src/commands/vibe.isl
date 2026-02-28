# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerVibeCommand, VibeResult, VibeState
# dependencies: vscode, child_process, fs, path

domain Vibe {
  version: "1.0.0"

  type VibeResult = String
  type VibeState = String

  invariants exports_present {
    - true
  }
}
