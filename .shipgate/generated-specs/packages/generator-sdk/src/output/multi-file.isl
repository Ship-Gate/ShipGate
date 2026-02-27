# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: organizeFilesByType, organizeFilesByDirectory, sortFilesByPath, filterFilesByExtension, mergeFiles, MultiFileConfig, FileGroupConfig, FileGroup, MultiFileOutput
# dependencies: 

domain MultiFile {
  version: "1.0.0"

  type MultiFileConfig = String
  type FileGroupConfig = String
  type FileGroup = String
  type MultiFileOutput = String

  invariants exports_present {
    - true
  }
}
