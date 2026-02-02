/**
 * Base Generator Class
 *
 * Provides the foundation for building custom ISL code generators.
 * Implements the visitor pattern for processing domain elements.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
} from '@isl-lang/isl-core';

import type {
  GeneratedFile,
  GenerationResult,
  GenerationWarning,
  GeneratorOptions,
  GeneratorContext,
  VisitorResult,
  TemplateHelpers,
} from './types.js';

import { TemplateEngine } from './templates/engine.js';
import { defaultHelpers } from './templates/helpers.js';
import { FileWriter, type WriteOptions } from './output/file.js';

// ============================================================================
// Base Generator Class
// ============================================================================

/**
 * Abstract base class for ISL code generators.
 *
 * Extend this class to create custom generators:
 *
 * @example
 * ```typescript
 * class MyGenerator extends Generator {
 *   name = 'my-generator';
 *   version = '1.0.0';
 *
 *   visitEntity(entity: EntityDeclaration): GeneratedFile[] {
 *     return [{
 *       path: `${entity.name.name}.ts`,
 *       content: this.template('entity', { entity }),
 *     }];
 *   }
 * }
 * ```
 */
export abstract class Generator {
  /** Generator name (used for identification) */
  abstract readonly name: string;

  /** Generator version */
  version: string = '1.0.0';

  /** Generator description */
  description: string = '';

  /** Target language(s) this generator produces */
  targetLanguages: string[] = [];

  /** Default file extension for generated files */
  defaultExtension: string = '.ts';

  /** Template engine instance */
  protected templateEngine: TemplateEngine;

  /** Custom template helpers */
  protected helpers: TemplateHelpers = {};

  /** Warnings collected during generation */
  protected warnings: GenerationWarning[] = [];

  /** Current generator context */
  protected context!: GeneratorContext;

  /** File writer for output */
  protected fileWriter: FileWriter;

  constructor() {
    this.templateEngine = new TemplateEngine();
    this.fileWriter = new FileWriter();
    this.registerDefaultHelpers();
  }

  // ==========================================================================
  // Main Generation API
  // ==========================================================================

  /**
   * Generate code from an ISL domain.
   *
   * This is the main entry point for generation. It processes the domain
   * and returns all generated files.
   *
   * @param domain - The parsed ISL domain
   * @param options - Generation options
   * @returns Generation result with all files
   */
  async generate(
    domain: DomainDeclaration,
    options: GeneratorOptions = {}
  ): Promise<GenerationResult> {
    // Reset state
    this.warnings = [];

    // Create context
    this.context = this.createContext(domain, options);

    // Register custom helpers
    this.registerHelpers();

    // Load templates
    await this.loadTemplates(options.templateDir);

    // Collect all generated files
    const files: GeneratedFile[] = [];

    // Domain-level generation
    files.push(...this.normalizeResult(this.visitDomain(domain)));

    // Process types and enums
    files.push(...this.normalizeResult(this.beforeTypes(domain.types, domain.enums)));
    for (const typeDecl of domain.types) {
      files.push(...this.normalizeResult(this.visitType(typeDecl)));
    }
    for (const enumDecl of domain.enums) {
      files.push(...this.normalizeResult(this.visitEnum(enumDecl)));
    }
    files.push(...this.normalizeResult(this.afterTypes(domain.types, domain.enums)));

    // Process entities
    files.push(...this.normalizeResult(this.beforeEntities(domain.entities)));
    for (const entity of domain.entities) {
      files.push(...this.normalizeResult(this.visitEntity(entity)));
    }
    files.push(...this.normalizeResult(this.afterEntities(domain.entities)));

    // Process behaviors
    files.push(...this.normalizeResult(this.beforeBehaviors(domain.behaviors)));
    for (const behavior of domain.behaviors) {
      files.push(...this.normalizeResult(this.visitBehavior(behavior)));
    }
    files.push(...this.normalizeResult(this.afterBehaviors(domain.behaviors)));

    // Finalization
    files.push(...this.normalizeResult(this.finalize(domain)));

    return {
      files: files.filter((f) => f.content.trim().length > 0),
      domain: domain.name.name,
      generator: this.name,
      generatedAt: new Date(),
      warnings: this.warnings,
      metadata: this.getMetadata(),
    };
  }

  /**
   * Generate and write files to disk.
   *
   * @param domain - The parsed ISL domain
   * @param options - Generation and write options
   */
  async generateAndWrite(
    domain: DomainDeclaration,
    options: GeneratorOptions & Partial<WriteOptions> = {}
  ): Promise<GenerationResult> {
    const result = await this.generate(domain, options);

    if (options.outputDir) {
      await this.fileWriter.writeFiles(result.files, {
        outputDir: options.outputDir,
        overwrite: options.overwrite ?? true,
        dryRun: options.dryRun,
      });
    }

    return result;
  }

  // ==========================================================================
  // Visitor Methods (Override in subclasses)
  // ==========================================================================

  /**
   * Visit the entire domain.
   * Override to generate domain-level files (e.g., index, config).
   */
  protected visitDomain(_domain: DomainDeclaration): VisitorResult {
    return null;
  }

  /**
   * Visit an entity declaration.
   * Override to generate entity-specific files.
   */
  protected visitEntity(_entity: EntityDeclaration): VisitorResult {
    return null;
  }

  /**
   * Visit a behavior declaration.
   * Override to generate behavior-specific files.
   */
  protected visitBehavior(_behavior: BehaviorDeclaration): VisitorResult {
    return null;
  }

  /**
   * Visit a type declaration.
   * Override to generate type-specific files.
   */
  protected visitType(_type: TypeDeclaration): VisitorResult {
    return null;
  }

  /**
   * Visit an enum declaration.
   * Override to generate enum-specific files.
   */
  protected visitEnum(_enumDecl: EnumDeclaration): VisitorResult {
    return null;
  }

  // ==========================================================================
  // Lifecycle Hooks (Override for pre/post processing)
  // ==========================================================================

  /**
   * Called before processing any entities.
   */
  protected beforeEntities(_entities: EntityDeclaration[]): VisitorResult {
    return null;
  }

  /**
   * Called after processing all entities.
   */
  protected afterEntities(_entities: EntityDeclaration[]): VisitorResult {
    return null;
  }

  /**
   * Called before processing any behaviors.
   */
  protected beforeBehaviors(_behaviors: BehaviorDeclaration[]): VisitorResult {
    return null;
  }

  /**
   * Called after processing all behaviors.
   */
  protected afterBehaviors(_behaviors: BehaviorDeclaration[]): VisitorResult {
    return null;
  }

  /**
   * Called before processing any types.
   */
  protected beforeTypes(
    _types: TypeDeclaration[],
    _enums: EnumDeclaration[]
  ): VisitorResult {
    return null;
  }

  /**
   * Called after processing all types.
   */
  protected afterTypes(
    _types: TypeDeclaration[],
    _enums: EnumDeclaration[]
  ): VisitorResult {
    return null;
  }

  /**
   * Called after all processing is complete.
   * Use for generating index files, manifests, etc.
   */
  protected finalize(_domain: DomainDeclaration): VisitorResult {
    return null;
  }

  // ==========================================================================
  // Template Methods
  // ==========================================================================

  /**
   * Render a template with the given data.
   *
   * @param templateName - Name of the template (without extension)
   * @param data - Data to pass to the template
   * @returns Rendered template string
   */
  protected template(templateName: string, data: Record<string, unknown> = {}): string {
    return this.templateEngine.render(templateName, {
      ...data,
      domain: this.context.domain,
      options: this.context.options,
      generator: {
        name: this.name,
        version: this.version,
      },
    });
  }

  /**
   * Render an inline template string.
   *
   * @param source - Template source string
   * @param data - Data to pass to the template
   * @returns Rendered string
   */
  protected inlineTemplate(source: string, data: Record<string, unknown> = {}): string {
    return this.templateEngine.renderInline(source, {
      ...data,
      domain: this.context.domain,
      options: this.context.options,
    });
  }

  /**
   * Load templates from a directory.
   *
   * @param templateDir - Directory containing templates
   */
  protected async loadTemplates(templateDir?: string): Promise<void> {
    if (templateDir) {
      await this.templateEngine.loadFromDirectory(templateDir);
    }
  }

  /**
   * Register a template from a string.
   *
   * @param name - Template name
   * @param source - Template source
   */
  protected registerTemplate(name: string, source: string): void {
    this.templateEngine.registerTemplate(name, source);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Override to register custom template helpers.
   */
  protected registerHelpers(): void {
    // Subclasses can override to add custom helpers
    for (const [name, helper] of Object.entries(this.helpers)) {
      this.templateEngine.registerHelper(name, helper);
    }
  }

  /**
   * Add a warning to the generation result.
   */
  protected warn(message: string, location?: string): void {
    this.warnings.push({ message, location, severity: 'warning' });
  }

  /**
   * Add an info message to the generation result.
   */
  protected info(message: string, location?: string): void {
    this.warnings.push({ message, location, severity: 'info' });
  }

  /**
   * Add a deprecation warning.
   */
  protected deprecate(message: string, location?: string): void {
    this.warnings.push({ message, location, severity: 'deprecation' });
  }

  /**
   * Get generator metadata.
   * Override to add custom metadata to the result.
   */
  protected getMetadata(): Record<string, unknown> {
    return {
      generatorName: this.name,
      generatorVersion: this.version,
      targetLanguages: this.targetLanguages,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createContext(
    domain: DomainDeclaration,
    options: GeneratorOptions
  ): GeneratorContext {
    return {
      domain,
      options: {
        comments: true,
        overwrite: true,
        fileExtension: this.defaultExtension,
        ...options,
      },
      data: {},
      helpers: { ...defaultHelpers, ...this.helpers },
    };
  }

  private registerDefaultHelpers(): void {
    for (const [name, helper] of Object.entries(defaultHelpers)) {
      this.templateEngine.registerHelper(name, helper);
    }
  }

  private normalizeResult(result: VisitorResult): GeneratedFile[] {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    return [result];
  }
}

// ============================================================================
// Generator Factory
// ============================================================================

/**
 * Create a simple generator from configuration.
 *
 * @example
 * ```typescript
 * const generator = createGenerator({
 *   name: 'simple-gen',
 *   templates: {
 *     entity: '// Entity: {{entity.name.name}}',
 *   },
 *   visitEntity: (entity) => ({
 *     path: `${entity.name.name}.ts`,
 *     content: generator.template('entity', { entity }),
 *   }),
 * });
 * ```
 */
export interface GeneratorConfig {
  name: string;
  version?: string;
  description?: string;
  targetLanguages?: string[];
  defaultExtension?: string;
  templates?: Record<string, string>;
  helpers?: TemplateHelpers;
  visitDomain?: (domain: DomainDeclaration, ctx: GeneratorContext) => VisitorResult;
  visitEntity?: (entity: EntityDeclaration, ctx: GeneratorContext) => VisitorResult;
  visitBehavior?: (behavior: BehaviorDeclaration, ctx: GeneratorContext) => VisitorResult;
  visitType?: (type: TypeDeclaration, ctx: GeneratorContext) => VisitorResult;
  visitEnum?: (enumDecl: EnumDeclaration, ctx: GeneratorContext) => VisitorResult;
  finalize?: (domain: DomainDeclaration, ctx: GeneratorContext) => VisitorResult;
}

/**
 * Create a generator from a configuration object.
 */
export function createGenerator(config: GeneratorConfig): Generator {
  class ConfiguredGenerator extends Generator {
    readonly name = config.name;
    version = config.version ?? '1.0.0';
    description = config.description ?? '';
    targetLanguages = config.targetLanguages ?? [];
    defaultExtension = config.defaultExtension ?? '.ts';
    helpers = config.helpers ?? {};

    constructor() {
      super();
      // Register inline templates
      if (config.templates) {
        for (const [name, source] of Object.entries(config.templates)) {
          this.registerTemplate(name, source);
        }
      }
    }

    protected visitDomain(domain: DomainDeclaration): VisitorResult {
      return config.visitDomain?.(domain, this.context) ?? null;
    }

    protected visitEntity(entity: EntityDeclaration): VisitorResult {
      return config.visitEntity?.(entity, this.context) ?? null;
    }

    protected visitBehavior(behavior: BehaviorDeclaration): VisitorResult {
      return config.visitBehavior?.(behavior, this.context) ?? null;
    }

    protected visitType(type: TypeDeclaration): VisitorResult {
      return config.visitType?.(type, this.context) ?? null;
    }

    protected visitEnum(enumDecl: EnumDeclaration): VisitorResult {
      return config.visitEnum?.(enumDecl, this.context) ?? null;
    }

    protected finalize(domain: DomainDeclaration): VisitorResult {
      return config.finalize?.(domain, this.context) ?? null;
    }
  }

  return new ConfiguredGenerator();
}
