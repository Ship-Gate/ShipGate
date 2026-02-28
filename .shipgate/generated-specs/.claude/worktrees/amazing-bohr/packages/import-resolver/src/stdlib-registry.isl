# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getStdlibRegistry, createStdlibRegistry, resetStdlibRegistry, StdlibModule, StdlibRegistry, ResolvedStdlibModule, StdlibRegistryManager
# dependencies: node:path, node:fs/promises, node:url

domain StdlibRegistry {
  version: "1.0.0"

  type StdlibModule = String
  type StdlibRegistry = String
  type ResolvedStdlibModule = String
  type StdlibRegistryManager = String

  invariants exports_present {
    - true
  }
}
