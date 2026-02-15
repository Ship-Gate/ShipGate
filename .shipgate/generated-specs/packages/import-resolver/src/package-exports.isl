# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolvePackageExport, findPackageJson, PackageExports, PackageJson
# dependencies: node:fs/promises, node:path

domain PackageExports {
  version: "1.0.0"

  type PackageExports = String
  type PackageJson = String

  invariants exports_present {
    - true
  }
}
