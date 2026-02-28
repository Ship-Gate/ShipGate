# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: renderEvidenceHTML, renderBundleToHTML, openEvidence, EvidenceBundle
# dependencies: fs/promises, fs, path, child_process

domain EvidenceHtml {
  version: "1.0.0"

  type EvidenceBundle = String

  invariants exports_present {
    - true
  }
}
