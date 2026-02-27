// ============================================================================
// C# Code Generator - Public API
// ============================================================================

// Main generator
export { generate, generateToDirectory } from './generator.js';

// Types
export type {
  DotNetFramework,
  WebFramework,
  ORMFramework,
  ValidationLibrary,
  SerializationFormat,
  CSharpGeneratorOptions,
  GeneratedFile,
  GenerationResult,
  CSharpTypeInfo,
  CSharpPropertyInfo,
  CSharpMethodInfo,
  CSharpParameterInfo,
  CSharpClassInfo,
} from './types.js';

export { DEFAULT_OPTIONS, ISL_TO_CSHARP_TYPES } from './types.js';

// Templates (for advanced usage)
export {
  generateModel,
  generateRecordModel,
  generateClassModel,
  generateUsings,
  generateXmlDoc,
  generateAttributes,
  generateProperty,
} from './templates/model.js';

export {
  generateFluentValidator,
  generateDataAnnotations,
  generateValidatorDIExtension,
  generateValidationMiddleware,
} from './templates/validator.js';

export {
  generateController,
  generateMinimalApiEndpoints,
} from './templates/controller.js';

export {
  generateServiceInterface,
  generateServiceImplementation,
  generateServiceDIExtension,
} from './templates/service.js';

export {
  generateRepositoryInterface,
  generateEFRepository,
  generateDbContext,
  generateRepositoryDIExtension,
} from './templates/repository.js';

export {
  generateCreateDto,
  generateUpdateDto,
  generateResponseDto,
} from './templates/dto.js';

export {
  generateModelTests,
  generateControllerTests,
  generateTestProjectFile,
  generateSolutionFile,
} from './templates/xunit.js';
