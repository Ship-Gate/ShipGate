/**
 * Zod Validation Generator
 * 
 * Generates Zod schemas from ISL domain definitions for runtime validation.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  BehaviorDeclaration,
  FieldDeclaration,
  TypeExpression,
  TypeConstraint,
  InputBlock,
  OutputBlock,
} from '@intentos/isl-core';

import type { GeneratorOptions } from './generator.js';

// ============================================================================
// Zod Generator
// ============================================================================

export class ZodGenerator {
  private output: string[] = [];
  private indent = 0;
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate Zod schemas from a domain
   */
  generate(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    // Header and imports
    this.writeHeader(domain);
    this.writeImports();

    // Enum schemas
    for (const enumDecl of domain.enums) {
      this.generateEnumSchema(enumDecl);
      this.writeLine('');
    }

    // Type schemas
    for (const typeDecl of domain.types) {
      this.generateTypeSchema(typeDecl);
      this.writeLine('');
    }

    // Entity schemas
    for (const entity of domain.entities) {
      this.generateEntitySchema(entity);
      this.writeLine('');
    }

    // Behavior input/output schemas
    for (const behavior of domain.behaviors) {
      this.generateBehaviorSchemas(behavior);
      this.writeLine('');
    }

    // Export validation utilities
    this.generateValidationUtils(domain);

    return this.output.join('\n');
  }

  // --------------------------------------------------------------------------
  // Header and Imports
  // --------------------------------------------------------------------------

  private writeHeader(domain: DomainDeclaration): void {
    if (this.options.comments) {
      this.writeLine('/**');
      this.writeLine(` * Generated Zod validation schemas for ${domain.name.name} domain`);
      if (domain.version) {
        this.writeLine(` * Version: ${domain.version.value}`);
      }
      this.writeLine(' * ');
      this.writeLine(' * DO NOT EDIT - This file is auto-generated from ISL');
      this.writeLine(` * Generated at: ${new Date().toISOString()}`);
      this.writeLine(' */');
      this.writeLine('');
    }
  }

  private writeImports(): void {
    this.writeLine("import { z } from 'zod';");
    this.writeLine("import type * as Types from './types.js';");
    this.writeLine('');
    this.writeLine('// ============================================================================');
    this.writeLine('// Base Schemas');
    this.writeLine('// ============================================================================');
    this.writeLine('');
    this.writeLine('/** UUID schema */');
    this.writeLine('export const UUIDSchema = z.string().uuid();');
    this.writeLine('');
    this.writeLine('/** ISO 8601 timestamp schema */');
    this.writeLine('export const TimestampSchema = z.string().datetime();');
    this.writeLine('');
    this.writeLine('/** Duration in milliseconds */');
    this.writeLine('export const DurationSchema = z.number().int().nonnegative();');
    this.writeLine('');
    this.writeLine('/** Decimal as string for precision */');
    this.writeLine('export const DecimalSchema = z.string().regex(/^-?\\d+(\\.\\d+)?$/);');
    this.writeLine('');
    this.writeLine('/** Money schema */');
    this.writeLine('export const MoneySchema = z.object({');
    this.indent++;
    this.writeLine('amount: DecimalSchema,');
    this.writeLine('currency: z.string().length(3),');
    this.indent--;
    this.writeLine('});');
    this.writeLine('');
  }

  // --------------------------------------------------------------------------
  // Enum Schema Generation
  // --------------------------------------------------------------------------

  private generateEnumSchema(decl: EnumDeclaration): void {
    const values = decl.variants.map(v => `'${v.name}'`).join(', ');

    if (this.options.comments) {
      this.writeLine(`/** Schema for ${decl.name.name} enum */`);
    }

    this.writeLine(`export const ${decl.name.name}Schema = z.enum([${values}]);`);
  }

  // --------------------------------------------------------------------------
  // Type Schema Generation
  // --------------------------------------------------------------------------

  private generateTypeSchema(decl: TypeDeclaration): void {
    if (this.options.comments) {
      this.writeLine(`/** Schema for ${decl.name.name} type */`);
    }

    let schema = this.typeExprToZod(decl.baseType);

    // Apply constraints
    for (const constraint of decl.constraints) {
      schema = this.applyConstraint(schema, constraint);
    }

    this.writeLine(`export const ${decl.name.name}Schema = ${schema};`);

    // Generate parse/validate functions
    this.writeLine('');
    this.writeLine(`export function parse${decl.name.name}(value: unknown): Types.${decl.name.name} {`);
    this.indent++;
    this.writeLine(`return ${decl.name.name}Schema.parse(value) as Types.${decl.name.name};`);
    this.indent--;
    this.writeLine('}');

    this.writeLine('');
    this.writeLine(`export function is${decl.name.name}(value: unknown): value is Types.${decl.name.name} {`);
    this.indent++;
    this.writeLine(`return ${decl.name.name}Schema.safeParse(value).success;`);
    this.indent--;
    this.writeLine('}');
  }

  private applyConstraint(schema: string, constraint: TypeConstraint): string {
    const name = constraint.name.name;
    const value = this.constraintValueToString(constraint);

    switch (name) {
      case 'min':
      case 'min_value':
        return `${schema}.min(${value})`;
      case 'max':
      case 'max_value':
        return `${schema}.max(${value})`;
      case 'min_length':
        return `${schema}.min(${value})`;
      case 'max_length':
        return `${schema}.max(${value})`;
      case 'length':
        return `${schema}.length(${value})`;
      case 'pattern':
      case 'format':
        return `${schema}.regex(${value})`;
      case 'email':
        return `${schema}.email()`;
      case 'url':
        return `${schema}.url()`;
      case 'uuid':
        return `${schema}.uuid()`;
      case 'precision':
        // For decimals, handled in DecimalSchema
        return schema;
      default:
        return schema;
    }
  }

  // --------------------------------------------------------------------------
  // Entity Schema Generation
  // --------------------------------------------------------------------------

  private generateEntitySchema(entity: EntityDeclaration): void {
    if (this.options.comments) {
      this.writeLine(`/** Schema for ${entity.name.name} entity */`);
    }

    this.writeLine(`export const ${entity.name.name}Schema = z.object({`);
    this.indent++;

    for (const field of entity.fields) {
      this.generateFieldSchema(field);
    }

    this.indent--;
    this.writeLine('});');

    // Generate create input schema (omit computed/auto fields)
    this.writeLine('');
    this.writeLine(`/** Schema for creating ${entity.name.name} */`);
    this.writeLine(`export const ${entity.name.name}CreateInputSchema = z.object({`);
    this.indent++;

    for (const field of entity.fields) {
      if (!this.hasAnnotation(field, 'computed') && !this.isAutoField(field)) {
        this.generateFieldSchema(field);
      }
    }

    this.indent--;
    this.writeLine('});');

    // Generate update input schema (partial, mutable fields only)
    this.writeLine('');
    this.writeLine(`/** Schema for updating ${entity.name.name} */`);
    const mutableFields = entity.fields.filter(
      f => !this.hasAnnotation(f, 'immutable') && !this.hasAnnotation(f, 'computed')
    );

    if (mutableFields.length > 0) {
      this.writeLine(`export const ${entity.name.name}UpdateInputSchema = z.object({`);
      this.indent++;
      for (const field of mutableFields) {
        const schema = this.fieldToZod(field);
        this.writeLine(`${field.name.name}: ${schema}.optional(),`);
      }
      this.indent--;
      this.writeLine('});');
    } else {
      this.writeLine(`export const ${entity.name.name}UpdateInputSchema = z.object({});`);
    }

    // Type inference helpers
    this.writeLine('');
    this.writeLine(`export type ${entity.name.name}Validated = z.infer<typeof ${entity.name.name}Schema>;`);
  }

  private generateFieldSchema(field: FieldDeclaration): void {
    let schema = this.fieldToZod(field);

    if (field.optional) {
      schema = `${schema}.optional()`;
    }

    this.writeLine(`${field.name.name}: ${schema},`);
  }

  private fieldToZod(field: FieldDeclaration): string {
    let schema = this.typeExprToZod(field.type);

    // Apply field-level constraints
    for (const constraint of field.constraints) {
      schema = this.applyConstraint(schema, constraint);
    }

    return schema;
  }

  // --------------------------------------------------------------------------
  // Behavior Schema Generation
  // --------------------------------------------------------------------------

  private generateBehaviorSchemas(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (this.options.comments) {
      this.writeLine('// ' + '='.repeat(76));
      this.writeLine(`// Behavior: ${name}`);
      this.writeLine('// ' + '='.repeat(76));
      this.writeLine('');
    }

    // Input schema
    if (behavior.input) {
      this.generateInputSchema(name, behavior.input);
      this.writeLine('');
    }

    // Output/Error schemas
    if (behavior.output) {
      this.generateOutputSchemas(name, behavior.output);
      this.writeLine('');
    }

    // Generate validate function
    this.generateBehaviorValidator(behavior);
  }

  private generateInputSchema(behaviorName: string, input: InputBlock): void {
    this.writeLine(`/** Input schema for ${behaviorName} */`);
    this.writeLine(`export const ${behaviorName}InputSchema = z.object({`);
    this.indent++;

    for (const field of input.fields) {
      this.generateFieldSchema(field);
    }

    this.indent--;
    this.writeLine('});');

    this.writeLine('');
    this.writeLine(`export type ${behaviorName}InputValidated = z.infer<typeof ${behaviorName}InputSchema>;`);
  }

  private generateOutputSchemas(behaviorName: string, output: OutputBlock): void {
    // Error code schema
    if (output.errors.length > 0) {
      const codes = output.errors.map(e => `'${e.name.name}'`).join(', ');
      this.writeLine(`/** Error code schema for ${behaviorName} */`);
      this.writeLine(`export const ${behaviorName}ErrorCodeSchema = z.enum([${codes}]);`);
      this.writeLine('');

      // Error schema
      this.writeLine(`/** Error schema for ${behaviorName} */`);
      this.writeLine(`export const ${behaviorName}ErrorSchema = z.object({`);
      this.indent++;
      this.writeLine(`code: ${behaviorName}ErrorCodeSchema,`);
      this.writeLine('message: z.string(),');
      this.writeLine('retriable: z.boolean(),');
      this.writeLine('retryAfter: z.number().optional(),');
      this.writeLine('details: z.record(z.unknown()).optional(),');
      this.indent--;
      this.writeLine('});');
      this.writeLine('');
    }

    // Success schema
    const successSchema = this.typeExprToZod(output.success);
    this.writeLine(`/** Success schema for ${behaviorName} */`);
    this.writeLine(`export const ${behaviorName}SuccessSchema = ${successSchema};`);
    this.writeLine('');

    // Result schema (discriminated union)
    this.writeLine(`/** Result schema for ${behaviorName} */`);
    this.writeLine(`export const ${behaviorName}ResultSchema = z.discriminatedUnion('success', [`);
    this.indent++;
    this.writeLine(`z.object({ success: z.literal(true), data: ${behaviorName}SuccessSchema }),`);
    if (output.errors.length > 0) {
      this.writeLine(`z.object({ success: z.literal(false), error: ${behaviorName}ErrorSchema }),`);
    } else {
      this.writeLine('z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),');
    }
    this.indent--;
    this.writeLine(']);');
  }

  private generateBehaviorValidator(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (behavior.input) {
      this.writeLine(`/** Validate ${name} input */`);
      this.writeLine(`export function validate${name}Input(`);
      this.indent++;
      this.writeLine('input: unknown');
      this.indent--;
      this.writeLine(`): Types.${name}Input {`);
      this.indent++;
      this.writeLine(`return ${name}InputSchema.parse(input) as Types.${name}Input;`);
      this.indent--;
      this.writeLine('}');
      this.writeLine('');

      this.writeLine(`/** Safe validate ${name} input */`);
      this.writeLine(`export function safeParse${name}Input(input: unknown): z.SafeParseReturnType<unknown, Types.${name}Input> {`);
      this.indent++;
      this.writeLine(`return ${name}InputSchema.safeParse(input) as z.SafeParseReturnType<unknown, Types.${name}Input>;`);
      this.indent--;
      this.writeLine('}');
    }
  }

  // --------------------------------------------------------------------------
  // Validation Utilities
  // --------------------------------------------------------------------------

  private generateValidationUtils(domain: DomainDeclaration): void {
    this.writeLine('// ============================================================================');
    this.writeLine('// Validation Utilities');
    this.writeLine('// ============================================================================');
    this.writeLine('');

    // Schema registry
    this.writeLine('/** Registry of all schemas */');
    this.writeLine('export const SchemaRegistry = {');
    this.indent++;

    // Enums
    for (const enumDecl of domain.enums) {
      this.writeLine(`${enumDecl.name.name}: ${enumDecl.name.name}Schema,`);
    }

    // Types
    for (const typeDecl of domain.types) {
      this.writeLine(`${typeDecl.name.name}: ${typeDecl.name.name}Schema,`);
    }

    // Entities
    for (const entity of domain.entities) {
      this.writeLine(`${entity.name.name}: ${entity.name.name}Schema,`);
      this.writeLine(`${entity.name.name}CreateInput: ${entity.name.name}CreateInputSchema,`);
      this.writeLine(`${entity.name.name}UpdateInput: ${entity.name.name}UpdateInputSchema,`);
    }

    // Behaviors
    for (const behavior of domain.behaviors) {
      if (behavior.input) {
        this.writeLine(`${behavior.name.name}Input: ${behavior.name.name}InputSchema,`);
      }
      if (behavior.output) {
        this.writeLine(`${behavior.name.name}Result: ${behavior.name.name}ResultSchema,`);
      }
    }

    this.indent--;
    this.writeLine('} as const;');
    this.writeLine('');

    // Generic validation function
    this.writeLine('/**');
    this.writeLine(' * Validate data against a schema from the registry');
    this.writeLine(' */');
    this.writeLine('export function validate<K extends keyof typeof SchemaRegistry>(');
    this.indent++;
    this.writeLine('schemaName: K,');
    this.writeLine('data: unknown');
    this.indent--;
    this.writeLine('): z.infer<typeof SchemaRegistry[K]> {');
    this.indent++;
    this.writeLine('return SchemaRegistry[schemaName].parse(data);');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');

    // Safe validation
    this.writeLine('/**');
    this.writeLine(' * Safely validate data against a schema from the registry');
    this.writeLine(' */');
    this.writeLine('export function safeValidate<K extends keyof typeof SchemaRegistry>(');
    this.indent++;
    this.writeLine('schemaName: K,');
    this.writeLine('data: unknown');
    this.indent--;
    this.writeLine('): z.SafeParseReturnType<unknown, z.infer<typeof SchemaRegistry[K]>> {');
    this.indent++;
    this.writeLine('return SchemaRegistry[schemaName].safeParse(data);');
    this.indent--;
    this.writeLine('}');
  }

  // --------------------------------------------------------------------------
  // Type Expression to Zod
  // --------------------------------------------------------------------------

  private typeExprToZod(type: TypeExpression): string {
    switch (type.kind) {
      case 'SimpleType':
        return this.simpleTypeToZod(type.name.name);

      case 'GenericType': {
        const name = type.name.name;
        const args = type.typeArguments.map(t => this.typeExprToZod(t));

        if (name === 'List') return `z.array(${args[0]})`;
        if (name === 'Set') return `z.array(${args[0]})`;  // Zod doesn't have Set
        if (name === 'Map') return `z.record(${args[0]}, ${args[1]})`;
        if (name === 'Optional') return `${args[0]}.nullable()`;

        return `${name}Schema`;
      }

      case 'UnionType': {
        const variants = type.variants.map(v => {
          if (v.fields && v.fields.length > 0) {
            const fields = v.fields.map(f => {
              const fSchema = this.fieldToZod(f);
              return `${f.name.name}: ${f.optional ? `${fSchema}.optional()` : fSchema}`;
            }).join(', ');
            return `z.object({ kind: z.literal('${v.name.name}'), ${fields} })`;
          }
          return `z.object({ kind: z.literal('${v.name.name}') })`;
        });
        return `z.discriminatedUnion('kind', [${variants.join(', ')}])`;
      }

      case 'ObjectType': {
        const fields = type.fields.map(f => {
          const fSchema = this.fieldToZod(f);
          return `${f.name.name}: ${f.optional ? `${fSchema}.optional()` : fSchema}`;
        }).join(', ');
        return `z.object({ ${fields} })`;
      }

      case 'ArrayType':
        return `z.array(${this.typeExprToZod(type.elementType)})`;

      default:
        return 'z.unknown()';
    }
  }

  private simpleTypeToZod(name: string): string {
    const typeMap: Record<string, string> = {
      'String': 'z.string()',
      'Int': 'z.number().int()',
      'Float': 'z.number()',
      'Decimal': 'DecimalSchema',
      'Boolean': 'z.boolean()',
      'UUID': 'UUIDSchema',
      'Email': 'z.string().email()',
      'URL': 'z.string().url()',
      'Phone': 'z.string()',
      'IP': 'z.string().ip()',
      'Timestamp': 'TimestampSchema',
      'Date': 'z.string().date()',
      'Duration': 'DurationSchema',
      'Money': 'MoneySchema',
      'JSON': 'z.record(z.unknown())',
      'void': 'z.void()',
    };

    return typeMap[name] ?? `${name}Schema`;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private constraintValueToString(constraint: TypeConstraint): string {
    if (!constraint.value) return 'true';

    switch (constraint.value.kind) {
      case 'StringLiteral':
        return `/${constraint.value.value}/`;
      case 'NumberLiteral':
        return String(constraint.value.value);
      case 'BooleanLiteral':
        return String(constraint.value.value);
      default:
        return 'undefined';
    }
  }

  private hasAnnotation(field: FieldDeclaration, name: string): boolean {
    return field.annotations.some(
      a => a.name.name.toLowerCase() === name.toLowerCase()
    );
  }

  private isAutoField(field: FieldDeclaration): boolean {
    const name = field.name.name.toLowerCase();
    const isId = name === 'id';
    const isTimestamp = name === 'created_at' || name === 'updated_at';
    const hasImmutable = this.hasAnnotation(field, 'immutable');
    
    return (isId && hasImmutable) || (isTimestamp && hasImmutable);
  }

  private writeLine(line: string): void {
    const indentStr = '  '.repeat(this.indent);
    this.output.push(indentStr + line);
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Generate Zod validation schemas from an ISL domain
 */
export function generateZodValidation(
  domain: DomainDeclaration,
  options?: Partial<GeneratorOptions>
): string {
  const generator = new ZodGenerator({
    language: 'typescript',
    validation: true,
    comments: true,
    ...options,
  });
  return generator.generate(domain);
}
