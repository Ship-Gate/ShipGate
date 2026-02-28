# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_FORMAT_CONFIGS, ImportStatement, NamedImport, ImportGroupConfig, TypeDeclaration, TopologicalSortConfig, Language, FormatConfig, GeneratedFile, HeaderConfig, CodePrinter
# dependencies: 

domain Types {
  version: "1.0.0"

  type ImportStatement = String
  type NamedImport = String
  type ImportGroupConfig = String
  type TypeDeclaration = String
  type TopologicalSortConfig = String
  type Language = String
  type FormatConfig = String
  type GeneratedFile = String
  type HeaderConfig = String
  type CodePrinter = String

  invariants exports_present {
    - true
  }
}
