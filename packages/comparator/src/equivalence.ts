/**
 * Behavioral Equivalence
 * 
 * Determines if multiple implementations produce equivalent outputs
 * for the same inputs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Category of difference between implementations */
export type DifferenceCategory = 'semantic' | 'timing' | 'error_handling' | 'precision';

/** Severity of the difference */
export type DifferenceSeverity = 'critical' | 'warning' | 'info';

/** A single difference found between implementations */
export interface Difference {
  /** The input that caused the difference */
  input: unknown;
  /** Map of implementation name to its output */
  outputs: Map<string, unknown>;
  /** Category of the difference */
  category: DifferenceCategory;
  /** Severity of the difference */
  severity: DifferenceSeverity;
  /** Human-readable description */
  description: string;
  /** Path to the differing value (for nested objects) */
  path?: string;
}

/** Result of equivalence checking */
export interface EquivalenceResult {
  /** Whether all implementations are equivalent */
  equivalent: boolean;
  /** List of differences found */
  differences: Difference[];
  /** Number of inputs tested */
  inputsCovered: number;
  /** Number of inputs that produced equivalent results */
  inputsMatched: number;
  /** Equivalence percentage */
  equivalenceRate: number;
  /** Implementations grouped by behavior */
  behaviorGroups: BehaviorGroup[];
}

/** Group of implementations that behave identically */
export interface BehaviorGroup {
  /** Names of implementations in this group */
  implementations: string[];
  /** Sample output for this group */
  sampleOutput: unknown;
  /** Number of inputs matching this behavior */
  matchCount: number;
}

/** Options for equivalence checking */
export interface EquivalenceOptions {
  /** Tolerance for floating point comparison */
  floatTolerance?: number;
  /** Whether to compare error messages exactly */
  strictErrorMessages?: boolean;
  /** Ignore timing-related differences */
  ignoreTiming?: boolean;
  /** Maximum differences to collect before stopping */
  maxDifferences?: number;
  /** Custom comparator function */
  customComparator?: (a: unknown, b: unknown) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep Equality
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if two values are deeply equal with options
 */
export function deepEqual(
  a: unknown,
  b: unknown,
  options: EquivalenceOptions = {},
  path = ''
): { equal: boolean; diffPath?: string; diffDescription?: string } {
  // Handle null/undefined
  if (a === null && b === null) return { equal: true };
  if (a === undefined && b === undefined) return { equal: true };
  if (a === null || b === null || a === undefined || b === undefined) {
    return {
      equal: false,
      diffPath: path || 'root',
      diffDescription: `One value is ${a === null || a === undefined ? 'null/undefined' : 'defined'}, other is ${b === null || b === undefined ? 'null/undefined' : 'defined'}`,
    };
  }

  // Custom comparator
  if (options.customComparator) {
    return { equal: options.customComparator(a, b) };
  }

  // Primitive types
  if (typeof a !== typeof b) {
    return {
      equal: false,
      diffPath: path || 'root',
      diffDescription: `Type mismatch: ${typeof a} vs ${typeof b}`,
    };
  }

  // Numbers (with tolerance)
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return { equal: true };
    const tolerance = options.floatTolerance ?? 0;
    const equal = Math.abs(a - b) <= tolerance;
    if (!equal) {
      return {
        equal: false,
        diffPath: path || 'root',
        diffDescription: `Number difference: ${a} vs ${b} (tolerance: ${tolerance})`,
      };
    }
    return { equal: true };
  }

  // Strings
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return { equal: true };
    return {
      equal: false,
      diffPath: path || 'root',
      diffDescription: `String difference: "${a.slice(0, 50)}" vs "${b.slice(0, 50)}"`,
    };
  }

  // Booleans
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return { equal: true };
    return {
      equal: false,
      diffPath: path || 'root',
      diffDescription: `Boolean difference: ${a} vs ${b}`,
    };
  }

  // Dates
  if (a instanceof Date && b instanceof Date) {
    if (options.ignoreTiming) return { equal: true };
    if (a.getTime() === b.getTime()) return { equal: true };
    return {
      equal: false,
      diffPath: path || 'root',
      diffDescription: `Date difference: ${a.toISOString()} vs ${b.toISOString()}`,
    };
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return {
        equal: false,
        diffPath: path || 'root',
        diffDescription: `Array length difference: ${a.length} vs ${b.length}`,
      };
    }
    for (let i = 0; i < a.length; i++) {
      const result = deepEqual(a[i], b[i], options, `${path}[${i}]`);
      if (!result.equal) return result;
    }
    return { equal: true };
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    
    if (aKeys.length !== bKeys.length) {
      return {
        equal: false,
        diffPath: path || 'root',
        diffDescription: `Object key count difference: ${aKeys.length} vs ${bKeys.length}`,
      };
    }

    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) {
        return {
          equal: false,
          diffPath: path || 'root',
          diffDescription: `Object key mismatch: "${aKeys[i]}" vs "${bKeys[i]}"`,
        };
      }
      
      const key = aKeys[i];
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const result = deepEqual(aObj[key], bObj[key], options, path ? `${path}.${key}` : key);
      if (!result.equal) return result;
    }
    return { equal: true };
  }

  // Functions (compare by string representation)
  if (typeof a === 'function' && typeof b === 'function') {
    return { equal: a.toString() === b.toString() };
  }

  return { equal: a === b };
}

// ─────────────────────────────────────────────────────────────────────────────
// Equivalence Checking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execution result from a single implementation
 */
export interface ExecutionResult {
  output?: unknown;
  error?: Error;
  duration: number;
}

/**
 * Check equivalence of outputs from multiple implementations
 */
export function checkEquivalence(
  implNames: string[],
  results: Map<string, ExecutionResult>,
  input: unknown,
  options: EquivalenceOptions = {}
): Difference | null {
  if (implNames.length < 2) return null;

  const outputs = new Map<string, unknown>();
  const errors = new Map<string, Error>();

  // Separate successful outputs from errors
  for (const name of implNames) {
    const result = results.get(name);
    if (!result) continue;

    if (result.error) {
      errors.set(name, result.error);
    } else {
      outputs.set(name, result.output);
    }
  }

  // Check if some succeeded and some failed
  if (outputs.size > 0 && errors.size > 0) {
    const outputMap = new Map<string, unknown>();
    for (const [name, output] of outputs) {
      outputMap.set(name, output);
    }
    for (const [name, error] of errors) {
      outputMap.set(name, { error: error.message });
    }

    return {
      input,
      outputs: outputMap,
      category: 'error_handling',
      severity: 'critical',
      description: `Some implementations succeeded while others threw errors`,
    };
  }

  // All errored - check if errors are equivalent
  if (errors.size === implNames.length) {
    if (options.strictErrorMessages) {
      const errorMessages = Array.from(errors.values()).map(e => e.message);
      const allSame = errorMessages.every(m => m === errorMessages[0]);
      
      if (!allSame) {
        const outputMap = new Map<string, unknown>();
        for (const [name, error] of errors) {
          outputMap.set(name, { error: error.message });
        }

        return {
          input,
          outputs: outputMap,
          category: 'error_handling',
          severity: 'warning',
          description: 'Error messages differ between implementations',
        };
      }
    }
    return null; // All failed with equivalent errors
  }

  // All succeeded - compare outputs
  const outputArray = Array.from(outputs.entries());
  const [firstName, firstOutput] = outputArray[0];

  for (let i = 1; i < outputArray.length; i++) {
    const [name, output] = outputArray[i];
    const comparison = deepEqual(firstOutput, output, options);

    if (!comparison.equal) {
      const outputMap = new Map<string, unknown>();
      for (const [n, o] of outputs) {
        outputMap.set(n, o);
      }

      // Determine severity based on difference type
      let severity: DifferenceSeverity = 'critical';
      let category: DifferenceCategory = 'semantic';

      if (comparison.diffPath?.includes('timestamp') || comparison.diffPath?.includes('time')) {
        if (options.ignoreTiming) continue;
        severity = 'info';
        category = 'timing';
      } else if (comparison.diffDescription?.includes('Number difference')) {
        severity = 'warning';
        category = 'precision';
      }

      return {
        input,
        outputs: outputMap,
        category,
        severity,
        description: comparison.diffDescription ?? `Outputs differ at ${comparison.diffPath}`,
        path: comparison.diffPath,
      };
    }
  }

  return null;
}

/**
 * Run equivalence check across multiple inputs
 */
export function checkAllEquivalence(
  implNames: string[],
  allResults: Array<{ input: unknown; results: Map<string, ExecutionResult> }>,
  options: EquivalenceOptions = {}
): EquivalenceResult {
  const differences: Difference[] = [];
  let inputsMatched = 0;
  const maxDifferences = options.maxDifferences ?? 100;

  // Track behavior groups
  const behaviorSignatures = new Map<string, { impls: Set<string>; count: number; sample: unknown }>();

  for (const { input, results } of allResults) {
    const diff = checkEquivalence(implNames, results, input, options);
    
    if (diff) {
      if (differences.length < maxDifferences) {
        differences.push(diff);
      }
    } else {
      inputsMatched++;
    }

    // Track behavior signature
    const signature = createBehaviorSignature(results);
    const existing = behaviorSignatures.get(signature);
    if (existing) {
      existing.count++;
    } else {
      const firstResult = results.get(implNames[0]);
      behaviorSignatures.set(signature, {
        impls: new Set(implNames),
        count: 1,
        sample: firstResult?.output,
      });
    }
  }

  // Build behavior groups
  const behaviorGroups: BehaviorGroup[] = Array.from(behaviorSignatures.values()).map(v => ({
    implementations: Array.from(v.impls),
    sampleOutput: v.sample,
    matchCount: v.count,
  }));

  const inputsCovered = allResults.length;
  const equivalenceRate = inputsCovered > 0 ? (inputsMatched / inputsCovered) * 100 : 100;

  return {
    equivalent: differences.length === 0,
    differences,
    inputsCovered,
    inputsMatched,
    equivalenceRate,
    behaviorGroups,
  };
}

/**
 * Create a signature for a set of results to group similar behaviors
 */
function createBehaviorSignature(results: Map<string, ExecutionResult>): string {
  const outputs: string[] = [];
  for (const [name, result] of results) {
    if (result.error) {
      outputs.push(`${name}:error`);
    } else {
      outputs.push(`${name}:${JSON.stringify(result.output)}`);
    }
  }
  return outputs.sort().join('|');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { deepEqual as isDeepEqual };
