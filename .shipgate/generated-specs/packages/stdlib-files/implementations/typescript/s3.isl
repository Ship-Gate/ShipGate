# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createS3Provider, createS3ProviderFromEnv, S3Config, S3StorageProvider
# dependencies: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

domain S3 {
  version: "1.0.0"

  type S3Config = String
  type S3StorageProvider = String

  invariants exports_present {
    - true
  }
}
