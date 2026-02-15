# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseImportPath, isStdlibImport, resolveStdlibImport, resolveImports, getModuleFilePaths, getSuggestions, mergeProvides, moduleFilesExist
# dependencies: @isl/stdlib-auth

domain Resolver {
  version: "1.0.0"

  invariants exports_present {
    - true
  }
}
