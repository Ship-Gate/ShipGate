/**
 * TypeScript Type Generator
 * 
 * Generates TypeScript interfaces, types, and enums from ISL domain definitions.
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
} from '@isl-lang/isl-core';

import type { GeneratorOptions } from './generator.js';

// ============================================================================
// TypeScript Generator
// ============================================================================

export class TypeScriptGenerator {
  private output: string[] = [];
  private indent = 0;
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate TypeScript types from a domain
   */
  generate(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    // Header
    this.writeHeader(domain);

    // Enums first (other types may depend on them)
    for (const enumDecl of domain.enums) {
      this.generateEnum(enumDecl);
      this.writeLine('');
    }

    // Type aliases
    for (const typeDecl of domain.types) {
      this.generateTypeAlias(typeDecl);
      this.writeLine('');
    }

    // Entity interfaces
    for (const entity of domain.entities) {
      this.generateEntity(entity);
      this.writeLine('');
    }

    // Behavior types (input/output)
    for (const behavior of domain.behaviors) {
      this.generateBehavior(behavior);
      this.writeLine('');
    }

    return this.output.join('\n');
  }

  // --------------------------------------------------------------------------
  // Header Generation
  // --------------------------------------------------------------------------

  private writeHeader(domain: DomainDeclaration): void {
    if (this.options.comments) {
      this.writeLine('/**');
      this.writeLine(` * Generated TypeScript types for ${domain.name.name} domain`);
      if (domain.version) {
        this.writeLine(` * Version: ${domain.version.value}`);
      }
      this.writeLine(' * ');
      this.writeLine(' * DO NOT EDIT - This file is auto-generated from ISL');
      this.writeLine(` * Generated at: ${new Date().toISOString()}`);
      this.writeLine(' */');
      this.writeLine('');
    }

    // Standard utility types
    this.writeLine('// ============================================================================');
    this.writeLine('// Utility Types');
    this.writeLine('// ============================================================================');
    this.writeLine('');
    this.writeLine('/** UUID string type */');
    this.writeLine('export type UUID = string;');
    this.writeLine('');
    this.writeLine('/** ISO 8601 timestamp string */');
    this.writeLine('export type Timestamp = string;');
    this.writeLine('');
    this.writeLine('/** Duration in milliseconds */');
    this.writeLine('export type Duration = number;');
    this.writeLine('');
    this.writeLine('/** Decimal number (use string for precision) */');
    this.writeLine('export type Decimal = string;');
    this.writeLine('');
    this.writeLine('/** Money type */');
    this.writeLine('export interface Money {');
    this.writeLine('  amount: Decimal;');
    this.writeLine('  currency: string;');
    this.writeLine('}');
    this.writeLine('');
  }

  // --------------------------------------------------------------------------
  // Enum Generation
  // --------------------------------------------------------------------------

  private generateEnum(decl: EnumDeclaration): void {
    if (this.options.comments) {
      this.writeLine(`/** Enum: ${decl.name.name} */`);
    }

    this.writeLine(`export enum ${decl.name.name} {`);
    this.indent++;

    for (const variant of decl.variants) {
      this.writeLine(`${variant.name} = '${variant.name}',`);
    }

    this.indent--;
    this.writeLine('}');

    // Also generate a const array for iteration
    this.writeLine('');
    const variants = decl.variants.map(v => `'${v.name}'`).join(', ');
    this.writeLine(`export const ${decl.name.name}Values = [${variants}] as const;`);
  }

  // --------------------------------------------------------------------------
  // Type Alias Generation
  // --------------------------------------------------------------------------

  private generateTypeAlias(decl: TypeDeclaration): void {
    if (this.options.comments) {
      this.writeLine(`/** Type: ${decl.name.name} */`);
      if (decl.constraints.length > 0) {
        const constraints = decl.constraints
          .map(c => `${c.name.name}: ${this.constraintValueToString(c)}`)
          .join(', ');
        this.writeLine(`/** Constraints: ${constraints} */`);
      }
    }

    const baseType = this.typeExprToTS(decl.baseType);
    this.writeLine(`export type ${decl.name.name} = ${baseType};`);

    // Generate brand type for nominal typing
    this.writeLine('');
    this.writeLine(`/** Branded type for ${decl.name.name} validation */`);
    this.writeLine(`export type ${decl.name.name}Branded = ${baseType} & { readonly __brand: '${decl.name.name}' };`);
  }

  // --------------------------------------------------------------------------
  // Entity Generation
  // --------------------------------------------------------------------------

  private generateEntity(entity: EntityDeclaration): void {
    if (this.options.comments) {
      this.writeLine(`/** Entity: ${entity.name.name} */`);
    }

    this.writeLine(`export interface ${entity.name.name} {`);
    this.indent++;

    for (const field of entity.fields) {
      this.generateField(field);
    }

    this.indent--;
    this.writeLine('}');

    // Generate create input type (omitting computed/immutable fields)
    this.writeLine('');
    this.writeLine(`/** Input for creating a new ${entity.name.name} */`);
    this.writeLine(`export interface ${entity.name.name}CreateInput {`);
    this.indent++;

    for (const field of entity.fields) {
      if (!this.hasAnnotation(field, 'computed') && !this.hasAnnotation(field, 'immutable')) {
        this.generateField(field);
      } else if (this.hasAnnotation(field, 'immutable') && !this.isIdField(field)) {
        // Include immutable fields that aren't auto-generated IDs
        this.generateField(field);
      }
    }

    this.indent--;
    this.writeLine('}');

    // Generate update input type (partial, excluding immutable)
    this.writeLine('');
    this.writeLine(`/** Input for updating a ${entity.name.name} */`);
    const mutableFields = entity.fields.filter(
      f => !this.hasAnnotation(f, 'immutable') && !this.hasAnnotation(f, 'computed')
    );
    if (mutableFields.length > 0) {
      const fieldNames = mutableFields.map(f => `'${f.name.name}'`).join(' | ');
      this.writeLine(`export type ${entity.name.name}UpdateInput = Partial<Pick<${entity.name.name}, ${fieldNames}>>;`);
    } else {
      this.writeLine(`export type ${entity.name.name}UpdateInput = Record<string, never>;`);
    }
  }

  private generateField(field: FieldDeclaration): void {
    const annotations = this.getAnnotationNames(field);
    
    if (this.options.comments && annotations.length > 0) {
      this.writeLine(`/** ${annotations.join(', ')} */`);
    }

    const readonly = this.hasAnnotation(field, 'immutable') ? 'readonly ' : '';
    const optional = field.optional ? '?' : '';
    const tsType = this.typeExprToTS(field.type);

    this.writeLine(`${readonly}${field.name.name}${optional}: ${tsType};`);
  }

  // --------------------------------------------------------------------------
  // Behavior Generation
  // --------------------------------------------------------------------------

  private generateBehavior(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (this.options.comments) {
      this.writeLine(`// ============================================================================`);
      this.writeLine(`// Behavior: ${name}`);
      if (behavior.description) {
        this.writeLine(`// ${behavior.description.value}`);
      }
      this.writeLine(`// ============================================================================`);
      this.writeLine('');
    }

    // Generate input type
    if (behavior.input) {
      this.generateInputType(name, behavior.input);
      this.writeLine('');
    }

    // Generate output/error types
    if (behavior.output) {
      this.generateOutputTypes(name, behavior.output);
      this.writeLine('');
    }

    // Generate behavior function type
    this.generateBehaviorFunctionType(behavior);
  }

  private generateInputType(behaviorName: string, input: InputBlock): void {
    this.writeLine(`/** Input for ${behaviorName} */`);
    this.writeLine(`export interface ${behaviorName}Input {`);
    this.indent++;

    for (const field of input.fields) {
      this.generateField(field);
    }

    this.indent--;
    this.writeLine('}');
  }

  private generateOutputTypes(behaviorName: string, output: OutputBlock): void {
    // Generate error code union
    if (output.errors.length > 0) {
      this.writeLine(`/** Error codes for ${behaviorName} */`);
      const errorCodes = output.errors.map(e => `'${e.name.name}'`).join(' | ');
      this.writeLine(`export type ${behaviorName}ErrorCode = ${errorCodes};`);
      this.writeLine('');

      // Generate error interface
      this.writeLine(`/** Error type for ${behaviorName} */`);
      this.writeLine(`export interface ${behaviorName}Error {`);
      this.indent++;
      this.writeLine(`code: ${behaviorName}ErrorCode;`);
      this.writeLine('message: string;');
      this.writeLine('retriable: boolean;');
      this.writeLine('retryAfter?: number;');
      this.writeLine('details?: Record<string, unknown>;');
      this.indent--;
      this.writeLine('}');
      this.writeLine('');

      // Generate individual error types with specific returns
      for (const error of output.errors) {
        if (error.returns) {
          this.writeLine(`/** Error details for ${error.name.name} */`);
          this.writeLine(`export interface ${behaviorName}${error.name.name}Error extends ${behaviorName}Error {`);
          this.indent++;
          this.writeLine(`code: '${error.name.name}';`);
          this.writeLine(`details: ${error.returns.name};`);
          this.indent--;
          this.writeLine('}');
          this.writeLine('');
        }
      }
    }

    // Generate success type alias
    const successType = this.typeExprToTS(output.success);
    this.writeLine(`/** Success type for ${behaviorName} */`);
    this.writeLine(`export type ${behaviorName}Success = ${successType};`);
    this.writeLine('');

    // Generate result type (discriminated union)
    this.writeLine(`/** Result type for ${behaviorName} */`);
    this.writeLine(`export type ${behaviorName}Result =`);
    this.indent++;
    this.writeLine(`| { success: true; data: ${behaviorName}Success }`);
    if (output.errors.length > 0) {
      this.writeLine(`| { success: false; error: ${behaviorName}Error };`);
    } else {
      this.writeLine('| { success: false; error: { code: string; message: string } };');
    }
    this.indent--;
  }

  private generateBehaviorFunctionType(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;
    const inputType = behavior.input ? `${name}Input` : 'void';
    const resultType = behavior.output ? `${name}Result` : 'void';

    this.writeLine(`/** Function type for ${name} behavior */`);
    this.writeLine(`export type ${name}Function = (input: ${inputType}) => Promise<${resultType}>;`);
    this.writeLine('');

    this.writeLine(`/** Handler interface for ${name} behavior */`);
    this.writeLine(`export interface ${name}Handler {`);
    this.indent++;
    this.writeLine(`execute(input: ${inputType}): Promise<${resultType}>;`);
    this.indent--;
    this.writeLine('}');
  }

  // --------------------------------------------------------------------------
  // Type Expression Conversion
  // --------------------------------------------------------------------------

  private typeExprToTS(type: TypeExpression): string {
    switch (type.kind) {
      case 'SimpleType':
        return this.simpleTypeToTS(type.name.name);

      case 'GenericType': {
        const name = type.name.name;
        const args = type.typeArguments.map(t => this.typeExprToTS(t)).join(', ');
        
        // Map ISL generics to TypeScript
        if (name === 'List') return `${args}[]`;
        if (name === 'Set') return `Set<${args}>`;
        if (name === 'Map') return `Map<${args}>`;
        if (name === 'Optional') return `${args} | null`;
        
        return `${name}<${args}>`;
      }

      case 'UnionType': {
        const variants = type.variants.map(v => {
          if (v.fields && v.fields.length > 0) {
            const fields = v.fields
              .map(f => `${f.name.name}${f.optional ? '?' : ''}: ${this.typeExprToTS(f.type)}`)
              .join('; ');
            return `{ kind: '${v.name.name}'; ${fields} }`;
          }
          return `{ kind: '${v.name.name}' }`;
        });
        return variants.join(' | ');
      }

      case 'ObjectType': {
        const fields = type.fields
          .map(f => `${f.name.name}${f.optional ? '?' : ''}: ${this.typeExprToTS(f.type)}`)
          .join('; ');
        return `{ ${fields} }`;
      }

      case 'ArrayType':
        return `${this.typeExprToTS(type.elementType)}[]`;

      default:
        return 'unknown';
    }
  }

  private simpleTypeToTS(name: string): string {
    const typeMap: Record<string, string> = {
      'String': 'string',
      'Int': 'number',
      'Float': 'number',
      'Decimal': 'Decimal',
      'Boolean': 'boolean',
      'UUID': 'UUID',
      'Email': 'string',
      'URL': 'string',
      'Phone': 'string',
      'IP': 'string',
      'Timestamp': 'Timestamp',
      'Date': 'string',
      'Duration': 'Duration',
      'Money': 'Money',
      'JSON': 'Record<string, unknown>',
      'void': 'void',
    };

    return typeMap[name] ?? name;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private constraintValueToString(constraint: TypeConstraint): string {
    if (!constraint.value) return 'true';
    
    switch (constraint.value.kind) {
      case 'StringLiteral':
        return `"${constraint.value.value}"`;
      case 'NumberLiteral':
        return String(constraint.value.value);
      case 'BooleanLiteral':
        return String(constraint.value.value);
      default:
        return 'unknown';
    }
  }

  private getAnnotationNames(field: FieldDeclaration): string[] {
    return field.annotations.map(a => a.name.name);
  }

  private hasAnnotation(field: FieldDeclaration, name: string): boolean {
    return field.annotations.some(
      a => a.name.name.toLowerCase() === name.toLowerCase()
    );
  }

  private isIdField(field: FieldDeclaration): boolean {
    return field.name.name === 'id' || field.name.name.endsWith('_id');
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
 * Generate TypeScript types from an ISL domain
 */
export function generateTypeScript(
  domain: DomainDeclaration,
  options?: Partial<GeneratorOptions>
): string {
  const generator = new TypeScriptGenerator({
    language: 'typescript',
    validation: false,
    comments: true,
    ...options,
  });
  return generator.generate(domain);
}
