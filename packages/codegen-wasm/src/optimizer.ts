// ============================================================================
// WebAssembly Module Optimizer
// Optimizes WAT/WASM for size and performance
// ============================================================================

import type { WasmModule, WasmFunction, WasmInstruction } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type OptimizationLevel = 'none' | 'size' | 'speed' | 'balanced';

export interface OptimizationOptions {
  level: OptimizationLevel;
  inlineThreshold?: number;
  deadCodeElimination?: boolean;
  constantFolding?: boolean;
  localOptimization?: boolean;
  stackOptimization?: boolean;
}

export interface OptimizationResult {
  module: WasmModule;
  stats: OptimizationStats;
}

export interface OptimizationStats {
  originalInstructions: number;
  optimizedInstructions: number;
  removedFunctions: number;
  inlinedCalls: number;
  foldedConstants: number;
  reductionPercent: number;
}

// ============================================================================
// MAIN OPTIMIZER
// ============================================================================

/**
 * Optimize a WebAssembly module
 */
export function optimizeModule(
  module: WasmModule,
  options: OptimizationOptions = { level: 'balanced' }
): OptimizationResult {
  const stats: OptimizationStats = {
    originalInstructions: countInstructions(module),
    optimizedInstructions: 0,
    removedFunctions: 0,
    inlinedCalls: 0,
    foldedConstants: 0,
    reductionPercent: 0,
  };

  let optimized = { ...module };

  if (options.level === 'none') {
    stats.optimizedInstructions = stats.originalInstructions;
    return { module: optimized, stats };
  }

  // Apply optimizations based on level
  if (options.deadCodeElimination !== false) {
    const result = eliminateDeadCode(optimized);
    optimized = result.module;
    stats.removedFunctions += result.removedCount;
  }

  if (options.constantFolding !== false) {
    const result = foldConstants(optimized);
    optimized = result.module;
    stats.foldedConstants += result.foldedCount;
  }

  if (options.localOptimization !== false) {
    optimized = optimizeLocals(optimized);
  }

  if (options.stackOptimization !== false) {
    optimized = optimizeStack(optimized);
  }

  if (options.level === 'speed' || options.level === 'balanced') {
    const threshold = options.inlineThreshold ?? 10;
    const result = inlineSmallFunctions(optimized, threshold);
    optimized = result.module;
    stats.inlinedCalls += result.inlinedCount;
  }

  // Peephole optimizations
  optimized = peepholeOptimize(optimized);

  stats.optimizedInstructions = countInstructions(optimized);
  stats.reductionPercent = Math.round(
    (1 - stats.optimizedInstructions / stats.originalInstructions) * 100
  );

  return { module: optimized, stats };
}

// ============================================================================
// DEAD CODE ELIMINATION
// ============================================================================

function eliminateDeadCode(module: WasmModule): { module: WasmModule; removedCount: number } {
  const usedFunctions = new Set<string>();
  const usedGlobals = new Set<number>();

  // Mark exported functions as used
  for (const exp of module.exports) {
    if (exp.kind === 'func') {
      const func = module.functions[exp.index];
      if (func) {
        usedFunctions.add(func.name);
      }
    }
  }

  // Mark start function as used
  if (module.start !== undefined) {
    const startFunc = module.functions[module.start];
    if (startFunc) {
      usedFunctions.add(startFunc.name);
    }
  }

  // Propagate usage through call graph
  let changed = true;
  while (changed) {
    changed = false;
    for (const func of module.functions) {
      if (!usedFunctions.has(func.name)) continue;
      
      for (const instr of func.body) {
        if (instr.op === 'call' && typeof instr.func === 'string') {
          if (!usedFunctions.has(instr.func)) {
            usedFunctions.add(instr.func);
            changed = true;
          }
        }
        if (instr.op === 'global.get' || instr.op === 'global.set') {
          usedGlobals.add(instr.index);
        }
      }
    }
  }

  const originalCount = module.functions.length;
  const filteredFunctions = module.functions.filter(f => usedFunctions.has(f.name));
  const filteredGlobals = module.globals.filter((_, i) => usedGlobals.has(i));

  return {
    module: {
      ...module,
      functions: filteredFunctions,
      globals: filteredGlobals,
    },
    removedCount: originalCount - filteredFunctions.length,
  };
}

// ============================================================================
// CONSTANT FOLDING
// ============================================================================

function foldConstants(module: WasmModule): { module: WasmModule; foldedCount: number } {
  let foldedCount = 0;

  const optimizedFunctions = module.functions.map(func => {
    const optimizedBody: WasmInstruction[] = [];
    
    for (let i = 0; i < func.body.length; i++) {
      const curr = func.body[i];
      const prev = optimizedBody[optimizedBody.length - 1];
      const prev2 = optimizedBody[optimizedBody.length - 2];

      // Fold i32.const + i32.const + i32.add
      if (
        curr.op === 'i32.add' &&
        prev?.op === 'i32.const' &&
        prev2?.op === 'i32.const'
      ) {
        optimizedBody.pop();
        optimizedBody.pop();
        optimizedBody.push({
          op: 'i32.const',
          value: prev2.value + prev.value,
        });
        foldedCount++;
        continue;
      }

      // Fold i32.const + i32.const + i32.mul
      if (
        curr.op === 'i32.mul' &&
        prev?.op === 'i32.const' &&
        prev2?.op === 'i32.const'
      ) {
        optimizedBody.pop();
        optimizedBody.pop();
        optimizedBody.push({
          op: 'i32.const',
          value: prev2.value * prev.value,
        });
        foldedCount++;
        continue;
      }

      // Fold i32.const 0 + i32.add (identity)
      if (curr.op === 'i32.add' && prev?.op === 'i32.const' && prev.value === 0) {
        optimizedBody.pop();
        foldedCount++;
        continue;
      }

      // Fold i32.const 1 + i32.mul (identity)
      if (curr.op === 'i32.mul' && prev?.op === 'i32.const' && prev.value === 1) {
        optimizedBody.pop();
        foldedCount++;
        continue;
      }

      // Fold i32.const 0 + i32.mul (zero)
      if (curr.op === 'i32.mul' && prev?.op === 'i32.const' && prev.value === 0) {
        optimizedBody.pop();
        optimizedBody.push({ op: 'drop' });
        optimizedBody.push({ op: 'i32.const', value: 0 });
        foldedCount++;
        continue;
      }

      optimizedBody.push(curr);
    }

    return { ...func, body: optimizedBody };
  });

  return {
    module: { ...module, functions: optimizedFunctions },
    foldedCount,
  };
}

// ============================================================================
// LOCAL VARIABLE OPTIMIZATION
// ============================================================================

function optimizeLocals(module: WasmModule): WasmModule {
  const optimizedFunctions = module.functions.map(func => {
    // Track local usage
    const localUsage = new Map<number, { reads: number; writes: number }>();
    
    for (const instr of func.body) {
      if (instr.op === 'local.get') {
        const usage = localUsage.get(instr.index) ?? { reads: 0, writes: 0 };
        usage.reads++;
        localUsage.set(instr.index, usage);
      }
      if (instr.op === 'local.set' || instr.op === 'local.tee') {
        const usage = localUsage.get(instr.index) ?? { reads: 0, writes: 0 };
        usage.writes++;
        localUsage.set(instr.index, usage);
      }
    }

    // Remove unused local.set where local is never read
    const optimizedBody = func.body.filter((instr, i) => {
      if (instr.op === 'local.set') {
        const usage = localUsage.get(instr.index);
        if (usage && usage.reads === 0) {
          // Replace with drop
          return false;
        }
      }
      return true;
    });

    return { ...func, body: optimizedBody };
  });

  return { ...module, functions: optimizedFunctions };
}

// ============================================================================
// STACK OPTIMIZATION
// ============================================================================

function optimizeStack(module: WasmModule): WasmModule {
  const optimizedFunctions = module.functions.map(func => {
    const optimizedBody: WasmInstruction[] = [];
    
    for (let i = 0; i < func.body.length; i++) {
      const curr = func.body[i];
      const prev = optimizedBody[optimizedBody.length - 1];

      // Remove push followed by drop
      if (curr.op === 'drop' && prev && isConstantOrLoad(prev)) {
        optimizedBody.pop();
        continue;
      }

      // local.set followed by local.get of same local -> local.tee
      if (
        curr.op === 'local.get' &&
        prev?.op === 'local.set' &&
        curr.index === prev.index
      ) {
        optimizedBody.pop();
        optimizedBody.push({ op: 'local.tee', index: curr.index });
        continue;
      }

      optimizedBody.push(curr);
    }

    return { ...func, body: optimizedBody };
  });

  return { ...module, functions: optimizedFunctions };
}

function isConstantOrLoad(instr: WasmInstruction): boolean {
  return (
    instr.op === 'i32.const' ||
    instr.op === 'i64.const' ||
    instr.op === 'f32.const' ||
    instr.op === 'f64.const' ||
    instr.op === 'local.get' ||
    instr.op === 'global.get'
  );
}

// ============================================================================
// FUNCTION INLINING
// ============================================================================

function inlineSmallFunctions(
  module: WasmModule,
  threshold: number
): { module: WasmModule; inlinedCount: number } {
  // Find small functions that can be inlined
  const inlineableFunctions = new Map<string, WasmFunction>();
  
  for (const func of module.functions) {
    if (func.body.length <= threshold && !func.export) {
      inlineableFunctions.set(func.name, func);
    }
  }

  let inlinedCount = 0;

  const optimizedFunctions = module.functions.map(func => {
    const optimizedBody: WasmInstruction[] = [];
    
    for (const instr of func.body) {
      if (instr.op === 'call' && typeof instr.func === 'string') {
        const target = inlineableFunctions.get(instr.func);
        if (target && target.type.params.length === 0) {
          // Inline the function body
          optimizedBody.push(...target.body.filter(i => i.op !== 'return'));
          inlinedCount++;
          continue;
        }
      }
      optimizedBody.push(instr);
    }

    return { ...func, body: optimizedBody };
  });

  return {
    module: { ...module, functions: optimizedFunctions },
    inlinedCount,
  };
}

// ============================================================================
// PEEPHOLE OPTIMIZATION
// ============================================================================

function peepholeOptimize(module: WasmModule): WasmModule {
  const optimizedFunctions = module.functions.map(func => {
    let optimizedBody = [...func.body];
    let changed = true;

    while (changed) {
      changed = false;
      const newBody: WasmInstruction[] = [];

      for (let i = 0; i < optimizedBody.length; i++) {
        const curr = optimizedBody[i];
        const next = optimizedBody[i + 1];

        // Remove nop
        if (curr.op === 'nop') {
          changed = true;
          continue;
        }

        // Remove unreachable code after return
        if (curr.op === 'return' || curr.op === 'unreachable') {
          newBody.push(curr);
          // Skip until end or block/loop
          while (
            i + 1 < optimizedBody.length &&
            !['end', 'else', 'block', 'loop'].includes(optimizedBody[i + 1].op)
          ) {
            i++;
            changed = true;
          }
          continue;
        }

        // i32.eqz followed by i32.eqz = identity
        if (curr.op === 'i32.eqz' && next?.op === 'i32.eqz') {
          i++;
          changed = true;
          continue;
        }

        newBody.push(curr);
      }

      optimizedBody = newBody;
    }

    return { ...func, body: optimizedBody };
  });

  return { ...module, functions: optimizedFunctions };
}

// ============================================================================
// HELPERS
// ============================================================================

function countInstructions(module: WasmModule): number {
  let count = 0;
  for (const func of module.functions) {
    count += func.body.length;
  }
  return count;
}

/**
 * Get optimization statistics as a human-readable string
 */
export function formatOptimizationStats(stats: OptimizationStats): string {
  return `
Optimization Results:
  Instructions: ${stats.originalInstructions} → ${stats.optimizedInstructions} (${stats.reductionPercent}% reduction)
  Functions removed: ${stats.removedFunctions}
  Calls inlined: ${stats.inlinedCalls}
  Constants folded: ${stats.foldedConstants}
`.trim();
}
