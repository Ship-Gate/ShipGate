# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ImportResolverOptions, ImportResolver
# dependencies: path

domain ImportResolver {
  version: "1.0.0"

  type ImportResolverOptions = String
  type ImportResolver = String

  invariants exports_present {
    - true
  }
}
