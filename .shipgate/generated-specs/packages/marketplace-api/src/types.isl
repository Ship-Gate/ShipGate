# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PACK_CATEGORIES, PackCategory, Author, Pack, PackVersion, Signature, PackWithLatest, PackVersionWithSignatures
# dependencies: 

domain Types {
  version: "1.0.0"

  type PackCategory = String
  type Author = String
  type Pack = String
  type PackVersion = String
  type Signature = String
  type PackWithLatest = String
  type PackVersionWithSignatures = String

  invariants exports_present {
    - true
  }
}
