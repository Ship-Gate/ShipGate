// ============================================================================
// Coverage-Guided Fuzzing Strategy
// Prioritize inputs that increase code coverage
// ============================================================================

import { 
  FuzzContext, 
  GeneratedValue, 
  CorpusEntry, 
  CoverageInfo, 
  createRng 
} from '../types.js';
import { mutateValue } from './mutation.js';
import { generateRandom } from './random.js';

/**
 * Coverage strategy configuration
 */
export interface CoverageStrategyConfig {
  /** Seed for reproducibility */
  seed?: string;
  
  /** Energy multiplier for coverage-increasing inputs */
  energyMultiplier?: number;
  
  /** Minimum energy */
  minEnergy?: number;
  
  /** Maximum energy */
  maxEnergy?: number;
  
  /** Decay rate for energy */
  energyDecay?: number;
  
  /** Prefer newer inputs */
  preferNew?: boolean;
}

/**
 * Coverage tracking state
 */
export interface CoverageState {
  /** All discovered branches */
  discoveredBranches: Set<string>;
  
  /** Hit counts per branch */
  branchHitCounts: Map<string, number>;
  
  /** Coverage bits for deduplication */
  coverageBits: Set<string>;
  
  /** Last coverage percentage */
  lastPercentage: number;
}

/**
 * Create initial coverage state
 */
export function createCoverageState(): CoverageState {
  return {
    discoveredBranches: new Set(),
    branchHitCounts: new Map(),
    coverageBits: new Set(),
    lastPercentage: 0,
  };
}

/**
 * Generate coverage-guided fuzz inputs
 */
export function* generateCoverageGuided(
  corpus: CorpusEntry[],
  coverageState: CoverageState,
  ctx: FuzzContext,
  config: CoverageStrategyConfig = {}
): Generator<GeneratedValue<unknown>> {
  const rng = ctx.rng ?? createRng(config.seed ?? Date.now().toString());
  const energyMultiplier = config.energyMultiplier ?? 2;
  const minEnergy = config.minEnergy ?? 1;
  const maxEnergy = config.maxEnergy ?? 100;

  // Build weighted corpus based on energy
  const weightedCorpus = buildWeightedCorpus(corpus, minEnergy, maxEnergy);
  
  // Generate inputs based on weighted selection
  for (let i = 0; i < (ctx.iterations ?? 100); i++) {
    // Select entry based on energy
    const entry = selectWeighted(weightedCorpus, rng);
    
    if (entry) {
      // Mutate the selected entry
      const mutated = mutateValue(entry.input, rng, 0.5);
      yield {
        value: mutated.value,
        category: 'mutation',
        description: `Coverage-guided mutation: ${mutated.operation}`,
      };
    } else {
      // No corpus entries, generate random
      for (const random of generateRandom(ctx, { seed: String(rng()) })) {
        yield random;
        break;
      }
    }

    // Occasionally generate completely random inputs
    if (rng() < 0.1) {
      for (const random of generateRandom({ ...ctx, iterations: 1 }, { seed: String(rng()) })) {
        yield random;
        break;
      }
    }
  }
}

/**
 * Build weighted corpus based on energy
 */
function buildWeightedCorpus(
  corpus: CorpusEntry[],
  minEnergy: number,
  maxEnergy: number
): { entry: CorpusEntry; weight: number }[] {
  return corpus.map(entry => ({
    entry,
    weight: Math.min(maxEnergy, Math.max(minEnergy, entry.energy)),
  }));
}

/**
 * Select entry based on weight
 */
function selectWeighted(
  weightedCorpus: { entry: CorpusEntry; weight: number }[],
  rng: () => number
): CorpusEntry | null {
  if (weightedCorpus.length === 0) return null;

  const totalWeight = weightedCorpus.reduce((sum, item) => sum + item.weight, 0);
  let random = rng() * totalWeight;

  for (const item of weightedCorpus) {
    random -= item.weight;
    if (random <= 0) {
      return item.entry;
    }
  }

  return weightedCorpus[weightedCorpus.length - 1]?.entry ?? null;
}

/**
 * Update coverage state with new execution
 */
export function updateCoverage(
  state: CoverageState,
  branches: string[],
  hitCounts: Map<string, number>
): { newBranches: string[]; coverageIncreased: boolean } {
  const newBranches: string[] = [];
  let coverageIncreased = false;

  for (const branch of branches) {
    if (!state.discoveredBranches.has(branch)) {
      state.discoveredBranches.add(branch);
      newBranches.push(branch);
      coverageIncreased = true;
    }
  }

  // Update hit counts
  for (const [branch, count] of hitCounts) {
    const current = state.branchHitCounts.get(branch) ?? 0;
    state.branchHitCounts.set(branch, current + count);
  }

  return { newBranches, coverageIncreased };
}

/**
 * Calculate energy for a corpus entry based on its coverage contribution
 */
export function calculateEnergy(
  entry: CorpusEntry,
  state: CoverageState,
  config: CoverageStrategyConfig = {}
): number {
  const multiplier = config.energyMultiplier ?? 2;
  const minEnergy = config.minEnergy ?? 1;
  const maxEnergy = config.maxEnergy ?? 100;
  const decay = config.energyDecay ?? 0.95;

  let energy = minEnergy;

  // Increase energy for coverage-increasing inputs
  if (entry.coverageBits && entry.coverageBits.size > 0) {
    // Count unique branches discovered by this input
    const uniqueBranches = Array.from(entry.coverageBits).filter(
      bit => state.branchHitCounts.get(bit) === 1
    );
    energy += uniqueBranches.length * multiplier;
  }

  // Increase energy for crash-inducing inputs
  if (entry.causedCrash) {
    energy *= 2;
  }

  // Decay based on mutation count
  energy *= Math.pow(decay, entry.mutationCount);

  // Prefer newer inputs
  if (config.preferNew) {
    const age = Date.now() - entry.addedAt;
    const ageDecay = Math.max(0.5, 1 - age / (1000 * 60 * 60)); // Decay over 1 hour
    energy *= ageDecay;
  }

  return Math.min(maxEnergy, Math.max(minEnergy, energy));
}

/**
 * Generate coverage report
 */
export function generateCoverageReport(
  state: CoverageState,
  totalBranches: number
): CoverageInfo {
  const coveredBranches = state.discoveredBranches.size;
  const percentage = totalBranches > 0 
    ? (coveredBranches / totalBranches) * 100 
    : 0;
  
  const newBranches = percentage > state.lastPercentage 
    ? coveredBranches - Math.floor(state.lastPercentage * totalBranches / 100)
    : 0;

  return {
    totalBranches,
    coveredBranches,
    percentage,
    newBranches,
    coverageMap: state.branchHitCounts,
  };
}

/**
 * Check if an input provides new coverage
 */
export function providesNewCoverage(
  input: unknown,
  coverageBits: Set<string>,
  state: CoverageState
): boolean {
  for (const bit of coverageBits) {
    if (!state.discoveredBranches.has(bit)) {
      return true;
    }
  }
  return false;
}

/**
 * Simulate coverage tracking (for testing without actual instrumentation)
 */
export function simulateCoverage(input: unknown): Set<string> {
  const bits = new Set<string>();
  
  // Generate pseudo-coverage based on input structure
  if (input === null) {
    bits.add('null_path');
  } else if (input === undefined) {
    bits.add('undefined_path');
  } else if (typeof input === 'string') {
    bits.add('string_path');
    if (input.length === 0) bits.add('empty_string');
    if (input.length > 100) bits.add('long_string');
    if (input.includes('\x00')) bits.add('null_byte');
    if (input.includes('<script>')) bits.add('xss_pattern');
    if (input.includes("'")) bits.add('quote_pattern');
  } else if (typeof input === 'number') {
    bits.add('number_path');
    if (input === 0) bits.add('zero');
    if (input < 0) bits.add('negative');
    if (!Number.isFinite(input)) bits.add('special_number');
    if (Number.isNaN(input)) bits.add('nan');
  } else if (Array.isArray(input)) {
    bits.add('array_path');
    if (input.length === 0) bits.add('empty_array');
    if (input.length > 100) bits.add('large_array');
    if (input.some(x => x === null)) bits.add('array_with_null');
  } else if (typeof input === 'object') {
    bits.add('object_path');
    const keys = Object.keys(input);
    if (keys.length === 0) bits.add('empty_object');
    if (keys.includes('__proto__')) bits.add('proto_key');
    if (keys.includes('constructor')) bits.add('constructor_key');
  }

  return bits;
}
