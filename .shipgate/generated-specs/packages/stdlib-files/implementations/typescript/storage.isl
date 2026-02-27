# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: StorageConfig, StorageMetadata, PresignedUrlOptions, UploadOptions, MultipartUploadOptions, MultipartUpload, UploadPartOptions, UploadedPart, CompleteMultipartOptions, CopyOptions, ListOptions, ListResult, StorageProvider, InMemoryStorageProvider
# dependencies: 

domain Storage {
  version: "1.0.0"

  type StorageConfig = String
  type StorageMetadata = String
  type PresignedUrlOptions = String
  type UploadOptions = String
  type MultipartUploadOptions = String
  type MultipartUpload = String
  type UploadPartOptions = String
  type UploadedPart = String
  type CompleteMultipartOptions = String
  type CopyOptions = String
  type ListOptions = String
  type ListResult = String
  type StorageProvider = String
  type InMemoryStorageProvider = String

  invariants exports_present {
    - true
  }
}
