/**
 * JIT Compiler for ISL Bytecode
 * Compiles hot paths to native JavaScript for improved performance
 */

import { BytecodeProgram, Instruction, Opcode } from './bytecode';

/**
 * JIT compilation options
 */
export interface JITOptions {
  /** Threshold for hot path detection */
  hotThreshold: number;
  /** Enable optimization passes */
  optimize: boolean;
  /** Cache compiled functions */
  cacheEnabled: boolean;
  /** Maximum cache size */
  maxCacheSize: number;
}

/**
 * Compiled function type
 */
type CompiledFunction = (...args: unknown[]) => unknown;

/**
 * JIT Compiler
 */
export class JITCompiler {
  private options: JITOptions;
  private cache: Map<string, CompiledFunction> = new Map();
  private executionCounts: Map<number, number> = new Map();

  constructor(options: Partial<JITOptions> = {}) {
    this.options = {
      hotThreshold: 100,
      optimize: true,
      cacheEnabled: true,
      maxCacheSize: 1000,
      ...options,
    };
  }

  /**
   * Check if a function should be JIT compiled
   */
  shouldCompile(address: number): boolean {
    const count = this.executionCounts.get(address) ?? 0;
    this.executionCounts.set(address, count + 1);
    return count >= this.options.hotThreshold;
  }

  /**
   * Compile a bytecode segment to JavaScript
   */
  compile(
    program: BytecodeProgram,
    startAddress: number,
    endAddress: number
  ): CompiledFunction {
    const cacheKey = `${program.name}:${startAddress}:${endAddress}`;

    // Check cache
    if (this.options.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Extract instructions
    const instructions = program.instructions.slice(startAddress, endAddress);

    // Generate JavaScript code
    let code = this.generateCode(instructions, program);

    // Optimize if enabled
    if (this.options.optimize) {
      code = this.optimize(code);
    }

    // Compile to function
    const fn = this.createFunction(code);

    // Cache if enabled
    if (this.options.cacheEnabled) {
      this.cacheFunction(cacheKey, fn);
    }

    return fn;
  }

  /**
   * Generate JavaScript code from bytecode
   */
  private generateCode(instructions: Instruction[], program: BytecodeProgram): string {
    const lines: string[] = [];
    lines.push('"use strict";');
    lines.push('const stack = [];');
    lines.push('const locals = new Map(Object.entries(args));');

    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i]!;
      const jsCode = this.instructionToJS(inst, i, program);
      if (jsCode) {
        lines.push(jsCode);
      }
    }

    lines.push('return stack.pop();');
    return lines.join('\n');
  }

  /**
   * Convert a single instruction to JavaScript
   */
  private instructionToJS(inst: Instruction, _index: number, _program: BytecodeProgram): string {
    switch (inst.opcode) {
      // Stack operations
      case Opcode.PUSH:
        return `stack.push(${JSON.stringify(inst.operands[0])});`;
      case Opcode.POP:
        return 'stack.pop();';
      case Opcode.DUP:
        return 'stack.push(stack[stack.length - 1]);';
      case Opcode.SWAP:
        return '[stack[stack.length - 1], stack[stack.length - 2]] = [stack[stack.length - 2], stack[stack.length - 1]];';

      // Arithmetic
      case Opcode.ADD:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a + b); }';
      case Opcode.SUB:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a - b); }';
      case Opcode.MUL:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a * b); }';
      case Opcode.DIV:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a / b); }';
      case Opcode.MOD:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a % b); }';
      case Opcode.NEG:
        return 'stack.push(-stack.pop());';

      // Comparison
      case Opcode.EQ:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a === b); }';
      case Opcode.NE:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a !== b); }';
      case Opcode.LT:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a < b); }';
      case Opcode.LE:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a <= b); }';
      case Opcode.GT:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a > b); }';
      case Opcode.GE:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a >= b); }';

      // Logic
      case Opcode.AND:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a && b); }';
      case Opcode.OR:
        return '{ const b = stack.pop(); const a = stack.pop(); stack.push(a || b); }';
      case Opcode.NOT:
        return 'stack.push(!stack.pop());';

      // Variables
      case Opcode.LOAD:
        return `stack.push(locals.get(${JSON.stringify(inst.operands[0])}) ?? globals.get(${JSON.stringify(inst.operands[0])}));`;
      case Opcode.STORE:
        return `locals.set(${JSON.stringify(inst.operands[0])}, stack.pop());`;
      case Opcode.LOAD_GLOBAL:
        return `stack.push(globals.get(${JSON.stringify(inst.operands[0])}));`;
      case Opcode.STORE_GLOBAL:
        return `globals.set(${JSON.stringify(inst.operands[0])}, stack.pop());`;

      // Objects
      case Opcode.GET_PROP:
        return `stack.push(stack.pop()?.[${JSON.stringify(inst.operands[0])}]);`;
      case Opcode.SET_PROP:
        return `{ const val = stack.pop(); const obj = stack.pop(); if (obj) obj[${JSON.stringify(inst.operands[0])}] = val; stack.push(obj); }`;
      case Opcode.NEW_OBJECT:
        return 'stack.push({});';
      case Opcode.NEW_ARRAY:
        return 'stack.push([]);';

      // Control flow - these need special handling
      case Opcode.JMP:
      case Opcode.JMP_IF:
      case Opcode.JMP_IF_NOT:
      case Opcode.CALL:
      case Opcode.RET:
        // Control flow requires interpreter fallback
        return `/* Control flow: ${Opcode[inst.opcode]} - requires interpreter */`;

      // Special
      case Opcode.NOP:
        return '';
      case Opcode.HALT:
        return 'return stack.pop();';

      default:
        return `/* Unknown opcode: ${inst.opcode} */`;
    }
  }

  /**
   * Apply optimization passes
   */
  private optimize(code: string): string {
    let optimized = code;

    // Constant folding
    optimized = this.constantFolding(optimized);

    // Dead code elimination
    optimized = this.deadCodeElimination(optimized);

    // Stack allocation optimization
    optimized = this.stackOptimization(optimized);

    return optimized;
  }

  /**
   * Constant folding optimization
   */
  private constantFolding(code: string): string {
    // Simple constant folding patterns
    return code
      .replace(/stack\.push\((\d+)\);\s*{\s*const\s+b\s*=\s*stack\.pop\(\);\s*const\s+a\s*=\s*stack\.pop\(\);\s*stack\.push\(a\s*\+\s*b\);\s*}/g,
        (_, n) => `/* folded */ { const a = stack.pop(); stack.push(a + ${n}); }`)
      .replace(/stack\.push\(0\);\s*{\s*const\s+b\s*=\s*stack\.pop\(\);\s*const\s+a\s*=\s*stack\.pop\(\);\s*stack\.push\(a\s*\+\s*b\);\s*}/g,
        '/* folded +0 */');
  }

  /**
   * Dead code elimination
   */
  private deadCodeElimination(code: string): string {
    // Remove consecutive push/pop
    return code.replace(
      /stack\.push\([^)]+\);\s*stack\.pop\(\);/g,
      '/* dead code eliminated */'
    );
  }

  /**
   * Stack optimization - convert stack operations to local variables
   */
  private stackOptimization(code: string): string {
    // This is a simplified version - real implementation would do dataflow analysis
    return code;
  }

  /**
   * Create a function from generated code
   */
  private createFunction(code: string): CompiledFunction {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      return new Function('args', 'globals', code) as CompiledFunction;
    } catch (error) {
      throw new Error(`JIT compilation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Cache a compiled function
   */
  private cacheFunction(key: string, fn: CompiledFunction): void {
    if (this.cache.size >= this.options.maxCacheSize) {
      // Simple LRU: remove first entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, fn);
  }

  /**
   * Clear the JIT cache
   */
  clearCache(): void {
    this.cache.clear();
    this.executionCounts.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): JITStats {
    return {
      cacheSize: this.cache.size,
      hotFunctions: Array.from(this.executionCounts.entries())
        .filter(([_, count]) => count >= this.options.hotThreshold)
        .length,
      totalExecutions: Array.from(this.executionCounts.values()).reduce(
        (a, b) => a + b,
        0
      ),
    };
  }
}

/**
 * JIT statistics
 */
export interface JITStats {
  cacheSize: number;
  hotFunctions: number;
  totalExecutions: number;
}

/**
 * Create a JIT compiler
 */
export function createJIT(options?: Partial<JITOptions>): JITCompiler {
  return new JITCompiler(options);
}
