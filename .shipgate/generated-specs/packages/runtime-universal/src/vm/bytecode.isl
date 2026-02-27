# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: bytecode, disassemble, Instruction, BytecodeProgram, FunctionDefinition, SourceMap, ProgramMetadata, BytecodeBuilder
# dependencies: 

domain Bytecode {
  version: "1.0.0"

  type Instruction = String
  type BytecodeProgram = String
  type FunctionDefinition = String
  type SourceMap = String
  type ProgramMetadata = String
  type BytecodeBuilder = String

  invariants exports_present {
    - true
  }
}
