# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createVersionPin, calculateManifestHash, StdlibCategory, ModuleProvides, StdlibFileEntry, ModuleStatus, StdlibModule, CategoryInfo, StdlibRegistry, ResolvedImport, ImportResolutionError, ResolverOptions, StdlibVersionPin, StdlibVersionManifest
# dependencies: 

domain Types {
  version: "1.0.0"

  type StdlibCategory = String
  type ModuleProvides = String
  type StdlibFileEntry = String
  type ModuleStatus = String
  type StdlibModule = String
  type CategoryInfo = String
  type StdlibRegistry = String
  type ResolvedImport = String
  type ImportResolutionError = String
  type ResolverOptions = String
  type StdlibVersionPin = String
  type StdlibVersionManifest = String

  invariants exports_present {
    - true
  }
}
