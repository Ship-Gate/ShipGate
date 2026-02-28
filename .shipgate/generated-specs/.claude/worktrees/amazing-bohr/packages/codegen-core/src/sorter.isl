# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: classifyImport, sortImports, sortNamedImports, deduplicateImports, formatImports, topologicalSortTypes, sortProperties, ImportGroup
# dependencies: 

domain Sorter {
  version: "1.0.0"

  type ImportGroup = String

  invariants exports_present {
    - true
  }
}
