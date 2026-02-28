# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ProState, ProService
# dependencies: vscode

domain ProService {
  version: "1.0.0"

  type ProState = String
  type ProService = String

  invariants exports_present {
    - true
  }
}
