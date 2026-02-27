# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createBundle, validateBundle, serializeBundle, deserializeBundle, checkBundleCompatibility, BUNDLE_FORMAT_VERSION, PolicyBundleMetadata, PackVersionSpec, PolicyBundle, BundleValidationResult, DeprecationNotice
# dependencies: 

domain Bundle {
  version: "1.0.0"

  type PolicyBundleMetadata = String
  type PackVersionSpec = String
  type PolicyBundle = String
  type BundleValidationResult = String
  type DeprecationNotice = String

  invariants exports_present {
    - true
  }
}
