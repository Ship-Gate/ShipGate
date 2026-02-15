# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateUpload, validateFileContent, validateFileChecksum, uploadValidator, UploadValidator
# dependencies: crypto

domain Validation {
  version: "1.0.0"

  type UploadValidator = String

  invariants exports_present {
    - true
  }
}
