/**
 * @intentos/generator-sdk
 *
 * SDK for building custom ISL code generators.
 *
 * This package provides the foundation for creating custom code generators
 * that transform ISL (Intent Specification Language) domains into any
 * target language or format.
 *
 * @example
 * ```typescript
 * import { Generator, EntityVisitorBase } from '@intentos/generator-sdk';
 *
 * class MyGenerator extends Generator {
 *   name = 'my-generator';
 *
 *   visitEntity(entity: EntityDeclaration): GeneratedFile[] {
 *     return [{
 *       path: `${entity.name.name}.custom.ts`,
 *       content: this.template('entity', { entity }),
 *     }];
 *   }
 *
 *   visitBehavior(behavior: BehaviorDeclaration): GeneratedFile[] {
 *     return [{
 *       path: `${behavior.name.name}.handler.ts`,
 *       content: this.template('behavior', { behavior }),
 *     }];
 *   }
 * }
 *
 * const generator = new MyGenerator();
 * const files = await generator.generate(domain);
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Generator
// ============================================================================

export { Generator, createGenerator, type GeneratorConfig } from './generator.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Generated files
  GeneratedFile,
  GenerationResult,
  GenerationWarning,

  // Options
  GeneratorOptions,
  GeneratorContext,

  // Visitor types
  VisitorResult,
  EntityVisitor,
  BehaviorVisitor,
  TypeVisitor,
  DomainVisitor,

  // Template types
  TemplateData,
  TemplateHelper,
  TemplateHelpers,

  // CLI types
  ScaffoldConfig,
  GeneratorManifest,

  // Re-exported ISL types
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  TypeExpression,
} from './types.js';

// ============================================================================
// Visitors
// ============================================================================

export {
  // Entity visitor
  EntityVisitorBase,
  createEntityVisitor,
  type EntityVisitorConfig,
} from './visitors/entity.js';

export {
  // Behavior visitor
  BehaviorVisitorBase,
  createBehaviorVisitor,
  type BehaviorVisitorConfig,
} from './visitors/behavior.js';

export {
  // Type visitor
  TypeVisitorBase,
  createTypeVisitor,
  type TypeVisitorConfig,
} from './visitors/type.js';

export {
  // Composite visitor
  CompositeVisitor,
  composeVisitors,
  type ComposeVisitorsConfig,
} from './visitors/composite.js';

// ============================================================================
// Templates
// ============================================================================

export { TemplateEngine } from './templates/engine.js';
export {
  defaultHelpers,
  registerCustomHelpers,
  type HelperDefinitions,
} from './templates/helpers.js';

// ============================================================================
// Output
// ============================================================================

export {
  FileWriter,
  createFileHeader,
  formatFileSize,
  type WriteOptions,
  type WriteResult,
} from './output/file.js';

export {
  MultiFileOutput,
  organizeFilesByType,
  organizeFilesByDirectory,
  sortFilesByPath,
  filterFilesByExtension,
  mergeFiles,
  type MultiFileConfig,
  type FileGroupConfig,
  type FileGroup,
} from './output/multi-file.js';

// ============================================================================
// CLI (for programmatic use)
// ============================================================================

export { scaffold, type ScaffoldOptions, type ScaffoldResult } from './cli/scaffold.js';
