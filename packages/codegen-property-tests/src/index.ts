// ============================================================================
// ISL Property Test Generator
// Generates property-based tests using fast-check from ISL specifications
// ============================================================================

export { generate } from './generator.js';

// Types
export type {
  GenerateOptions,
  GeneratedFile,
  ArbitraryDefinition,
  PropertyDefinition,
  ConstraintInfo,
  TypeMapping,
  ShrinkerDefinition,
} from './types.js';

// Arbitraries
export {
  generateArbitrary,
  generateTypeArbitrary,
  generateEntityArbitrary,
  generateInputArbitrary,
  generateAllArbitraries,
} from './arbitraries.js';

// Properties
export {
  generateEntityInvariantProperties,
  generatePostconditionProperties,
  generateBehaviorInvariantProperties,
  generatePreconditionProperties,
  generateGlobalInvariantProperties,
  generateIdempotencyProperty,
  generateRoundTripProperty,
  generateAllProperties,
} from './properties.js';

// Shrinking
export {
  generateShrinker,
  generateShrinkerUtils,
  generateAllShrinkers,
} from './shrinking.js';

// Templates
export {
  getFastCheckTemplate,
  generatePropertyTest,
  generatePropertyDescribe,
  generateArbitraryDeclaration,
  generateCompositeArbitrary,
  generateRecordArbitrary,
  generateOneOfArbitrary,
  generateFilteredArbitrary,
  generateMappedArbitrary,
  generateChainedArbitrary,
  generateImports,
  generateTestFileContent,
} from './templates/fastcheck.js';
