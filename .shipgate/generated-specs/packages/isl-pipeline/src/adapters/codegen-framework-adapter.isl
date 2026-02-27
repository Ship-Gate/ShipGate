# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLSpec, ISLEndpoint, FileMap, GeneratedFile, CodegenContext, FrameworkAdapter
# dependencies: 

domain CodegenFrameworkAdapter {
  version: "1.0.0"

  type ISLSpec = String
  type ISLEndpoint = String
  type FileMap = String
  type GeneratedFile = String
  type CodegenContext = String
  type FrameworkAdapter = String

  invariants exports_present {
    - true
  }
}
