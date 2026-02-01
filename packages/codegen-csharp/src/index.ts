// ============================================================================
// C# Code Generator - Public API
// ============================================================================

// Main generator
export { generate, generateToDirectory } from './generator';

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
} from './types';

export { DEFAULT_OPTIONS, ISL_TO_CSHARP_TYPES } from './types';

// Templates (for advanced usage)
export {
  generateModel,
  generateRecordModel,
  generateClassModel,
  generateUsings,
  generateXmlDoc,
  generateAttributes,
  generateProperty,
} from './templates/model';

export {
  generateFluentValidator,
  generateDataAnnotations,
  generateValidatorDIExtension,
  generateValidationMiddleware,
} from './templates/validator';

export {
  generateController,
  generateMinimalApiEndpoints,
} from './templates/controller';

export {
  generateServiceInterface,
  generateServiceImplementation,
  generateServiceDIExtension,
} from './templates/service';

export {
  generateRepositoryInterface,
  generateEFRepository,
  generateDbContext,
  generateRepositoryDIExtension,
} from './templates/repository';
