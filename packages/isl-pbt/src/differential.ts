// ============================================================================
// Differential Testing - Compare two implementations against the same ISL spec
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  BehaviorProperties,
  PBTConfig,
  ShrinkResult,
} from './types.js';
import { DEFAULT_PBT_CONFIG } from './types.js';
import { createPRNG } from './random.js';
import { createInputGenerator } from './generator.js';
import { extractProperties, findBehavior } from './property.js';
import { deltaDebug } from './shrinker.js';
import { deepEqual, semanticEqual, diffOutputs } from './comparator.js';
import type { OutputDiff } from './comparator.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * An implementation to test — either a local handler function or a remote
 * HTTP endpoint.
 */
export type Implementation =
  | { name: string; handler: (input: unknown) => Promise<unknown> }
  | { name: string; endpoint: string };

/**
 * Configuration for a differential test run.
 */
export interface DifferentialConfig {
  /** Maximum number of test inputs to generate (default 100) */
  maxTests: number;
  /** PRNG seed for reproducibility */
  seed?: number;
  /** Per-invocation timeout in ms (default 5000) */
  timeoutMs?: number;
  /** Custom output comparator — return true if outputs are equivalent */
  compareOutputs?: (a: unknown, b: unknown) => boolean;
  /** Maximum shrinking attempts per disagreement (default 100) */
  maxShrinks?: number;
  /** Size growth strategy (default linear) */
  sizeGrowth?: 'linear' | 'logarithmic';
  /** Maximum size parameter (default 100) */
  maxSize?: number;
}

/**
 * A single input on which the two implementations diverged.
 */
export interface Disagreement {
  /** The generated input that triggered the divergence */
  input: Record<string, unknown>;
  /** Output from implementation A */
  outputA: unknown;
  /** Output from implementation B */
  outputB: unknown;
  /** ISL property context that was being tested */
  property: string;
  /** Human-readable explanation of the difference */
  description: string;
  /** Detailed structural diff */
  diffs: OutputDiff[];
  /** Minimal input that still triggers this disagreement (after shrinking) */
  minimalInput?: Record<string, unknown>;
}

/**
 * Result of a differential test run.
 */
export interface DifferentialResult {
  /** Total test iterations executed */
  totalTests: number;
  /** Number of inputs where both implementations agreed */
  agreements: number;
  /** Details of every disagreement found */
  disagreements: Disagreement[];
  /** Total inputs generated (including filtered) */
  inputsGenerated: number;
  /** Behavioural coverage: fraction of tests with agreement */
  coverage: number;
  /** Duration of the entire run in ms */
  durationMs: number;
  /** Seed used (for reproduction) */
  seed: number;
  /** Implementation names */
  implA: string;
  /** Implementation names */
  implB: string;
}

// ============================================================================
// DIFFERENTIAL RUNNER
// ============================================================================

export class DifferentialRunner {
  private readonly config: Required<
    Pick<DifferentialConfig, 'maxTests' | 'timeoutMs' | 'maxShrinks' | 'maxSize'>
  > & DifferentialConfig;

  constructor(config: DifferentialConfig) {
    this.config = {
      timeoutMs: 5000,
      maxShrinks: 100,
      sizeGrowth: 'linear',
      maxSize: 100,
      ...config,
    };
  }

  /**
   * Compare two implementations against the same ISL spec source.
   *
   * The method:
   * 1. Parses the ISL domain to understand input/output shapes
   * 2. Uses the existing PBT generator to create random inputs
   * 3. Invokes both implementations with every input
   * 4. Compares outputs using the configured comparator (semantic by default)
   * 5. Shrinks any disagreements to a minimal failing case
   */
  async compare(
    domain: AST.Domain,
    behaviorName: string,
    implA: Implementation,
    implB: Implementation,
  ): Promise<DifferentialResult> {
    const startTime = Date.now();

    const behavior = findBehavior(domain, behaviorName);
    if (!behavior) {
      throw new Error(
        `Behavior '${behaviorName}' not found in domain`,
      );
    }

    const properties = extractProperties(behavior, domain);

    const pbtConfig: Partial<PBTConfig> = {
      numTests: this.config.maxTests,
      seed: this.config.seed,
      maxShrinks: this.config.maxShrinks,
      sizeGrowth: this.config.sizeGrowth ?? 'linear',
      maxSize: this.config.maxSize,
      timeout: this.config.timeoutMs,
    };

    const inputGen = createInputGenerator(properties, pbtConfig);
    const prng = createPRNG(this.config.seed);

    const disagreements: Disagreement[] = [];
    let agreements = 0;
    let inputsGenerated = 0;

    const compareFn =
      this.config.compareOutputs ?? ((a: unknown, b: unknown) => semanticEqual(a, b));

    for (let i = 0; i < this.config.maxTests; i++) {
      const size = this.calculateSize(i);

      let input: Record<string, unknown>;
      try {
        input = inputGen.generate(prng.fork(), size);
      } catch {
        continue;
      }
      inputsGenerated++;

      const [resultA, resultB] = await Promise.all([
        this.invoke(implA, input),
        this.invoke(implB, input),
      ]);

      // Both errored — treat as agreement on failure mode
      if (resultA.error && resultB.error) {
        agreements++;
        continue;
      }

      // One errored, the other didn't
      if (resultA.error !== resultB.error && (resultA.error || resultB.error)) {
        const desc = resultA.error
          ? `${implA.name} threw "${resultA.error}" but ${implB.name} returned normally`
          : `${implB.name} threw "${resultB.error}" but ${implA.name} returned normally`;

        disagreements.push({
          input,
          outputA: resultA.error ?? resultA.value,
          outputB: resultB.error ?? resultB.value,
          property: behaviorName,
          description: desc,
          diffs: diffOutputs(resultA.value, resultB.value),
        });
        continue;
      }

      // Compare outputs
      if (compareFn(resultA.value, resultB.value)) {
        agreements++;
      } else {
        const diffs = diffOutputs(resultA.value, resultB.value);
        const desc = describeDiffs(implA.name, implB.name, diffs);

        disagreements.push({
          input,
          outputA: resultA.value,
          outputB: resultB.value,
          property: behaviorName,
          description: desc,
          diffs,
        });
      }
    }

    // Shrink each disagreement to a minimal failing input
    for (const d of disagreements) {
      const shrunk = await this.shrinkDisagreement(
        d,
        implA,
        implB,
        compareFn,
        properties,
        pbtConfig,
      );
      if (shrunk) {
        d.minimalInput = shrunk;
      }
    }

    const totalTests = agreements + disagreements.length;

    return {
      totalTests,
      agreements,
      disagreements,
      inputsGenerated,
      coverage: totalTests > 0 ? agreements / totalTests : 1,
      durationMs: Date.now() - startTime,
      seed: prng.seed(),
      implA: implA.name,
      implB: implB.name,
    };
  }

  // ==========================================================================
  // IMPLEMENTATION INVOCATION
  // ==========================================================================

  private async invoke(
    impl: Implementation,
    input: Record<string, unknown>,
  ): Promise<{ value?: unknown; error?: string }> {
    try {
      const result = await Promise.race([
        this.callImpl(impl, input),
        this.timeout(),
      ]);
      return { value: result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async callImpl(
    impl: Implementation,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    if ('handler' in impl) {
      return impl.handler(input);
    }

    const res = await fetch(impl.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }

  // ==========================================================================
  // SHRINKING
  // ==========================================================================

  /**
   * Shrink a disagreement's input to the smallest case that still causes
   * the two implementations to disagree.
   */
  private async shrinkDisagreement(
    disagreement: Disagreement,
    implA: Implementation,
    implB: Implementation,
    compareFn: (a: unknown, b: unknown) => boolean,
    _properties: BehaviorProperties,
    config: Partial<PBTConfig>,
  ): Promise<Record<string, unknown> | undefined> {
    const testFn = async (input: Record<string, unknown>): Promise<boolean> => {
      const [rA, rB] = await Promise.all([
        this.invoke(implA, input),
        this.invoke(implB, input),
      ]);

      // Both errored → agreement (passes)
      if (rA.error && rB.error) return true;
      // One errored → disagreement (fails)
      if (rA.error || rB.error) return false;

      return compareFn(rA.value, rB.value);
    };

    const shrinkResult: ShrinkResult = await deltaDebug(
      disagreement.input,
      testFn,
      { ...config, maxShrinks: this.config.maxShrinks },
    );

    if (!deepEqual(shrinkResult.minimal, disagreement.input)) {
      return shrinkResult.minimal;
    }

    return undefined;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private calculateSize(iteration: number): number {
    if (this.config.sizeGrowth === 'logarithmic') {
      return Math.min(
        this.config.maxSize,
        Math.floor(Math.log2(iteration + 2) * 10),
      );
    }
    return Math.min(
      this.config.maxSize,
      Math.floor((iteration / this.config.maxTests) * this.config.maxSize),
    );
  }

  private timeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timeout after ${this.config.timeoutMs}ms`)),
        this.config.timeoutMs,
      );
    });
  }
}

// ============================================================================
// REPORT FORMATTING
// ============================================================================

/**
 * Format a DifferentialResult into a human-readable report string.
 */
export function formatDifferentialReport(result: DifferentialResult): string {
  const lines: string[] = [];

  lines.push(`Differential Test Report: ${result.implA} vs ${result.implB}`);
  lines.push('='.repeat(60));

  if (result.disagreements.length === 0) {
    lines.push(`✓ All ${result.totalTests} tests agreed`);
  } else {
    lines.push(
      `✗ ${result.disagreements.length} disagreement(s) in ${result.totalTests} tests`,
    );
  }

  lines.push('');
  lines.push('Statistics:');
  lines.push(`  Tests Run:       ${result.totalTests}`);
  lines.push(`  Agreements:      ${result.agreements}`);
  lines.push(`  Disagreements:   ${result.disagreements.length}`);
  lines.push(`  Inputs Generated:${result.inputsGenerated}`);
  lines.push(`  Coverage:        ${(result.coverage * 100).toFixed(1)}%`);
  lines.push(`  Seed:            ${result.seed}`);

  for (let i = 0; i < result.disagreements.length; i++) {
    const d = result.disagreements[i]!;
    lines.push('');
    lines.push(`Disagreement #${i + 1}:`);
    lines.push(`  Property:    ${d.property}`);
    lines.push(`  Description: ${d.description}`);
    lines.push(`  Input:       ${truncateJson(d.input)}`);
    lines.push(`  Output A:    ${truncateJson(d.outputA)}`);
    lines.push(`  Output B:    ${truncateJson(d.outputB)}`);

    if (d.minimalInput) {
      lines.push(`  Minimal:     ${truncateJson(d.minimalInput)}`);
    }

    if (d.diffs.length > 0) {
      lines.push('  Diffs:');
      for (const diff of d.diffs.slice(0, 10)) {
        lines.push(
          `    ${diff.type} @ ${diff.path}: ${truncateJson(diff.valueA)} → ${truncateJson(diff.valueB)}`,
        );
      }
      if (d.diffs.length > 10) {
        lines.push(`    ... and ${d.diffs.length - 10} more`);
      }
    }
  }

  lines.push('');
  lines.push(`Total Duration: ${result.durationMs}ms`);

  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function describeDiffs(
  nameA: string,
  nameB: string,
  diffs: OutputDiff[],
): string {
  if (diffs.length === 0) {
    return `${nameA} and ${nameB} produced structurally different outputs`;
  }
  if (diffs.length === 1) {
    const d = diffs[0]!;
    return `${d.type} at "${d.path}": ${nameA}=${truncateJson(d.valueA)}, ${nameB}=${truncateJson(d.valueB)}`;
  }
  return `${diffs.length} differences between ${nameA} and ${nameB} (first at "${diffs[0]!.path}")`;
}

function truncateJson(value: unknown, maxLen = 80): string {
  const s = JSON.stringify(value);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}
