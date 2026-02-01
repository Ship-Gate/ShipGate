/**
 * WASM Optimization Passes
 * Optimizations for ISL-generated WASM
 */

import { WASMModule, WASMFunction, WASMInstruction, WASMOpcode } from './types';

/**
 * Optimization level
 */
export type OptimizationLevel = 0 | 1 | 2 | 3;

/**
 * Optimization pass
 */
export interface OptimizationPass {
  name: string;
  description: string;
  minLevel: OptimizationLevel;
  apply(module: WASMModule): WASMModule;
}

/**
 * Dead code elimination
 */
export const DeadCodeElimination: OptimizationPass = {
  name: 'dead-code-elimination',
  description: 'Remove unreachable code',
  minLevel: 1,
  apply(module: WASMModule): WASMModule {
    return {
      ...module,
      functions: module.functions.map((fn) => ({
        ...fn,
        body: eliminateDeadCode(fn.body),
      })),
    };
  },
};

function eliminateDeadCode(body: WASMInstruction[]): WASMInstruction[] {
  const result: WASMInstruction[] = [];
  let unreachable = false;

  for (const inst of body) {
    if (unreachable) {
      // Skip until we hit a label or block end
      if (inst.opcode === WASMOpcode.End || inst.opcode === WASMOpcode.Else) {
        unreachable = false;
        result.push(inst);
      }
      continue;
    }

    result.push(inst);

    if (
      inst.opcode === WASMOpcode.Unreachable ||
      inst.opcode === WASMOpcode.Return ||
      inst.opcode === WASMOpcode.Br
    ) {
      unreachable = true;
    }
  }

  return result;
}

/**
 * Constant folding
 */
export const ConstantFolding: OptimizationPass = {
  name: 'constant-folding',
  description: 'Evaluate constant expressions at compile time',
  minLevel: 1,
  apply(module: WASMModule): WASMModule {
    return {
      ...module,
      functions: module.functions.map((fn) => ({
        ...fn,
        body: foldConstants(fn.body),
      })),
    };
  },
};

function foldConstants(body: WASMInstruction[]): WASMInstruction[] {
  const result: WASMInstruction[] = [];
  const stack: number[] = [];

  for (let i = 0; i < body.length; i++) {
    const inst = body[i]!;

    if (inst.opcode === WASMOpcode.I32Const) {
      stack.push(inst.operands[0] as number);
      result.push(inst);
      continue;
    }

    // Try to fold binary operations
    if (stack.length >= 2) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      let folded = false;
      let foldedValue = 0;

      switch (inst.opcode) {
        case WASMOpcode.I32Add:
          foldedValue = (a + b) | 0;
          folded = true;
          break;
        case WASMOpcode.I32Sub:
          foldedValue = (a - b) | 0;
          folded = true;
          break;
        case WASMOpcode.I32Mul:
          foldedValue = Math.imul(a, b);
          folded = true;
          break;
        case WASMOpcode.I32And:
          foldedValue = a & b;
          folded = true;
          break;
        case WASMOpcode.I32Or:
          foldedValue = a | b;
          folded = true;
          break;
        case WASMOpcode.I32Xor:
          foldedValue = a ^ b;
          folded = true;
          break;
      }

      if (folded) {
        // Remove the two const pushes and replace with folded value
        result.pop();
        result.pop();
        result.push({ opcode: WASMOpcode.I32Const, operands: [foldedValue] });
        stack.push(foldedValue);
        continue;
      } else {
        // Put values back
        stack.push(a);
        stack.push(b);
      }
    }

    // Reset stack tracking on control flow
    if (
      inst.opcode === WASMOpcode.If ||
      inst.opcode === WASMOpcode.Block ||
      inst.opcode === WASMOpcode.Loop ||
      inst.opcode === WASMOpcode.Call
    ) {
      stack.length = 0;
    }

    result.push(inst);
  }

  return result;
}

/**
 * Local variable coalescing
 */
export const LocalCoalescing: OptimizationPass = {
  name: 'local-coalescing',
  description: 'Merge local variables with non-overlapping lifetimes',
  minLevel: 2,
  apply(module: WASMModule): WASMModule {
    // This would require liveness analysis
    // Simplified version just removes unused locals
    return {
      ...module,
      functions: module.functions.map((fn) => {
        const usedLocals = new Set<string>();

        for (const inst of fn.body) {
          if (
            inst.opcode === WASMOpcode.LocalGet ||
            inst.opcode === WASMOpcode.LocalSet ||
            inst.opcode === WASMOpcode.LocalTee
          ) {
            usedLocals.add(inst.operands[0] as string);
          }
        }

        return {
          ...fn,
          locals: fn.locals.filter((local) => usedLocals.has(`$${local.name}`)),
        };
      }),
    };
  },
};

/**
 * Stack to local optimization
 */
export const StackToLocal: OptimizationPass = {
  name: 'stack-to-local',
  description: 'Convert stack operations to local variable operations for better performance',
  minLevel: 2,
  apply(module: WASMModule): WASMModule {
    // This optimization would convert patterns like:
    // i32.const 5
    // i32.const 10
    // i32.add
    // to use locals for complex expressions
    return module;
  },
};

/**
 * Inline small functions
 */
export const FunctionInlining: OptimizationPass = {
  name: 'function-inlining',
  description: 'Inline small functions at call sites',
  minLevel: 3,
  apply(module: WASMModule): WASMModule {
    const smallFunctions = new Map<string, WASMFunction>();

    // Find small functions (< 10 instructions)
    for (const fn of module.functions) {
      if (fn.body.length < 10 && !fn.export) {
        smallFunctions.set(`$${fn.name}`, fn);
      }
    }

    // Inline at call sites
    return {
      ...module,
      functions: module.functions.map((fn) => ({
        ...fn,
        body: inlineCalls(fn.body, smallFunctions),
      })),
    };
  },
};

function inlineCalls(
  body: WASMInstruction[],
  smallFunctions: Map<string, WASMFunction>
): WASMInstruction[] {
  const result: WASMInstruction[] = [];

  for (const inst of body) {
    if (inst.opcode === WASMOpcode.Call) {
      const funcName = inst.operands[0] as string;
      const inlineTarget = smallFunctions.get(funcName);

      if (inlineTarget) {
        // Inline the function body
        result.push(...inlineTarget.body.filter((i) => i.opcode !== WASMOpcode.Return));
        continue;
      }
    }

    result.push(inst);
  }

  return result;
}

/**
 * All optimization passes
 */
export const AllPasses: OptimizationPass[] = [
  DeadCodeElimination,
  ConstantFolding,
  LocalCoalescing,
  StackToLocal,
  FunctionInlining,
];

/**
 * Apply optimizations to a module
 */
export function optimize(
  module: WASMModule,
  level: OptimizationLevel = 2
): WASMModule {
  let optimized = module;

  for (const pass of AllPasses) {
    if (pass.minLevel <= level) {
      optimized = pass.apply(optimized);
    }
  }

  return optimized;
}

/**
 * Optimization statistics
 */
export interface OptimizationStats {
  originalInstructions: number;
  optimizedInstructions: number;
  removedInstructions: number;
  inlinedFunctions: number;
  foldedConstants: number;
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats(
  original: WASMModule,
  optimized: WASMModule
): OptimizationStats {
  const countInstructions = (mod: WASMModule) =>
    mod.functions.reduce((sum, fn) => sum + fn.body.length, 0);

  const originalCount = countInstructions(original);
  const optimizedCount = countInstructions(optimized);

  return {
    originalInstructions: originalCount,
    optimizedInstructions: optimizedCount,
    removedInstructions: originalCount - optimizedCount,
    inlinedFunctions: 0, // Would need to track during optimization
    foldedConstants: 0, // Would need to track during optimization
  };
}
