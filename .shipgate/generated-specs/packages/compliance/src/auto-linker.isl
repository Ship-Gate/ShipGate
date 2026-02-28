# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: autoLinkVerification, VerificationSignal, SignalSource, SignalCategory, SignalFinding, LinkedControl, VerificationLink, AutoLinkResult, VerificationAutoLinker
# dependencies: 

domain AutoLinker {
  version: "1.0.0"

  type VerificationSignal = String
  type SignalSource = String
  type SignalCategory = String
  type SignalFinding = String
  type LinkedControl = String
  type VerificationLink = String
  type AutoLinkResult = String
  type VerificationAutoLinker = String

  invariants exports_present {
    - true
  }
}
