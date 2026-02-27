# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: S3Client, S3AuditArchiveOptions, S3AuditArchive, ArchiveResult, ArchiveFile
# dependencies: 

domain S3 {
  version: "1.0.0"

  type S3Client = String
  type S3AuditArchiveOptions = String
  type S3AuditArchive = String
  type ArchiveResult = String
  type ArchiveFile = String

  invariants exports_present {
    - true
  }
}
