# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolveTs, scanTsFile, TsResolverOptions
# dependencies: node:path, node:fs/promises, ${imp.specifier}, ${pkgName}

domain Resolver {
  version: "1.0.0"

  type TsResolverOptions = String

  invariants exports_present {
    - true
  }
}
