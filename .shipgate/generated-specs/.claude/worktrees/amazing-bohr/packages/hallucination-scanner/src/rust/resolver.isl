# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolveRust, scanRustFile, RustResolverOptions
# dependencies: node:path

domain Resolver {
  version: "1.0.0"

  type RustResolverOptions = String

  invariants exports_present {
    - true
  }
}
