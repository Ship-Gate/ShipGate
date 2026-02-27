// ============================================================================
// WebAssembly Text Format (WAT) Emitter
// Converts WasmModule to WAT text format
// ============================================================================

// ============================================================================
// INTERNAL TYPES (emitter-specific representation)
// ============================================================================

/**
 * Internal function type representation
 */
interface WasmFunctionType {
  params: string[];
  results: string[];
}

/**
 * Internal instruction representation
 */
interface WasmInstruction {
  op: string;
  label?: string;
  type?: string;
  depth?: number;
  depths?: number[];
  default?: number;
  func?: string | number;
  index?: number;
  offset?: number;
  align?: number;
  value?: number | bigint;
  [key: string]: unknown;
}

/**
 * Internal function representation
 */
interface WasmFunction {
  name: string;
  type: WasmFunctionType;
  locals: string[];
  body: WasmInstruction[];
  comments?: string[];
}

/**
 * Internal import representation
 */
interface WasmImport {
  module: string;
  name: string;
  kind: 'func' | 'memory' | 'table' | 'global';
  type?: WasmFunctionType;
}

/**
 * Internal global representation
 */
interface WasmGlobal {
  name: string;
  type: string;
  mutable: boolean;
  init: number | bigint | string;
}

/**
 * Internal memory representation
 */
interface WasmMemory {
  name: string;
  initial: number;
  maximum?: number;
  shared?: boolean;
}

/**
 * Internal data segment representation
 */
interface WasmDataSegment {
  offset: number;
  data: Uint8Array | string;
}

/**
 * Internal module representation for WAT emission
 */
interface WasmModule {
  name: string;
  types: WasmFunctionType[];
  imports: WasmImport[];
  memories: WasmMemory[];
  globals: WasmGlobal[];
  functions: WasmFunction[];
  exports: { name: string; kind: 'func' | 'memory' | 'table' | 'global'; index: number | string }[];
  data: WasmDataSegment[];
}

// ============================================================================
// TYPES
// ============================================================================

export interface WatModule {
  text: string;
  sourceMap?: SourceMapping[];
}

export interface SourceMapping {
  wasmOffset: number;
  sourceLine: number;
  sourceColumn: number;
}

// ============================================================================
// MAIN EMITTER
// ============================================================================

/**
 * Compile WasmModule to WAT text format
 */
export function compileToWat(module: WasmModule): string {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  // Module header
  lines.push(`(module $${module.name}`);

  // Types section
  if (module.types.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Types`);
    module.types.forEach((type: WasmFunctionType, i: number) => {
      lines.push(`${indent(1)}(type $type${i} (func ${formatFuncType(type)}))`);
    });
  }

  // Imports section
  if (module.imports.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Imports`);
    for (const imp of module.imports) {
      lines.push(emitImport(imp, 1));
    }
  }

  // Memory section
  if (module.memories.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Memory`);
    for (const mem of module.memories) {
      lines.push(emitMemory(mem, 1));
    }
  }

  // Globals section
  if (module.globals.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Globals`);
    for (const global of module.globals) {
      lines.push(emitGlobal(global, 1));
    }
  }

  // Functions section
  if (module.functions.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Functions`);
    for (const func of module.functions) {
      lines.push('');
      lines.push(emitFunction(func, 1));
    }
  }

  // Exports section
  if (module.exports.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Exports`);
    for (const exp of module.exports) {
      const kindMap: Record<string, string> = { func: 'func', memory: 'memory', table: 'table', global: 'global' };
      lines.push(`${indent(1)}(export "${exp.name}" (${kindMap[exp.kind]} ${exp.index}))`);
    }
  }

  // Data section
  if (module.data.length > 0) {
    lines.push('');
    lines.push(`${indent(1)};; Data`);
    for (const seg of module.data) {
      lines.push(emitDataSegment(seg, 1));
    }
  }

  lines.push(')');

  return lines.join('\n');
}

// ============================================================================
// SECTION EMITTERS
// ============================================================================

function emitImport(imp: WasmImport, level: number): string {
  const indent = '  '.repeat(level);
  
  switch (imp.kind) {
    case 'func':
      return `${indent}(import "${imp.module}" "${imp.name}" (func $${imp.module}_${imp.name} ${formatFuncType(imp.type!)}))`;
    case 'memory':
      return `${indent}(import "${imp.module}" "${imp.name}" (memory 1))`;
    case 'table':
      return `${indent}(import "${imp.module}" "${imp.name}" (table 1 funcref))`;
    case 'global':
      return `${indent}(import "${imp.module}" "${imp.name}" (global i32))`;
    default:
      return '';
  }
}

function emitMemory(mem: WasmMemory, level: number): string {
  const indent = '  '.repeat(level);
  const shared = mem.shared ? ' shared' : '';
  const max = mem.maximum ? ` ${mem.maximum}` : '';
  return `${indent}(memory $${mem.name} ${mem.initial}${max}${shared})`;
}

function emitGlobal(global: WasmGlobal, level: number): string {
  const indent = '  '.repeat(level);
  const mut = global.mutable ? `(mut ${global.type})` : global.type;
  const init = typeof global.init === 'bigint' 
    ? `(i64.const ${global.init})`
    : `(${global.type}.const ${global.init})`;
  return `${indent}(global $${global.name} ${mut} ${init})`;
}

function emitFunction(func: WasmFunction, level: number): string {
  const lines: string[] = [];
  const indent = '  '.repeat(level);
  const indent2 = '  '.repeat(level + 1);

  // Comments
  if (func.comments) {
    for (const comment of func.comments) {
      if (comment) {
        lines.push(`${indent};; ${comment}`);
      }
    }
  }

  // Function signature
  const params = func.type.params.map((p: string, i: number) => `(param $p${i} ${p})`).join(' ');
  const results = func.type.results.map((r: string) => `(result ${r})`).join(' ');
  const sig = [params, results].filter(Boolean).join(' ');

  lines.push(`${indent}(func $${func.name} ${sig}`);

  // Local variables
  for (let i = 0; i < func.locals.length; i++) {
    lines.push(`${indent2}(local $l${i} ${func.locals[i]})`);
  }

  // Body
  const bodyIndent = level + 1;
  for (const instr of func.body) {
    lines.push(emitInstruction(instr, bodyIndent));
  }

  lines.push(`${indent})`);

  return lines.join('\n');
}

function emitDataSegment(seg: WasmDataSegment, level: number): string {
  const indent = '  '.repeat(level);
  const data = typeof seg.data === 'string' 
    ? `"${escapeString(seg.data)}"`
    : `"${bytesToEscapedString(seg.data)}"`;
  return `${indent}(data (i32.const ${seg.offset}) ${data})`;
}

// ============================================================================
// INSTRUCTION EMITTER
// ============================================================================

function emitInstruction(instr: WasmInstruction, level: number): string {
  const indent = '  '.repeat(level);

  switch (instr.op) {
    // Control flow
    case 'unreachable':
    case 'nop':
    case 'return':
    case 'else':
    case 'end':
      return `${indent}${instr.op}`;

    case 'block':
      const blockLabel = instr.label ? ` $${instr.label}` : '';
      const blockType = instr.type ? ` (result ${instr.type})` : '';
      return `${indent}block${blockLabel}${blockType}`;

    case 'loop':
      const loopLabel = instr.label ? ` $${instr.label}` : '';
      const loopType = instr.type ? ` (result ${instr.type})` : '';
      return `${indent}loop${loopLabel}${loopType}`;

    case 'if':
      const ifType = instr.type ? ` (result ${instr.type})` : '';
      return `${indent}if${ifType}`;

    case 'br':
    case 'br_if':
      return `${indent}${instr.op} ${instr.depth}`;

    case 'br_table':
      return `${indent}br_table ${(instr.depths ?? []).join(' ')} ${instr.default}`;

    case 'call':
      const target = typeof instr.func === 'string' ? `$${instr.func}` : instr.func;
      return `${indent}call ${target}`;

    case 'call_indirect':
      return `${indent}call_indirect (type ${instr.type})`;

    // Variables
    case 'local.get':
    case 'local.set':
    case 'local.tee':
      return `${indent}${instr.op} ${instr.index}`;

    case 'global.get':
    case 'global.set':
      return `${indent}${instr.op} ${instr.index}`;

    // Memory operations
    case 'i32.load':
    case 'i64.load':
    case 'f32.load':
    case 'f64.load':
    case 'i32.store':
    case 'i64.store':
    case 'f32.store':
    case 'f64.store':
      const memOffset = instr.offset ? ` offset=${instr.offset}` : '';
      const memAlign = instr.align !== undefined ? ` align=${instr.align}` : '';
      return `${indent}${instr.op}${memOffset}${memAlign}`;

    case 'memory.size':
    case 'memory.grow':
      return `${indent}${instr.op}`;

    // Constants
    case 'i32.const':
    case 'f32.const':
    case 'f64.const':
      return `${indent}${instr.op} ${instr.value}`;

    case 'i64.const':
      return `${indent}${instr.op} ${(instr.value ?? 0).toString()}`;

    // All other numeric operations
    case 'i32.add':
    case 'i32.sub':
    case 'i32.mul':
    case 'i32.div_s':
    case 'i32.div_u':
    case 'i32.rem_s':
    case 'i32.rem_u':
    case 'i32.and':
    case 'i32.or':
    case 'i32.xor':
    case 'i32.shl':
    case 'i32.shr_s':
    case 'i32.shr_u':
    case 'i32.eq':
    case 'i32.ne':
    case 'i32.lt_s':
    case 'i32.lt_u':
    case 'i32.gt_s':
    case 'i32.gt_u':
    case 'i32.le_s':
    case 'i32.le_u':
    case 'i32.ge_s':
    case 'i32.ge_u':
    case 'i32.eqz':
    case 'i64.add':
    case 'i64.sub':
    case 'i64.mul':
    case 'i64.div_s':
    case 'i64.div_u':
    case 'i64.eq':
    case 'i64.ne':
    case 'i64.lt_s':
    case 'i64.gt_s':
    case 'f64.add':
    case 'f64.sub':
    case 'f64.mul':
    case 'f64.div':
    case 'f64.eq':
    case 'f64.ne':
    case 'f64.lt':
    case 'f64.gt':
    case 'f64.le':
    case 'f64.ge':
    case 'f64.neg':
    case 'f64.abs':
    case 'f64.ceil':
    case 'f64.floor':
    case 'f64.sqrt':
    case 'i32.wrap_i64':
    case 'i64.extend_i32_s':
    case 'i64.extend_i32_u':
    case 'f64.convert_i32_s':
    case 'f64.convert_i64_s':
    case 'i32.trunc_f64_s':
    case 'drop':
    case 'select':
      return `${indent}${instr.op}`;

    default:
      return `${indent};; unknown: ${(instr as WasmInstruction).op}`;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatFuncType(type: WasmFunctionType): string {
  const params = type.params.map((p: string) => `(param ${p})`).join(' ');
  const results = type.results.map((r: string) => `(result ${r})`).join(' ');
  return [params, results].filter(Boolean).join(' ');
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function bytesToEscapedString(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    if (byte >= 32 && byte < 127 && byte !== 34 && byte !== 92) {
      result += String.fromCharCode(byte);
    } else {
      result += `\\${byte.toString(16).padStart(2, '0')}`;
    }
  }
  return result;
}

// ============================================================================
// BINARY COMPILATION (using wabt or similar)
// ============================================================================

/**
 * Compile WAT to WASM binary
 * Note: Requires external tool like wabt's wat2wasm
 */
export async function compileWatToWasm(_wat: string): Promise<Uint8Array> {
  // This would typically shell out to wat2wasm or use a WASM tool
  // For now, return a placeholder
  throw new Error('Binary compilation requires wabt or similar tool');
}

/**
 * Validate WAT syntax
 */
export function validateWat(wat: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic validation
  let parenDepth = 0;
  let inString = false;
  
  for (let i = 0; i < wat.length; i++) {
    const char = wat[i];
    const prev = wat[i - 1];
    
    if (char === '"' && prev !== '\\') {
      inString = !inString;
    }
    
    if (!inString) {
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
      
      if (parenDepth < 0) {
        errors.push(`Unmatched ')' at position ${i}`);
      }
    }
  }
  
  if (inString) {
    errors.push('Unclosed string literal');
  }
  
  if (parenDepth !== 0) {
    errors.push(`Unbalanced parentheses: ${parenDepth}`);
  }
  
  return { valid: errors.length === 0, errors };
}
