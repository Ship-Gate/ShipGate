// ============================================================================
// @isl-lang/ui-generator — Public API
// ============================================================================

export { generateUI } from './generator.js';
export { mapDomain } from './mapper.js';
export { extractFieldValidation, extractBehaviorValidation } from './validation.js';
export type {
  GenerateUIOptions,
  GeneratedUIFile,
  DomainUIModel,
  EntityUIModel,
  FieldUIModel,
  BehaviorUIModel,
  ErrorUIModel,
  EnumUIModel,
  ValidationRule,
  ValidationType,
  FieldInputType,
} from './types.js';
