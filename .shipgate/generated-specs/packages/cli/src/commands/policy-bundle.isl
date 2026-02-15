# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPolicyBundle, printCreateBundleResult, getCreateBundleExitCode, verifyPolicyBundle, printVerifyBundleResult, getVerifyBundleExitCode, CreateBundleOptions, CreateBundleResult, VerifyBundleOptions, VerifyBundleResult
# dependencies: fs/promises, path, chalk, @isl-lang/policy-packs

domain PolicyBundle {
  version: "1.0.0"

  type CreateBundleOptions = String
  type CreateBundleResult = String
  type VerifyBundleOptions = String
  type VerifyBundleResult = String

  invariants exports_present {
    - true
  }
}
