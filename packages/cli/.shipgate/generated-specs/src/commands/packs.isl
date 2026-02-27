# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: installPack, listPacks, verifyPackInstall, printInstallResult, printListResult, printVerifyResult, getInstallExitCode, getVerifyExitCode, PackManifest, PackFile, RegistryEntry, PackRegistry, PackInstallOptions, PackInstallResult, PackListResult, PackVerifyResult
# dependencies: fs/promises, fs, path, crypto, chalk, stream/promises

domain Packs {
  version: "1.0.0"

  type PackManifest = String
  type PackFile = String
  type RegistryEntry = String
  type PackRegistry = String
  type PackInstallOptions = String
  type PackInstallResult = String
  type PackListResult = String
  type PackVerifyResult = String

  invariants exports_present {
    - true
  }
}
