# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseTSConfig, findTSConfig, hashTSConfig, resolvePathAlias, matchesPathAlias, TSConfig, PathAliases
# dependencies: node:fs/promises, node:path, node:crypto

domain Tsconfig {
  version: "1.0.0"

  type TSConfig = String
  type PathAliases = String

  invariants exports_present {
    - true
  }
}
