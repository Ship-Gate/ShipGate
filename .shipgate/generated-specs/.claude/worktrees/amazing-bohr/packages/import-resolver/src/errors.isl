# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: importsDisabledError, moduleNotFoundError, parseError, readError, circularDependencyError, maxDepthExceededError, duplicateSymbolError, symbolNotFoundError, ambiguousImportError, invalidImportPathError, unusedImportWarning, shadowedImportWarning, formatErrors, formatWarnings
# dependencies: ${importPath}

domain Errors {
  version: "1.0.0"

  invariants exports_present {
    - true
  }
}
