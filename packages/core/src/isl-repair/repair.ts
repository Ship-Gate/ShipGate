/**
 * ISL Repair Engine
 *
 * Deterministic AST repair system that fixes common structural
 * and schema issues in ISL ASTs.
 */

import type { Domain } from '@isl-lang/parser';
import type {
  RepairResult,
  RepairOptions,
  RepairContext,
  RepairCategory,
  RepairConfidence,
  RepairStats,
  ValidationError,
  Repair,
  UnrepairedError,
  RepairStrategy,
} from './types.js';
import { defaultStrategies } from './strategies/index.js';

/**
 * Confidence level ordering for filtering
 */
const CONFIDENCE_ORDER: Record<RepairConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Deep clone an AST to avoid mutating the original
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

/**
 * Generate a unique repair ID
 */
function createIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `repair-${counter.toString().padStart(4, '0')}`;
  };
}

/**
 * Create initial repair statistics
 */
function createEmptyStats(): RepairStats {
  return {
    totalRepairs: 0,
    byCategory: {
      'missing-field': 0,
      'normalize-order': 0,
      'schema-mismatch': 0,
      'invalid-value': 0,
      'duplicate-removal': 0,
      'location-fix': 0,
    },
    byConfidence: {
      high: 0,
      medium: 0,
      low: 0,
    },
    unrepairedCount: 0,
    durationMs: 0,
  };
}

/**
 * Check if a repair passes the confidence filter
 */
function passesConfidenceFilter(
  repair: Repair,
  minConfidence: RepairConfidence
): boolean {
  return CONFIDENCE_ORDER[repair.confidence] >= CONFIDENCE_ORDER[minConfidence];
}

/**
 * Check if a repair passes the category filter
 */
function passesCategoryFilter(
  repair: Repair,
  categories: RepairCategory[] | undefined
): boolean {
  if (!categories || categories.length === 0) return true;
  return categories.includes(repair.category);
}

/**
 * Default repair options
 */
const DEFAULT_OPTIONS: Required<RepairOptions> = {
  minConfidence: 'low',
  categories: [],
  normalizeOrdering: true,
  addOptionalDefaults: false,
  maxRepairs: Infinity,
};

/**
 * Repair an ISL AST by applying deterministic fixes for common issues.
 *
 * This function:
 * 1. Deep clones the input AST (original is never mutated)
 * 2. Applies repair strategies in order
 * 3. Filters repairs based on options
 * 4. Returns repaired AST, repair report, and remaining errors
 *
 * @param ast - The ISL Domain AST to repair
 * @param errors - Validation errors to consider (optional)
 * @param options - Repair options
 * @returns Repair result with fixed AST, repairs made, and remaining errors
 *
 * @example
 * ```typescript
 * import { repairAst } from '@isl-lang/core/isl-repair';
 *
 * const result = repairAst(brokenAst, validationErrors);
 *
 * console.log(`Applied ${result.repairs.length} repairs`);
 * console.log(`${result.remainingErrors.length} errors could not be fixed`);
 *
 * // Use the repaired AST
 * const fixedAst = result.ast;
 * ```
 */
export function repairAst(
  ast: Domain,
  errors: ValidationError[] = [],
  options: RepairOptions = {}
): RepairResult {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Deep clone to avoid mutating the original
  const clonedAst = deepClone(ast);

  // Prepare context
  const allRepairs: Repair[] = [];
  const allUnrepaired: UnrepairedError[] = [];
  const generateId = createIdGenerator();

  // Select strategies based on options
  let strategies = defaultStrategies;

  // If normalizeOrdering is false, exclude the normalize-order strategy
  if (!opts.normalizeOrdering) {
    strategies = strategies.filter((s) => s.name !== 'normalize-order');
  }

  // Apply each strategy
  for (const strategy of strategies) {
    // Check if we've hit the max repairs limit
    if (allRepairs.length >= opts.maxRepairs) {
      break;
    }

    // Check if this strategy's categories are allowed
    if (opts.categories.length > 0) {
      const hasAllowedCategory = strategy.categories.some((cat) =>
        opts.categories.includes(cat)
      );
      if (!hasAllowedCategory) {
        continue;
      }
    }

    const ctx: RepairContext = {
      ast: clonedAst,
      errors,
      repairs: allRepairs,
      currentPath: 'domain',
      generateId,
    };

    const result = strategy.apply(ctx);

    // Filter repairs based on options
    for (const repair of result.repairs) {
      if (allRepairs.length >= opts.maxRepairs) {
        break;
      }

      if (
        passesConfidenceFilter(repair, opts.minConfidence) &&
        passesCategoryFilter(repair, opts.categories.length > 0 ? opts.categories : undefined)
      ) {
        allRepairs.push(repair);
      }
    }

    // Collect unrepaired errors
    allUnrepaired.push(...result.unrepaired);
  }

  // Add any input errors that weren't addressed
  for (const error of errors) {
    const wasAddressed = allRepairs.some(
      (r) => r.relatedErrorCodes?.includes(error.code ?? '') || r.path === error.path
    );

    if (!wasAddressed && error.severity === 'error') {
      allUnrepaired.push({
        code: error.code,
        message: error.message,
        path: error.path ?? 'unknown',
        reason: 'No repair strategy available for this error',
        location: error.location,
      });
    }
  }

  // Calculate statistics
  const stats = createEmptyStats();
  stats.totalRepairs = allRepairs.length;
  stats.unrepairedCount = allUnrepaired.length;
  stats.durationMs = performance.now() - startTime;

  for (const repair of allRepairs) {
    stats.byCategory[repair.category]++;
    stats.byConfidence[repair.confidence]++;
  }

  return {
    ast: clonedAst,
    repairs: allRepairs,
    remainingErrors: allUnrepaired,
    stats,
  };
}

/**
 * Create a custom repair pipeline with specific strategies.
 *
 * @param strategies - Array of repair strategies to use
 * @returns A repair function configured with the custom strategies
 *
 * @example
 * ```typescript
 * import { createRepairPipeline, missingFieldsStrategy } from '@isl-lang/core/isl-repair';
 *
 * // Only use the missing fields strategy
 * const quickRepair = createRepairPipeline([missingFieldsStrategy]);
 *
 * const result = quickRepair(ast, errors);
 * ```
 */
export function createRepairPipeline(
  strategies: RepairStrategy[]
): (ast: Domain, errors?: ValidationError[], options?: RepairOptions) => RepairResult {
  return (ast: Domain, errors: ValidationError[] = [], options: RepairOptions = {}) => {
    const startTime = performance.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const clonedAst = deepClone(ast);
    const allRepairs: Repair[] = [];
    const allUnrepaired: UnrepairedError[] = [];
    const generateId = createIdGenerator();

    for (const strategy of strategies) {
      if (allRepairs.length >= opts.maxRepairs) {
        break;
      }

      const ctx: RepairContext = {
        ast: clonedAst,
        errors,
        repairs: allRepairs,
        currentPath: 'domain',
        generateId,
      };

      const result = strategy.apply(ctx);

      for (const repair of result.repairs) {
        if (allRepairs.length >= opts.maxRepairs) {
          break;
        }

        if (
          passesConfidenceFilter(repair, opts.minConfidence) &&
          passesCategoryFilter(repair, opts.categories.length > 0 ? opts.categories : undefined)
        ) {
          allRepairs.push(repair);
        }
      }

      allUnrepaired.push(...result.unrepaired);
    }

    const stats = createEmptyStats();
    stats.totalRepairs = allRepairs.length;
    stats.unrepairedCount = allUnrepaired.length;
    stats.durationMs = performance.now() - startTime;

    for (const repair of allRepairs) {
      stats.byCategory[repair.category]++;
      stats.byConfidence[repair.confidence]++;
    }

    return {
      ast: clonedAst,
      repairs: allRepairs,
      remainingErrors: allUnrepaired,
      stats,
    };
  };
}

/**
 * Format a repair report as a human-readable string.
 *
 * @param result - The repair result to format
 * @returns Formatted string report
 *
 * @example
 * ```typescript
 * const result = repairAst(ast, errors);
 * console.log(formatRepairReport(result));
 * ```
 */
export function formatRepairReport(result: RepairResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                     ISL REPAIR REPORT                         ');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push(`Total repairs applied: ${result.stats.totalRepairs}`);
  lines.push(`Remaining errors: ${result.stats.unrepairedCount}`);
  lines.push(`Duration: ${result.stats.durationMs.toFixed(2)}ms`);
  lines.push('');

  // By category
  lines.push('Repairs by category:');
  for (const [category, count] of Object.entries(result.stats.byCategory)) {
    if (count > 0) {
      lines.push(`  ${category}: ${count}`);
    }
  }
  lines.push('');

  // By confidence
  lines.push('Repairs by confidence:');
  for (const [confidence, count] of Object.entries(result.stats.byConfidence)) {
    if (count > 0) {
      lines.push(`  ${confidence}: ${count}`);
    }
  }
  lines.push('');

  // Detailed repairs
  if (result.repairs.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                       REPAIRS APPLIED                         ');
    lines.push('───────────────────────────────────────────────────────────────');

    for (const repair of result.repairs) {
      lines.push('');
      lines.push(`[${repair.id}] ${repair.category} (${repair.confidence} confidence)`);
      lines.push(`  Path: ${repair.path}`);
      lines.push(`  Reason: ${repair.reason}`);
      lines.push(`  Change: ${repair.diffSummary}`);
      if (repair.location && repair.location.file !== '<synthesized>') {
        lines.push(
          `  Location: ${repair.location.file}:${repair.location.line}:${repair.location.column}`
        );
      }
    }
  }

  // Remaining errors
  if (result.remainingErrors.length > 0) {
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                    UNREPAIRED ERRORS                          ');
    lines.push('───────────────────────────────────────────────────────────────');

    for (const error of result.remainingErrors) {
      lines.push('');
      lines.push(`[${error.code ?? 'unknown'}] ${error.message}`);
      lines.push(`  Path: ${error.path}`);
      lines.push(`  Reason: ${error.reason}`);
      if (error.location) {
        lines.push(
          `  Location: ${error.location.file}:${error.location.line}:${error.location.column}`
        );
      }
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

export default repairAst;
