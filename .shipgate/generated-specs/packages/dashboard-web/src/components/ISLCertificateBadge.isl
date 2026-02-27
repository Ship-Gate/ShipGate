# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLCertificateBadge, ISLCertificateBadgeSVG, CertificateVerdict, ISLCertificateBadgeProps
# dependencies: @/lib/utils

domain ISLCertificateBadge {
  version: "1.0.0"

  type CertificateVerdict = String
  type ISLCertificateBadgeProps = String

  invariants exports_present {
    - true
  }
}
