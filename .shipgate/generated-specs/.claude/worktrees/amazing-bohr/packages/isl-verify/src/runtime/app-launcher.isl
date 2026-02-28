# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AppProcess, AppLauncher
# dependencies: child_process, fs/promises, path

domain AppLauncher {
  version: "1.0.0"

  type AppProcess = String
  type AppLauncher = String

  invariants exports_present {
    - true
  }
}
