# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFileError, isRetryableError, isUserError, isSystemError, FileError, PathTraversalError, InvalidPathError, FileNotFoundError, FileAlreadyExistsError, FileTooLargeError, InvalidFileTypeError, AccessDeniedError, StorageQuotaExceededError, UploadFailedError, DownloadFailedError, ChecksumMismatchError, FolderNotFoundError, FolderNotEmptyError, ValidationError, FileErrorFactory, FileErrorAggregate
# dependencies: 

domain Errors {
  version: "1.0.0"

  type FileError = String
  type PathTraversalError = String
  type InvalidPathError = String
  type FileNotFoundError = String
  type FileAlreadyExistsError = String
  type FileTooLargeError = String
  type InvalidFileTypeError = String
  type AccessDeniedError = String
  type StorageQuotaExceededError = String
  type UploadFailedError = String
  type DownloadFailedError = String
  type ChecksumMismatchError = String
  type FolderNotFoundError = String
  type FolderNotEmptyError = String
  type ValidationError = String
  type FileErrorFactory = String
  type FileErrorAggregate = String

  invariants exports_present {
    - true
  }
}
