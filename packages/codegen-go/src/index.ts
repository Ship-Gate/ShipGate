// ============================================================================
// Go Code Generator - Public API
// ============================================================================

export {
  generate,
  type GeneratorOptions,
  type GeneratedFile,
  type GeneratorResult,
} from './generator.js';

export {
  mapType,
  toGoName,
  toGoPrivateName,
  toSnakeCase,
  toScreamingSnakeCase,
  type GoImports,
  type GoTypeResult,
} from './types.js';

export {
  generateEntityStruct,
  generateTypeStruct,
  generateEnum,
  generateUnionInterface,
  generateLifecycleMethods,
  type GeneratedStruct,
  type GeneratedEnum,
} from './structs.js';

export {
  generateServiceInterface,
  generateInputStruct,
  generateOutputStruct,
  generateErrorType,
  generateBehaviorTypes,
  type GeneratedInterface,
  type GeneratedBehaviorTypes,
} from './interfaces.js';

export {
  generateValidationTag,
  generateRegexValidator,
  generateValidatorRegistration,
  generateStructValidator,
} from './validation.js';

// Re-export AST types for consumers
export type * from './ast-types.js';
