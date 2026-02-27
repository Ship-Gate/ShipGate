# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTempFile, createTempDirectory, writeTempFile, cleanupTempFiles, tempFileHandler, TempFileOptions, TempFileInfo, TempCleanupOptions, TempFileHandler
# dependencies: fs, path, crypto

domain Temp {
  version: "1.0.0"

  type TempFileOptions = String
  type TempFileInfo = String
  type TempCleanupOptions = String
  type TempFileHandler = String

  invariants exports_present {
    - true
  }
}
