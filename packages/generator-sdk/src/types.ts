/**
 * Generator SDK Types
 *
 * Core type definitions for the ISL Generator SDK.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  TypeExpression,
} from '@isl-lang/isl-core';

// ============================================================================
// Generated File Types
// ============================================================================

/**
 * Represents a single generated file
 */
export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  /** Generated file contents */
  content: string;
  /** Optional file type for categorization */
  type?: string;
  /** Whether this file should be overwritten if it exists */
  overwrite?: boolean;
  /** File permissions (octal string, e.g., '755') */
  permissions?: string;
}

/**
 * Result of a complete generation run
 */
export interface GenerationResult {
  /** All generated files */
  files: GeneratedFile[];
  /** Domain name that was processed */
  domain: string;
  /** Generator name that produced the output */
  generator: string;
  /** Generation timestamp */
  generatedAt: Date;
  /** Any warnings produced during generation */
  warnings: GenerationWarning[];
  /** Metadata about the generation */
  metadata: Record<string, unknown>;
}

/**
 * Warning produced during generation
 */
export interface GenerationWarning {
  /** Warning message */
  message: string;
  /** Source location (if applicable) */
  location?: string;
  /** Warning severity */
  severity: 'info' | 'warning' | 'deprecation';
}

// ============================================================================
// Generator Options
// ============================================================================

/**
 * Options for a generator
 */
export interface GeneratorOptions {
  /** Output directory for generated files */
  outputDir?: string;
  /** Whether to include comments in output */
  comments?: boolean;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  /** File extension for output files */
  fileExtension?: string;
  /** Template directory override */
  templateDir?: string;
  /** Custom options specific to the generator */
  custom?: Record<string, unknown>;
}

/**
 * Context passed to visitors and templates
 */
export interface GeneratorContext {
  /** The domain being processed */
  domain: DomainDeclaration;
  /** Generator options */
  options: GeneratorOptions;
  /** Custom data from the generator */
  data: Record<string, unknown>;
  /** Helper functions */
  helpers: Record<string, (...args: unknown[]) => unknown>;
}

// ============================================================================
// Visitor Types
// ============================================================================

/**
 * Result from a visitor method
 */
export type VisitorResult = GeneratedFile | GeneratedFile[] | null | void;

/**
 * Entity visitor interface
 */
export interface EntityVisitor {
  /** Visit an entity declaration */
  visitEntity(entity: EntityDeclaration, context: GeneratorContext): VisitorResult;
  /** Optional: Pre-visit hook for all entities */
  beforeEntities?(entities: EntityDeclaration[], context: GeneratorContext): VisitorResult;
  /** Optional: Post-visit hook for all entities */
  afterEntities?(entities: EntityDeclaration[], context: GeneratorContext): VisitorResult;
}

/**
 * Behavior visitor interface
 */
export interface BehaviorVisitor {
  /** Visit a behavior declaration */
  visitBehavior(behavior: BehaviorDeclaration, context: GeneratorContext): VisitorResult;
  /** Optional: Pre-visit hook for all behaviors */
  beforeBehaviors?(behaviors: BehaviorDeclaration[], context: GeneratorContext): VisitorResult;
  /** Optional: Post-visit hook for all behaviors */
  afterBehaviors?(behaviors: BehaviorDeclaration[], context: GeneratorContext): VisitorResult;
}

/**
 * Type visitor interface
 */
export interface TypeVisitor {
  /** Visit a type declaration */
  visitType(type: TypeDeclaration, context: GeneratorContext): VisitorResult;
  /** Visit an enum declaration */
  visitEnum(enumDecl: EnumDeclaration, context: GeneratorContext): VisitorResult;
  /** Optional: Pre-visit hook for all types */
  beforeTypes?(types: TypeDeclaration[], enums: EnumDeclaration[], context: GeneratorContext): VisitorResult;
  /** Optional: Post-visit hook for all types */
  afterTypes?(types: TypeDeclaration[], enums: EnumDeclaration[], context: GeneratorContext): VisitorResult;
}

/**
 * Domain visitor interface (for domain-level generation)
 */
export interface DomainVisitor {
  /** Visit the entire domain */
  visitDomain(domain: DomainDeclaration, context: GeneratorContext): VisitorResult;
  /** Optional: Pre-visit hook */
  beforeDomain?(domain: DomainDeclaration, context: GeneratorContext): VisitorResult;
  /** Optional: Post-visit hook */
  afterDomain?(domain: DomainDeclaration, context: GeneratorContext): VisitorResult;
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Template data passed to templates
 */
export interface TemplateData {
  /** The item being rendered (entity, behavior, type, etc.) */
  item: unknown;
  /** The full domain */
  domain: DomainDeclaration;
  /** Generator options */
  options: GeneratorOptions;
  /** Custom data */
  [key: string]: unknown;
}

/**
 * Template helper function signature
 */
export type TemplateHelper = (this: unknown, ...args: unknown[]) => unknown;

/**
 * Collection of template helpers
 */
export interface TemplateHelpers {
  [name: string]: TemplateHelper;
}

// ============================================================================
// CLI Types
// ============================================================================

/**
 * Configuration for scaffolding a new generator
 */
export interface ScaffoldConfig {
  /** Generator name (e.g., 'my-generator') */
  name: string;
  /** Generator description */
  description?: string;
  /** Target language for generated code */
  targetLanguage?: string;
  /** Output directory */
  outputDir: string;
  /** Include example templates */
  includeExamples?: boolean;
  /** Package manager to use */
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

/**
 * Generator manifest (for plugin discovery)
 */
export interface GeneratorManifest {
  /** Generator name */
  name: string;
  /** Version */
  version: string;
  /** Description */
  description: string;
  /** Target language(s) */
  targetLanguages: string[];
  /** Entry point */
  main: string;
  /** Required ISL features */
  requiredFeatures?: string[];
}

// ============================================================================
// Re-exports from ISL Core
// ============================================================================

export type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  TypeExpression,
};
