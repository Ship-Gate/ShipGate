# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: domainInit, printDomainInitResult, domainValidate, printDomainValidateResult, getDomainValidateExitCode, DomainPackManifest, DomainInitOptions, DomainInitResult, DomainValidateOptions, DomainValidateResult
# dependencies: fs/promises, fs, path, chalk, ora, glob, vitest, @isl-lang/core

domain Domain {
  version: "1.0.0"

  type DomainPackManifest = String
  type DomainInitOptions = String
  type DomainInitResult = String
  type DomainValidateOptions = String
  type DomainValidateResult = String

  invariants exports_present {
    - true
  }
}
