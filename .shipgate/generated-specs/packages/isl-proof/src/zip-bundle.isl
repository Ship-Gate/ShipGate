# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createZipBundle, collectFiles, scanDirectory, ZipBundleOptions, ZipBundleResult
# dependencies: fs/promises, path, crypto

domain ZipBundle {
  version: "1.0.0"

  type ZipBundleOptions = String
  type ZipBundleResult = String

  invariants exports_present {
    - true
  }
}
