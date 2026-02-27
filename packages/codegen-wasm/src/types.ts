/**
 * Type definitions for WASM code generation
 */

/**
 * WASM generation options
 */
export interface WASMGeneratorOptions {
  /** Output format */
  format: 'wasm' | 'wat';
  /** Optimization level (0-3) */
  optimizationLevel: number;
  /** Include debug info */
  debug: boolean;
  /** Target memory pages (64KB each) */
  memoryPages: number;
  /** Maximum memory pages */
  maxMemoryPages: number;
  /** Enable SIMD */
  simd: boolean;
  /** Enable threads */
  threads: boolean;
  /** Enable bulk memory operations */
  bulkMemory: boolean;
  /** Include runtime */
  includeRuntime: boolean;
}

/**
 * ISL to WASM type mapping
 */
export enum WASMType {
  I32 = 'i32',
  I64 = 'i64',
  F32 = 'f32',
  F64 = 'f64',
  V128 = 'v128', // SIMD
  FuncRef = 'funcref',
  ExternRef = 'externref',
}

/**
 * ISL type to WASM type mapping
 */
export const ISLToWASMType: Record<string, WASMType> = {
  Int: WASMType.I32,
  Int64: WASMType.I64,
  Float: WASMType.F32,
  Float64: WASMType.F64,
  Boolean: WASMType.I32,
  String: WASMType.I32, // Pointer to string
  UUID: WASMType.I32, // Pointer
  DateTime: WASMType.I64,
  Duration: WASMType.I64,
  Money: WASMType.I64,
};

/**
 * WASM function signature
 */
export interface WASMFunction {
  name: string;
  params: WASMParam[];
  results: WASMType[];
  locals: WASMLocal[];
  body: WASMInstruction[];
  export?: boolean;
}

/**
 * WASM parameter
 */
export interface WASMParam {
  name: string;
  type: WASMType;
}

/**
 * WASM local variable
 */
export interface WASMLocal {
  name: string;
  type: WASMType;
  count: number;
}

/**
 * WASM instruction
 */
export interface WASMInstruction {
  opcode: WASMOpcode;
  operands: unknown[];
}

/**
 * WASM opcodes (subset)
 */
export enum WASMOpcode {
  // Control
  Unreachable = 'unreachable',
  Nop = 'nop',
  Block = 'block',
  Loop = 'loop',
  If = 'if',
  Else = 'else',
  End = 'end',
  Br = 'br',
  BrIf = 'br_if',
  BrTable = 'br_table',
  Return = 'return',
  Call = 'call',
  CallIndirect = 'call_indirect',

  // Reference
  RefNull = 'ref.null',
  RefIsNull = 'ref.is_null',
  RefFunc = 'ref.func',

  // Parametric
  Drop = 'drop',
  Select = 'select',

  // Variables
  LocalGet = 'local.get',
  LocalSet = 'local.set',
  LocalTee = 'local.tee',
  GlobalGet = 'global.get',
  GlobalSet = 'global.set',

  // Memory
  I32Load = 'i32.load',
  I64Load = 'i64.load',
  F32Load = 'f32.load',
  F64Load = 'f64.load',
  I32Store = 'i32.store',
  I64Store = 'i64.store',
  F32Store = 'f32.store',
  F64Store = 'f64.store',
  MemorySize = 'memory.size',
  MemoryGrow = 'memory.grow',

  // Constants
  I32Const = 'i32.const',
  I64Const = 'i64.const',
  F32Const = 'f32.const',
  F64Const = 'f64.const',

  // Comparison
  I32Eqz = 'i32.eqz',
  I32Eq = 'i32.eq',
  I32Ne = 'i32.ne',
  I32LtS = 'i32.lt_s',
  I32LtU = 'i32.lt_u',
  I32GtS = 'i32.gt_s',
  I32GtU = 'i32.gt_u',
  I32LeS = 'i32.le_s',
  I32LeU = 'i32.le_u',
  I32GeS = 'i32.ge_s',
  I32GeU = 'i32.ge_u',

  // Arithmetic
  I32Add = 'i32.add',
  I32Sub = 'i32.sub',
  I32Mul = 'i32.mul',
  I32DivS = 'i32.div_s',
  I32DivU = 'i32.div_u',
  I32RemS = 'i32.rem_s',
  I32RemU = 'i32.rem_u',
  I32And = 'i32.and',
  I32Or = 'i32.or',
  I32Xor = 'i32.xor',
  I32Shl = 'i32.shl',
  I32ShrS = 'i32.shr_s',
  I32ShrU = 'i32.shr_u',
  I32Rotl = 'i32.rotl',
  I32Rotr = 'i32.rotr',

  // Float arithmetic
  F64Add = 'f64.add',
  F64Sub = 'f64.sub',
  F64Mul = 'f64.mul',
  F64Div = 'f64.div',
  F64Sqrt = 'f64.sqrt',

  // Conversion
  I32WrapI64 = 'i32.wrap_i64',
  I64ExtendI32S = 'i64.extend_i32_s',
  I64ExtendI32U = 'i64.extend_i32_u',
  F32ConvertI32S = 'f32.convert_i32_s',
  F64ConvertI32S = 'f64.convert_i32_s',
}

/**
 * WASM module definition
 */
export interface WASMModule {
  name: string;
  memories: WASMMemory[];
  tables: WASMTable[];
  globals: WASMGlobal[];
  functions: WASMFunction[];
  exports: WASMExport[];
  imports: WASMImport[];
  start?: string;
  data: WASMDataSegment[];
}

/**
 * WASM memory definition
 */
export interface WASMMemory {
  name: string;
  initial: number;
  maximum?: number;
  shared?: boolean;
}

/**
 * WASM table definition
 */
export interface WASMTable {
  name: string;
  type: 'funcref' | 'externref';
  initial: number;
  maximum?: number;
}

/**
 * WASM global variable
 */
export interface WASMGlobal {
  name: string;
  type: WASMType;
  mutable: boolean;
  init: number | bigint | string;
}

/**
 * WASM export
 */
export interface WASMExport {
  name: string;
  kind: 'function' | 'table' | 'memory' | 'global';
  index: number | string;
}

/**
 * WASM import
 */
export interface WASMImport {
  module: string;
  name: string;
  kind: 'function' | 'table' | 'memory' | 'global';
  type?: WASMFunctionType;
}

/**
 * WASM function type
 */
export interface WASMFunctionType {
  params: WASMType[];
  results: WASMType[];
}

/**
 * WASM data segment
 */
export interface WASMDataSegment {
  offset: number;
  data: Uint8Array | string;
}

/**
 * Compiled WASM result
 */
export interface CompiledWASM {
  wasm: Uint8Array;
  wat?: string;
  sourceMap?: WASMSourceMap;
  exports: string[];
  imports: string[];
}

/**
 * WASM source map
 */
export interface WASMSourceMap {
  version: number;
  file: string;
  sources: string[];
  mappings: string;
}
