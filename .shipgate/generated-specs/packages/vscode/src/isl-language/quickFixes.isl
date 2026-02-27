# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: activate, createQuickFixesProvider, isCanonicalPrinterAvailable, registerQuickFixCommands, ISL_QUICK_FIX_KIND, ISL_REFACTOR_KIND, ISLQuickFixesOptions, ISLQuickFixesProvider
# dependencies: vscode

domain QuickFixes {
  version: "1.0.0"

  type ISLQuickFixesOptions = String
  type ISLQuickFixesProvider = String

  invariants exports_present {
    - true
  }
}
