# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: OnboardingProvisioner
# dependencies: uuid

domain Provisioner {
  version: "1.0.0"

  type OnboardingProvisioner = String

  invariants exports_present {
    - true
  }
}
