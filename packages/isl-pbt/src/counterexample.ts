// ============================================================================
// Counterexample - Minimal, Reproducible Failing Inputs
// ============================================================================
//
// Production-grade counterexample generation:
// 1. Minimal: Shrinks to smallest failing input
// 2. Reproducible: Captures seed and exact input for replay
// 3. Actionable: Includes context for debugging
//
// Shrinking strategies:
// - Delta debugging for object inputs
// - Binary search for numeric values
// - Constraint-aware shrinking (respects ISL constraints)
// - Precondition-preserving shrinking
// ============================================================================

import type { ShrinkResult, ShrinkStep, PBTConfig, Property, FieldConstraints } from './types.js';

// ============================================================================
// COUNTEREXAMPLE TYPES
// ============================================================================

/**
 * A reproducible counterexample with full context
 */
export interface Counterexample {
  /** Unique ID for this counterexample */
  id: string;

  /** Original failing input before shrinking */
  originalInput: Record<string, unknown>;

  /** Minimal failing input after shrinking */
  minimalInput: Record<string, unknown>;

  /** Seed used to generate this input */
  seed: number;

  /** Size parameter at failure */
  size: number;

  /** Property that failed */
  failedProperty: PropertyInfo;

  /** Error message or assertion */
  error: string;

  /** Stack trace if available */
  stackTrace?: string;

  /** Shrinking statistics */
  shrinkStats: ShrinkStats;

  /** Timestamp of discovery */
  timestamp: string;

  /** Reproduction command */
  reproductionCommand: string;

  /** Reproduction code snippet */
  reproductionCode: string;
}

/**
 * Property info for counterexample
 */
export interface PropertyInfo {
  name: string;
  type: 'precondition' | 'postcondition' | 'invariant';
  expression: string;
  guard?: string;
}

/**
 * Shrinking statistics
 */
export interface ShrinkStats {
  /** Total shrink attempts */
  attempts: number;

  /** Successful shrinks (found smaller failing input) */
  successfulShrinks: number;

  /** Failed shrinks (input passed or was larger) */
  failedShrinks: number;

  /** Size reduction ratio (0-1) */
  reductionRatio: number;

  /** Time spent shrinking in ms */
  duration: number;

  /** Shrinking strategy used */
  strategy: ShrinkStrategy;
}

export type ShrinkStrategy = 'delta_debug' | 'binary_search' | 'constraint_aware' | 'hybrid';

// ============================================================================
// COUNTEREXAMPLE BUILDER
// ============================================================================

/**
 * Build a complete counterexample from a failing test
 */
export function buildCounterexample(
  originalInput: Record<string, unknown>,
  minimalInput: Record<string, unknown>,
  seed: number,
  size: number,
  failedProperty: Property,
  error: string,
  shrinkResult: ShrinkResult,
  behaviorName: string,
  specFile?: string
): Counterexample {
  const id = generateCounterexampleId(seed, failedProperty.name);

  return {
    id,
    originalInput,
    minimalInput,
    seed,
    size,
    failedProperty: {
      name: failedProperty.name,
      type: failedProperty.type,
      expression: expressionToString(failedProperty.expression),
      guard: failedProperty.guard,
    },
    error,
    stackTrace: extractStackTrace(error),
    shrinkStats: {
      attempts: shrinkResult.shrinkAttempts,
      successfulShrinks: shrinkResult.history.filter(s => !s.passed).length,
      failedShrinks: shrinkResult.history.filter(s => s.passed).length,
      reductionRatio: calculateReductionRatio(originalInput, minimalInput),
      duration: 0, // Will be set by caller
      strategy: 'hybrid',
    },
    timestamp: new Date().toISOString(),
    reproductionCommand: buildReproductionCommand(seed, behaviorName, specFile),
    reproductionCode: buildReproductionCode(minimalInput, behaviorName),
  };
}

function generateCounterexampleId(seed: number, propertyName: string): string {
  const hash = simpleHash(`${seed}-${propertyName}-${Date.now()}`);
  return `ce-${hash.slice(0, 8)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function expressionToString(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr);
  
  // Handle AST expression nodes
  const node = expr as { kind?: string; name?: string; operator?: string; value?: unknown };
  
  switch (node.kind) {
    case 'Identifier':
      return node.name ?? '';
    case 'BinaryExpr':
      return `... ${node.operator} ...`;
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
      return String(node.value);
    default:
      return '[expression]';
  }
}

function extractStackTrace(error: string): string | undefined {
  const lines = error.split('\n');
  const stackLines = lines.filter(line => line.includes('at ') || line.includes('Error:'));
  return stackLines.length > 1 ? stackLines.join('\n') : undefined;
}

function calculateReductionRatio(original: Record<string, unknown>, minimal: Record<string, unknown>): number {
  const originalSize = computeInputSize(original);
  const minimalSize = computeInputSize(minimal);
  
  if (originalSize === 0) return 0;
  return 1 - (minimalSize / originalSize);
}

function computeInputSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return Math.abs(value);
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) {
    return value.length + value.reduce((sum, el) => sum + computeInputSize(el), 0);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    return keys.length + keys.reduce((sum, key) => sum + computeInputSize(obj[key]), 0);
  }
  return 1;
}

function buildReproductionCommand(seed: number, behaviorName: string, specFile?: string): string {
  const parts = ['isl verify --pbt'];
  parts.push(`--pbt-seed ${seed}`);
  if (behaviorName) {
    parts.push(`--behavior ${behaviorName}`);
  }
  if (specFile) {
    parts.push(`--spec ${specFile}`);
  }
  return parts.join(' ');
}

function buildReproductionCode(minimalInput: Record<string, unknown>, behaviorName: string): string {
  const inputJson = JSON.stringify(minimalInput, null, 2);
  return `// Reproduction test for ${behaviorName}
const input = ${inputJson};

// Run the behavior with this input to reproduce the failure
const result = await ${toCamelCase(behaviorName)}(input);
`;
}

function toCamelCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// ============================================================================
// ADVANCED SHRINKING
// ============================================================================

/**
 * Configuration for constraint-aware shrinking
 */
export interface ShrinkConfig {
  /** Maximum shrink attempts */
  maxAttempts: number;

  /** Constraints to respect per field */
  fieldConstraints: Record<string, FieldConstraints>;

  /** Precondition checker */
  checkPreconditions?: (input: Record<string, unknown>) => boolean;

  /** Shrinking strategy */
  strategy: ShrinkStrategy;

  /** Enable trace logging */
  trace?: boolean;
}

const DEFAULT_SHRINK_CONFIG: ShrinkConfig = {
  maxAttempts: 100,
  fieldConstraints: {},
  strategy: 'hybrid',
  trace: false,
};

/**
 * Shrink input with full constraint awareness and reproducibility
 */
export async function shrinkWithConstraints(
  originalInput: Record<string, unknown>,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: Partial<ShrinkConfig> = {}
): Promise<ShrinkResult> {
  const cfg = { ...DEFAULT_SHRINK_CONFIG, ...config };
  const startTime = Date.now();
  const history: ShrinkStep[] = [];
  
  let current = originalInput;
  let currentSize = computeInputSize(current);
  let attempts = 0;

  // Phase 1: Delta debugging - remove entire fields
  if (cfg.strategy === 'delta_debug' || cfg.strategy === 'hybrid') {
    const deltaResult = await deltaDebugFields(current, testFn, cfg, attempts, history);
    current = deltaResult.minimal;
    currentSize = computeInputSize(current);
    attempts = deltaResult.attempts;
  }

  // Phase 2: Binary search on individual values
  if (cfg.strategy === 'binary_search' || cfg.strategy === 'hybrid') {
    const binaryResult = await binarySearchValues(current, testFn, cfg, attempts, history);
    current = binaryResult.minimal;
    attempts = binaryResult.attempts;
  }

  // Phase 3: Constraint-aware fine-tuning
  if (cfg.strategy === 'constraint_aware' || cfg.strategy === 'hybrid') {
    const constraintResult = await constraintAwareShrink(current, testFn, cfg, attempts, history);
    current = constraintResult.minimal;
    attempts = constraintResult.attempts;
  }

  return {
    original: originalInput,
    minimal: current,
    shrinkAttempts: attempts,
    history,
  };
}

/**
 * Delta debugging - systematically remove fields
 */
async function deltaDebugFields(
  input: Record<string, unknown>,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: ShrinkConfig,
  startAttempts: number,
  history: ShrinkStep[]
): Promise<{ minimal: Record<string, unknown>; attempts: number }> {
  let current = { ...input };
  let attempts = startAttempts;
  const keys = Object.keys(current);
  let n = 2;

  while (attempts < config.maxAttempts && keys.length >= 1) {
    const partitionSize = Math.ceil(keys.length / n);
    let foundSmaller = false;

    // Try removing each partition
    for (let i = 0; i < keys.length && !foundSmaller; i += partitionSize) {
      const partition = keys.slice(i, i + partitionSize);
      const candidate: Record<string, unknown> = {};

      for (const key of keys) {
        if (!partition.includes(key)) {
          candidate[key] = current[key];
        }
      }

      // Check preconditions if configured
      if (config.checkPreconditions && !config.checkPreconditions(candidate)) {
        continue;
      }

      attempts++;
      if (attempts > config.maxAttempts) break;

      try {
        const passed = await testFn(candidate);
        const candidateSize = computeInputSize(candidate);

        history.push({ input: candidate, passed, size: candidateSize });

        if (!passed) {
          // Found smaller failing input
          current = candidate;
          keys.splice(0, keys.length, ...Object.keys(candidate));
          foundSmaller = true;
          n = Math.max(2, n - 1);
        }
      } catch {
        // Error counts as failure
        current = candidate;
        keys.splice(0, keys.length, ...Object.keys(candidate));
        foundSmaller = true;
        n = Math.max(2, n - 1);
      }
    }

    if (!foundSmaller) {
      if (n >= keys.length) break;
      n = Math.min(keys.length, n * 2);
    }
  }

  return { minimal: current, attempts };
}

/**
 * Binary search on numeric and string values
 */
async function binarySearchValues(
  input: Record<string, unknown>,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: ShrinkConfig,
  startAttempts: number,
  history: ShrinkStep[]
): Promise<{ minimal: Record<string, unknown>; attempts: number }> {
  let current = { ...input };
  let attempts = startAttempts;

  for (const [key, value] of Object.entries(current)) {
    if (attempts >= config.maxAttempts) break;

    const constraints = config.fieldConstraints[key];

    if (typeof value === 'number') {
      const result = await binarySearchNumber(
        current,
        key,
        value,
        constraints,
        testFn,
        config,
        attempts,
        history
      );
      current = result.input;
      attempts = result.attempts;
    } else if (typeof value === 'string') {
      const result = await binarySearchString(
        current,
        key,
        value,
        constraints,
        testFn,
        config,
        attempts,
        history
      );
      current = result.input;
      attempts = result.attempts;
    }
  }

  return { minimal: current, attempts };
}

async function binarySearchNumber(
  input: Record<string, unknown>,
  key: string,
  value: number,
  constraints: FieldConstraints | undefined,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: ShrinkConfig,
  startAttempts: number,
  history: ShrinkStep[]
): Promise<{ input: Record<string, unknown>; attempts: number }> {
  let current = { ...input };
  let attempts = startAttempts;
  const min = constraints?.min ?? 0;
  const precision = constraints?.precision ?? 0;
  const factor = Math.pow(10, precision);

  let low = min;
  let high = value;

  while (attempts < config.maxAttempts && Math.abs(high - low) > (precision ? Math.pow(10, -precision) : 0.001)) {
    const mid = precision
      ? Math.round(((low + high) / 2) * factor) / factor
      : Math.trunc((low + high) / 2);

    if (mid === current[key]) break;

    const candidate = { ...current, [key]: mid };

    if (config.checkPreconditions && !config.checkPreconditions(candidate)) {
      low = mid;
      continue;
    }

    attempts++;
    try {
      const passed = await testFn(candidate);
      history.push({ input: candidate, passed, size: computeInputSize(candidate) });

      if (!passed) {
        // Mid still fails, shrink further
        current = candidate;
        high = mid;
      } else {
        // Mid passes, failure is above mid
        low = mid;
      }
    } catch {
      current = candidate;
      high = mid;
    }
  }

  return { input: current, attempts };
}

async function binarySearchString(
  input: Record<string, unknown>,
  key: string,
  value: string,
  constraints: FieldConstraints | undefined,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: ShrinkConfig,
  startAttempts: number,
  history: ShrinkStep[]
): Promise<{ input: Record<string, unknown>; attempts: number }> {
  let current = { ...input };
  let attempts = startAttempts;
  const minLength = constraints?.minLength ?? 0;

  // Binary search on length
  let low = minLength;
  let high = value.length;

  while (attempts < config.maxAttempts && high - low > 1) {
    const mid = Math.trunc((low + high) / 2);
    const candidate = { ...current, [key]: value.slice(0, mid) };

    if (config.checkPreconditions && !config.checkPreconditions(candidate)) {
      low = mid;
      continue;
    }

    attempts++;
    try {
      const passed = await testFn(candidate);
      history.push({ input: candidate, passed, size: computeInputSize(candidate) });

      if (!passed) {
        current = candidate;
        high = mid;
      } else {
        low = mid;
      }
    } catch {
      current = candidate;
      high = mid;
    }
  }

  return { input: current, attempts };
}

/**
 * Constraint-aware shrinking - respects type constraints
 */
async function constraintAwareShrink(
  input: Record<string, unknown>,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: ShrinkConfig,
  startAttempts: number,
  history: ShrinkStep[]
): Promise<{ minimal: Record<string, unknown>; attempts: number }> {
  let current = { ...input };
  let attempts = startAttempts;

  // Try shrinking to constraint minimums
  for (const [key, value] of Object.entries(current)) {
    if (attempts >= config.maxAttempts) break;

    const constraints = config.fieldConstraints[key];
    const shrinkTargets = getShrinkTargets(value, constraints);

    for (const target of shrinkTargets) {
      if (attempts >= config.maxAttempts) break;

      const candidate = { ...current, [key]: target };

      if (config.checkPreconditions && !config.checkPreconditions(candidate)) {
        continue;
      }

      attempts++;
      try {
        const passed = await testFn(candidate);
        history.push({ input: candidate, passed, size: computeInputSize(candidate) });

        if (!passed && computeInputSize(candidate) < computeInputSize(current)) {
          current = candidate;
          break; // Move to next field
        }
      } catch {
        if (computeInputSize(candidate) < computeInputSize(current)) {
          current = candidate;
          break;
        }
      }
    }
  }

  return { minimal: current, attempts };
}

function getShrinkTargets(value: unknown, constraints?: FieldConstraints): unknown[] {
  const targets: unknown[] = [];

  if (typeof value === 'number') {
    const min = constraints?.min ?? 0;
    targets.push(min);
    if (min <= 0) targets.push(0);
    if (min <= 1) targets.push(1);
  } else if (typeof value === 'string') {
    const minLength = constraints?.minLength ?? 0;
    if (minLength === 0) targets.push('');
    targets.push('a'.repeat(minLength));
    
    // For emails
    if (constraints?.format === 'email' || (value as string).includes('@')) {
      targets.push('a@b.co');
    }
  } else if (Array.isArray(value)) {
    const minLength = constraints?.minLength ?? 0;
    targets.push(value.slice(0, minLength));
    if (minLength === 0) targets.push([]);
  }

  return targets;
}

// ============================================================================
// COUNTEREXAMPLE SERIALIZATION
// ============================================================================

/**
 * Serialize counterexample to JSON for storage/reporting
 */
export function serializeCounterexample(ce: Counterexample): string {
  return JSON.stringify({
    id: ce.id,
    seed: ce.seed,
    size: ce.size,
    timestamp: ce.timestamp,
    failedProperty: ce.failedProperty,
    error: ce.error,
    originalInput: ce.originalInput,
    minimalInput: ce.minimalInput,
    shrinkStats: ce.shrinkStats,
    reproductionCommand: ce.reproductionCommand,
    reproductionCode: ce.reproductionCode,
  }, null, 2);
}

/**
 * Parse counterexample from JSON
 */
export function parseCounterexample(json: string): Counterexample {
  const data = JSON.parse(json);
  return {
    id: data.id,
    seed: data.seed,
    size: data.size,
    timestamp: data.timestamp,
    failedProperty: data.failedProperty,
    error: data.error,
    originalInput: data.originalInput,
    minimalInput: data.minimalInput,
    shrinkStats: data.shrinkStats,
    reproductionCommand: data.reproductionCommand,
    reproductionCode: data.reproductionCode,
  };
}

/**
 * Format counterexample for console output
 */
export function formatCounterexample(ce: Counterexample): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔════════════════════════════════════════════════════════════════╗');
  lines.push('║                    COUNTEREXAMPLE FOUND                        ║');
  lines.push('╚════════════════════════════════════════════════════════════════╝');
  lines.push('');

  lines.push(`ID:       ${ce.id}`);
  lines.push(`Property: ${ce.failedProperty.type} "${ce.failedProperty.name}"`);
  lines.push(`Error:    ${ce.error}`);
  lines.push('');

  lines.push('Minimal Input:');
  lines.push(JSON.stringify(ce.minimalInput, null, 2));
  lines.push('');

  if (ce.shrinkStats.reductionRatio > 0) {
    lines.push(`Shrinking: ${Math.round(ce.shrinkStats.reductionRatio * 100)}% reduction in ${ce.shrinkStats.attempts} attempts`);
    lines.push('');
  }

  lines.push('To Reproduce:');
  lines.push(`  ${ce.reproductionCommand}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// COUNTEREXAMPLE REGISTRY
// ============================================================================

/**
 * Registry for tracking counterexamples across test runs
 */
export class CounterexampleRegistry {
  private examples: Map<string, Counterexample> = new Map();

  add(ce: Counterexample): void {
    this.examples.set(ce.id, ce);
  }

  get(id: string): Counterexample | undefined {
    return this.examples.get(id);
  }

  getAll(): Counterexample[] {
    return Array.from(this.examples.values());
  }

  getByProperty(propertyName: string): Counterexample[] {
    return this.getAll().filter(ce => ce.failedProperty.name === propertyName);
  }

  getBySeed(seed: number): Counterexample[] {
    return this.getAll().filter(ce => ce.seed === seed);
  }

  clear(): void {
    this.examples.clear();
  }

  size(): number {
    return this.examples.size;
  }

  toJSON(): string {
    return JSON.stringify(this.getAll().map(ce => ({
      id: ce.id,
      seed: ce.seed,
      property: ce.failedProperty.name,
      error: ce.error,
      minimalInput: ce.minimalInput,
    })), null, 2);
  }
}

// Global registry instance
export const counterexampleRegistry = new CounterexampleRegistry();
