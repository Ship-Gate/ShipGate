# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLToWASMType, WASMGeneratorOptions, WASMFunction, WASMParam, WASMLocal, WASMInstruction, WASMModule, WASMMemory, WASMTable, WASMGlobal, WASMExport, WASMImport, WASMFunctionType, WASMDataSegment, CompiledWASM, WASMSourceMap
# dependencies: 

domain Types {
  version: "1.0.0"

  type WASMGeneratorOptions = String
  type WASMFunction = String
  type WASMParam = String
  type WASMLocal = String
  type WASMInstruction = String
  type WASMModule = String
  type WASMMemory = String
  type WASMTable = String
  type WASMGlobal = String
  type WASMExport = String
  type WASMImport = String
  type WASMFunctionType = String
  type WASMDataSegment = String
  type CompiledWASM = String
  type WASMSourceMap = String

  invariants exports_present {
    - true
  }
}
