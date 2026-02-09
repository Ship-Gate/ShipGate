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

export {
  generateHandlers,
  generateHandlerSkeleton,
  generateServiceImpl,
  type GeneratedHandler,
} from './handlers.js';

export {
  generateTestStubs,
  type GeneratedTestFile,
} from './test-gen.js';

export {
  generateGoMod,
  generateDocGo,
  generateScaffold,
  type ScaffoldFile,
} from './scaffold.js';

// Re-export AST types for consumers
export type * from './ast-types.js';
