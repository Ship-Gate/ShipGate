# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: bundleModules, createEmptyBundle, BundlerOptions, Bundler
# dependencies: 

domain Bundler {
  version: "1.0.0"

  type BundlerOptions = String
  type Bundler = String

  invariants exports_present {
    - true
  }
}
