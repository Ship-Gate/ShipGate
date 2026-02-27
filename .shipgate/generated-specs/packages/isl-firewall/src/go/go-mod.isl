# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseGoModContent, findGoModPath, loadGoMod, GoModFile, GoModParseError
# dependencies: path, fs/promises

domain GoMod {
  version: "1.0.0"

  type GoModFile = String
  type GoModParseError = String

  invariants exports_present {
    - true
  }
}
