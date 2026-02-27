# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ThreadSafeManifestOptions, ThreadSafeProjectManifest
# dependencies: 

domain ThreadSafeManifest {
  version: "1.0.0"

  type ThreadSafeManifestOptions = String
  type ThreadSafeProjectManifest = String

  invariants exports_present {
    - true
  }
}
