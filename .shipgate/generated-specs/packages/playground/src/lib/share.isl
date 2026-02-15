# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: encodeShareUrl, decodeShareUrl, getShareDataFromUrl, copyToClipboard, generateEmbedCode, ShareData
# dependencies: lz-string

domain Share {
  version: "1.0.0"

  type ShareData = String

  invariants exports_present {
    - true
  }
}
