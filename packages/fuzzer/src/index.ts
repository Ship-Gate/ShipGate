// ============================================================================
// Fuzzer - Public API
// Intelligent fuzzing engine for finding edge cases and crashes
// ============================================================================

// Main fuzzer
export { Fuzzer, fuzz, fuzzWithType, fuzzBehavior } from './fuzzer.js';

// Types
export type {
  FuzzConfig,
  FuzzResult,
  FuzzTarget,
  FuzzContext,
  FuzzCategory,
  FuzzStrategy,
  Crash,
  CrashCategory,
  Hang,
  CoverageInfo,
  CorpusStats,
  CorpusEntry,
  GeneratedValue,
  MinimizeResult,
  FuzzReport,
  ReportSummary,
  CrashReport,
  HangReport,
  CoverageReport,
  ISLTypeInfo,
  ISLFieldInfo,
  ISLBehaviorInfo,
  ISLErrorInfo,
} from './types.js';

export { createRng, generateCrashId } from './types.js';

// Corpus management
export { Corpus, createCorpusFromSeeds, type SerializedCorpus } from './corpus.js';

// Minimizer
export { minimize, deltaDebug, type MinimizerConfig } from './minimizer.js';

// Reporter
export { 
  generateReport, 
  formatMarkdown, 
  formatJson, 
  printReport 
} from './reporter.js';

// Generators
export { 
  generateStrings,
  mutateString,
  INJECTION_PAYLOADS,
  SPECIAL_CHARS,
  UNICODE_EDGE_CASES,
} from './generators/string.js';

export {
  generateIntegers,
  generateFloats,
  generateArrayIndexFuzz,
  generateArithmeticFuzz,
  mutateNumber,
  isInterestingNumber,
  INTEGER_BOUNDARIES,
  FLOAT_EDGE_CASES,
  NUMBER_LIMITS,
} from './generators/number.js';

export {
  generateArrays,
  generateObjects,
  generateMaps,
  generateNestedStructures,
  generateCircularReference,
  generateCircularArray,
  mutateObject,
  mutateArray,
  PROTOTYPE_POLLUTION_PAYLOADS,
  OBJECT_KEY_EDGE_CASES,
} from './generators/structure.js';

export {
  generateForType,
  generateBehaviorInputs,
} from './generators/semantic.js';

// Strategies
export { generateRandom, mutateRandomly } from './strategies/random.js';
export { generateBoundaryValues } from './strategies/boundary.js';
export { generateMutations, mutateValue, applyMutation } from './strategies/mutation.js';
export { 
  generateCoverageGuided,
  createCoverageState,
  updateCoverage,
  calculateEnergy,
  generateCoverageReport,
  providesNewCoverage,
  simulateCoverage,
} from './strategies/coverage.js';
