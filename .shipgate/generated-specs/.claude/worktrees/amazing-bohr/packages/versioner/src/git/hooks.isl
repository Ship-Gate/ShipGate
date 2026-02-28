# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: installHooks, createPreCommitHook, createCommitMsgHook, removeHooks, checkHooksInstalled, getHuskyHook, HookOptions
# dependencies: fs/promises, path

domain Hooks {
  version: "1.0.0"

  type HookOptions = String

  invariants exports_present {
    - true
  }
}
