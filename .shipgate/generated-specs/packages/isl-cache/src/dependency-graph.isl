# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FileType, GeneratedFile, DependencyGraphOptions, DependencyGraph
# dependencies: 

domain DependencyGraph {
  version: "1.0.0"

  type FileType = String
  type GeneratedFile = String
  type DependencyGraphOptions = String
  type DependencyGraph = String

  invariants exports_present {
    - true
  }
}
