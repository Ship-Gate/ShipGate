// ============================================================================
// ISL Rust Code Generator - Public API
// ============================================================================

export { generateRustCode, type GeneratorOptions, type GeneratedFile } from './generator';
export {
  mapType,
  mapPrimitiveType,
  toRustTypeName,
  toSnakeCase,
  toScreamingSnakeCase,
  mergeImports,
  generateImports,
  type RustType,
  type RustImport,
} from './types';
export {
  generateEntityStruct,
  generateTypeDeclaration,
  generateEnum,
  generateStruct,
  generateUnion,
  generateLifecycleEnum,
  type GeneratedStruct,
} from './structs';
export {
  generateBehaviorTrait,
  generateCombinedServiceTrait,
  generateMockImplementation,
  type GeneratedTrait,
} from './traits';
export {
  generateSerdeDerives,
  generateSerdeContainerAttrs,
  generateSerdeFieldAttrs,
  generateSerdeImports,
  generateDeriveAttribute,
  type SerdeConfig,
  DEFAULT_SERDE_CONFIG,
} from './serde';
export {
  generateValidationDerives,
  generateValidationFieldAttrs,
  generateValidatorImports,
  generateValidatedNewtype,
  generateCustomValidator,
  type ValidationConfig,
  DEFAULT_VALIDATION_CONFIG,
} from './validation';

// Re-export AST types for consumers
export type {
  Domain,
  Entity,
  Behavior,
  TypeDeclaration,
  TypeDefinition,
  Field,
  EnumType,
  StructType,
  UnionType,
} from './ast-types';

// ============================================================================
// Main API Function
// ============================================================================

import { generateRustCode, type GeneratorOptions, type GeneratedFile } from './generator';
import type { Domain } from './ast-types';

/**
 * Generate Rust code from an ISL Domain AST
 *
 * @param domain - The parsed Domain AST node
 * @param options - Generator options including output directory and crate name
 * @returns Array of generated files with paths and contents
 *
 * @example
 * ```typescript
 * import { generate } from '@isl-lang/codegen-rust';
 *
 * const files = generate(domainAST, {
 *   outputDir: './generated',
 *   crateName: 'my_service',
 * });
 *
 * for (const file of files) {
 *   console.log(`Generated: ${file.path}`);
 * }
 * ```
 */
export function generate(
  domain: Domain,
  options: { outputDir: string; crateName: string }
): GeneratedFile[] {
  return generateRustCode(domain, options);
}
