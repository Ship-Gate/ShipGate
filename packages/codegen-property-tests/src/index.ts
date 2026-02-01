// ============================================================================
// ISL Property Test Generator
// Generates property-based tests using fast-check from ISL specifications
// ============================================================================

export { generate } from './generator';

// Types
export type {
  GenerateOptions,
  GeneratedFile,
  ArbitraryDefinition,
  PropertyDefinition,
  ConstraintInfo,
  TypeMapping,
  ShrinkerDefinition,
} from './types';

// Arbitraries
export {
  generateArbitrary,
  generateTypeArbitrary,
  generateEntityArbitrary,
  generateInputArbitrary,
  generateAllArbitraries,
} from './arbitraries';

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
} from './properties';

// Shrinking
export {
  generateShrinker,
  generateShrinkerUtils,
  generateAllShrinkers,
} from './shrinking';

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
} from './templates/fastcheck';
