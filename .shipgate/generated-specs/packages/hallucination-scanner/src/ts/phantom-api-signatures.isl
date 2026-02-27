# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getServerSideProps, PHANTOM_API_SIGNATURES, PhantomApiSeverity, PhantomApiSignature
# dependencies: 

domain PhantomApiSignatures {
  version: "1.0.0"

  type PhantomApiSeverity = String
  type PhantomApiSignature = String

  invariants exports_present {
    - true
  }
}
