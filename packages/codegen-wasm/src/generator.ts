/**
 * WASM Code Generator
 * Generates WebAssembly from ISL specifications
 */

import {
  WASMModule,
  WASMFunction,
  WASMInstruction,
  WASMOpcode,
  WASMType,
  WASMGeneratorOptions,
  WASMParam,
  WASMLocal,
  ISLToWASMType,
  CompiledWASM,
} from './types';

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: WASMGeneratorOptions = {
  format: 'wasm',
  optimizationLevel: 2,
  debug: false,
  memoryPages: 16,
  maxMemoryPages: 256,
  simd: false,
  threads: false,
  bulkMemory: true,
  includeRuntime: true,
};

/**
 * ISL behavior definition (simplified)
 */
export interface ISLBehavior {
  domain: string;
  name: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  preconditions: Array<{ name: string; expression: string }>;
  postconditions: Array<{ name: string; expression: string }>;
  body?: string;
}

/**
 * WASM Generator
 */
export class WASMGenerator {
  private options: WASMGeneratorOptions;
  private module: WASMModule;
  private functionIndex = 0;
  private dataOffset = 0;
  private stringTable: Map<string, number> = new Map();

  constructor(options: Partial<WASMGeneratorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.module = this.createEmptyModule();
  }

  /**
   * Generate WASM from ISL behaviors
   */
  generate(behaviors: ISLBehavior[]): CompiledWASM {
    // Reset state
    this.module = this.createEmptyModule();
    this.functionIndex = 0;
    this.dataOffset = 1024; // Reserve first 1KB for runtime

    // Add runtime if enabled
    if (this.options.includeRuntime) {
      this.addRuntime();
    }

    // Generate functions for each behavior
    for (const behavior of behaviors) {
      this.generateBehavior(behavior);
    }

    // Compile to binary
    return this.compile();
  }

  /**
   * Generate a single behavior
   */
  private generateBehavior(behavior: ISLBehavior): void {
    const funcName = `${behavior.domain}_${behavior.name}`;

    // Convert ISL types to WASM types
    const params: WASMParam[] = behavior.inputs.map((input) => ({
      name: input.name,
      type: ISLToWASMType[input.type] ?? WASMType.I32,
    }));

    const results: WASMType[] = behavior.outputs.map(
      (output) => ISLToWASMType[output.type] ?? WASMType.I32
    );

    // Generate function body
    const body: WASMInstruction[] = [];
    const locals: WASMLocal[] = [];

    // Add precondition checks
    for (const precondition of behavior.preconditions) {
      body.push(...this.generateConditionCheck(precondition, 'precondition'));
    }

    // Generate main behavior logic
    if (behavior.body) {
      body.push(...this.generateExpression(behavior.body));
    } else {
      // Default: return 0 for each output
      for (const _ of results) {
        body.push({ opcode: WASMOpcode.I32Const, operands: [0] });
      }
    }

    // Add postcondition checks
    for (const postcondition of behavior.postconditions) {
      body.push(...this.generateConditionCheck(postcondition, 'postcondition'));
    }

    // Add return
    body.push({ opcode: WASMOpcode.Return, operands: [] });

    // Create function
    const func: WASMFunction = {
      name: funcName,
      params,
      results,
      locals,
      body,
      export: true,
    };

    this.module.functions.push(func);
    this.module.exports.push({
      name: funcName,
      kind: 'function',
      index: this.functionIndex++,
    });
  }

  /**
   * Generate condition check instructions
   */
  private generateConditionCheck(
    condition: { name: string; expression: string },
    type: 'precondition' | 'postcondition'
  ): WASMInstruction[] {
    const instructions: WASMInstruction[] = [];

    // Evaluate condition expression
    instructions.push(...this.generateExpression(condition.expression));

    // If false, trap
    instructions.push({
      opcode: WASMOpcode.If,
      operands: [WASMType.I32],
    });
    instructions.push({ opcode: WASMOpcode.Nop, operands: [] });
    instructions.push({ opcode: WASMOpcode.Else, operands: [] });

    // Store error info and trap
    const errorMsg = `${type} failed: ${condition.name}`;
    const msgPtr = this.addString(errorMsg);
    instructions.push({ opcode: WASMOpcode.I32Const, operands: [msgPtr] });
    instructions.push({ opcode: WASMOpcode.Call, operands: ['$trap_with_message'] });
    instructions.push({ opcode: WASMOpcode.Unreachable, operands: [] });

    instructions.push({ opcode: WASMOpcode.End, operands: [] });

    return instructions;
  }

  /**
   * Generate instructions for an expression
   */
  private generateExpression(expr: string): WASMInstruction[] {
    const instructions: WASMInstruction[] = [];

    // Simple expression parser (would need full parser in production)
    const tokens = this.tokenize(expr);

    for (const token of tokens) {
      if (typeof token === 'number') {
        instructions.push({ opcode: WASMOpcode.I32Const, operands: [token] });
      } else if (token === '+') {
        instructions.push({ opcode: WASMOpcode.I32Add, operands: [] });
      } else if (token === '-') {
        instructions.push({ opcode: WASMOpcode.I32Sub, operands: [] });
      } else if (token === '*') {
        instructions.push({ opcode: WASMOpcode.I32Mul, operands: [] });
      } else if (token === '/') {
        instructions.push({ opcode: WASMOpcode.I32DivS, operands: [] });
      } else if (token === '==') {
        instructions.push({ opcode: WASMOpcode.I32Eq, operands: [] });
      } else if (token === '!=') {
        instructions.push({ opcode: WASMOpcode.I32Ne, operands: [] });
      } else if (token === '<') {
        instructions.push({ opcode: WASMOpcode.I32LtS, operands: [] });
      } else if (token === '>') {
        instructions.push({ opcode: WASMOpcode.I32GtS, operands: [] });
      } else if (token === '&&') {
        instructions.push({ opcode: WASMOpcode.I32And, operands: [] });
      } else if (token === '||') {
        instructions.push({ opcode: WASMOpcode.I32Or, operands: [] });
      } else if (token === 'true') {
        instructions.push({ opcode: WASMOpcode.I32Const, operands: [1] });
      } else if (token === 'false') {
        instructions.push({ opcode: WASMOpcode.I32Const, operands: [0] });
      } else if (token.startsWith('$')) {
        // Local variable reference
        instructions.push({ opcode: WASMOpcode.LocalGet, operands: [token] });
      }
    }

    return instructions;
  }

  /**
   * Tokenize expression
   */
  private tokenize(expr: string): Array<string | number> {
    const tokens: Array<string | number> = [];
    const regex = /(\d+|[+\-*/()]|==|!=|<=|>=|<|>|&&|\|\||true|false|\$\w+|\w+)/g;
    let match;

    while ((match = regex.exec(expr)) !== null) {
      const token = match[1]!;
      if (/^\d+$/.test(token)) {
        tokens.push(parseInt(token, 10));
      } else {
        tokens.push(token);
      }
    }

    return tokens;
  }

  /**
   * Add a string to the data section
   */
  private addString(str: string): number {
    if (this.stringTable.has(str)) {
      return this.stringTable.get(str)!;
    }

    const offset = this.dataOffset;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str + '\0');

    this.module.data.push({
      offset,
      data: bytes,
    });

    this.stringTable.set(str, offset);
    this.dataOffset += bytes.length;

    return offset;
  }

  /**
   * Add runtime functions
   */
  private addRuntime(): void {
    // Import console.log equivalent
    this.module.imports.push({
      module: 'env',
      name: 'log',
      kind: 'function',
      type: { params: [WASMType.I32], results: [] },
    });

    // Import trap function
    this.module.imports.push({
      module: 'env',
      name: 'trap',
      kind: 'function',
      type: { params: [WASMType.I32], results: [] },
    });

    // Memory allocation function
    const allocFunc: WASMFunction = {
      name: '$alloc',
      params: [{ name: 'size', type: WASMType.I32 }],
      results: [WASMType.I32],
      locals: [],
      body: [
        // Simple bump allocator
        { opcode: WASMOpcode.GlobalGet, operands: ['$heap_ptr'] },
        { opcode: WASMOpcode.LocalGet, operands: ['$size'] },
        { opcode: WASMOpcode.GlobalGet, operands: ['$heap_ptr'] },
        { opcode: WASMOpcode.I32Add, operands: [] },
        { opcode: WASMOpcode.GlobalSet, operands: ['$heap_ptr'] },
        { opcode: WASMOpcode.Return, operands: [] },
      ],
      export: true,
    };
    this.module.functions.push(allocFunc);

    // Heap pointer global
    this.module.globals.push({
      name: '$heap_ptr',
      type: WASMType.I32,
      mutable: true,
      init: 65536, // Start heap at 64KB
    });
  }

  /**
   * Create empty module
   */
  private createEmptyModule(): WASMModule {
    return {
      name: 'isl_module',
      memories: [{
        name: 'memory',
        initial: this.options.memoryPages,
        maximum: this.options.maxMemoryPages,
        shared: this.options.threads,
      }],
      tables: [{
        name: 'table',
        type: 'funcref',
        initial: 0,
      }],
      globals: [],
      functions: [],
      exports: [{
        name: 'memory',
        kind: 'memory',
        index: 0,
      }],
      imports: [],
      data: [],
    };
  }

  /**
   * Compile module to binary
   */
  private compile(): CompiledWASM {
    const wat = this.generateWAT();

    // In production, use binaryen or wabt to compile to binary
    // For now, return the WAT representation
    const wasm = new Uint8Array(0); // Placeholder

    return {
      wasm,
      wat,
      exports: this.module.exports.map((e) => e.name),
      imports: this.module.imports.map((i) => `${i.module}.${i.name}`),
    };
  }

  /**
   * Generate WAT (WebAssembly Text) format
   */
  private generateWAT(): string {
    const lines: string[] = [];
    lines.push(`(module`);

    // Memory
    for (const memory of this.module.memories) {
      const max = memory.maximum ? ` ${memory.maximum}` : '';
      const shared = memory.shared ? ' shared' : '';
      lines.push(`  (memory (export "${memory.name}") ${memory.initial}${max}${shared})`);
    }

    // Imports
    for (const imp of this.module.imports) {
      if (imp.kind === 'function' && imp.type) {
        const params = imp.type.params.map((p) => `(param ${p})`).join(' ');
        const results = imp.type.results.map((r) => `(result ${r})`).join(' ');
        lines.push(`  (import "${imp.module}" "${imp.name}" (func $${imp.name} ${params} ${results}))`);
      }
    }

    // Globals
    for (const global of this.module.globals) {
      const mut = global.mutable ? `(mut ${global.type})` : global.type;
      lines.push(`  (global ${global.name} ${mut} (${global.type}.const ${global.init}))`);
    }

    // Functions
    for (const func of this.module.functions) {
      const params = func.params.map((p) => `(param $${p.name} ${p.type})`).join(' ');
      const results = func.results.map((r) => `(result ${r})`).join(' ');
      const locals = func.locals.map((l) => `(local $${l.name} ${l.type})`).join(' ');

      lines.push(`  (func $${func.name} ${params} ${results}`);
      if (locals) lines.push(`    ${locals}`);

      for (const inst of func.body) {
        const operands = inst.operands
          .map((o) => (typeof o === 'string' ? o : String(o)))
          .join(' ');
        lines.push(`    (${inst.opcode}${operands ? ' ' + operands : ''})`);
      }

      lines.push(`  )`);

      if (func.export) {
        lines.push(`  (export "${func.name}" (func $${func.name}))`);
      }
    }

    // Data segments
    for (const data of this.module.data) {
      const bytes = typeof data.data === 'string'
        ? data.data
        : Array.from(data.data).map((b) => `\\${b.toString(16).padStart(2, '0')}`).join('');
      lines.push(`  (data (i32.const ${data.offset}) "${bytes}")`);
    }

    lines.push(`)`);
    return lines.join('\n');
  }
}

/**
 * Create WASM generator
 */
export function createWASMGenerator(options?: Partial<WASMGeneratorOptions>): WASMGenerator {
  return new WASMGenerator(options);
}
