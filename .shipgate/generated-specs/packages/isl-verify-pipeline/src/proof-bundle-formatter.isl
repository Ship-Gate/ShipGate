# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ProofBundle, ProofProperty, Finding, ProofBundleBuilder, ProofBundleFormatter
# dependencies: 

domain ProofBundleFormatter {
  version: "1.0.0"

  type ProofBundle = String
  type ProofProperty = String
  type Finding = String
  type ProofBundleBuilder = String
  type ProofBundleFormatter = String

  invariants exports_present {
    - true
  }
}
