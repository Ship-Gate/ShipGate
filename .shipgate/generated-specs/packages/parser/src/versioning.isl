# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isSupportedVersion, areVersionsCompatible, getMigrationWarnings, migrateISL, CURRENT_ISL_VERSION, SUPPORTED_VERSIONS, VERSION_COMPATIBILITY, ISLVersion, VersionCompatibility, MigrationRule
# dependencies: 

domain Versioning {
  version: "1.0.0"

  type ISLVersion = String
  type VersionCompatibility = String
  type MigrationRule = String

  invariants exports_present {
    - true
  }
}
