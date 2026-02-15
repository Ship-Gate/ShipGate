// ============================================================================
// @isl-lang/frontend-generator
// ============================================================================

export { FrontendGenerator } from './generator.js';
export type {
  FrontendGeneratorOptions,
  GeneratedFrontendFile,
  FrontendGenerationResult,
  ComponentMappingConfig,
  MappedField,
  FieldInputType,
} from './types.js';
export {
  SHADCN_COMPONENTS,
  SHADCN_INSTALL_CMD,
  mapFieldType,
  mapFieldToMapped,
  DEFAULT_MAPPING,
} from './component-mapping.js';
