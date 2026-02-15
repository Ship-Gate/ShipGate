# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: compressFile, decompressFile, compressBuffer, decompressBuffer, compressionHandler, CompressionFormat, CompressionOptions, DecompressionOptions, CompressionResult, CompressionHandler
# dependencies: fs, stream/promises, zlib, crypto

domain Compress {
  version: "1.0.0"

  type CompressionFormat = String
  type CompressionOptions = String
  type DecompressionOptions = String
  type CompressionResult = String
  type CompressionHandler = String

  invariants exports_present {
    - true
  }
}
