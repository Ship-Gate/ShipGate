/**
 * TypeScript Type Generator
 * 
 * Generates TypeScript type definitions from ISL AST.
 */

import type {
  Domain,
  Entity,
  Behavior,
  TypeDeclaration,
  TypeDefinition,
  Field,
  InputSpec,
  OutputSpec,
  EnumType,
  ConstrainedType,
  Constraint,
  Expression,
} from '@isl-lang/parser';

export interface GeneratedTypes {
  filename: string;
  content: string;
}

export interface TypeGeneratorOptions {
  includeValidation?: boolean;
  includeComments?: boolean;
  exportStyle?: 'named' | 'default';
}

export class TypeGenerator {
  private options: Required<TypeGeneratorOptions>;
  private output: string[] = [];
  private indent: number = 0;

  constructor(options: TypeGeneratorOptions = {}) {
    this.options = {
      includeValidation: options.includeValidation ?? true,
      includeComments: options.includeComments ?? true,
      exportStyle: options.exportStyle ?? 'named',
    };
  }

  /**
   * Generate TypeScript types from an ISL domain
   */
  generate(domain: Domain): GeneratedTypes {
    this.output = [];
    this.indent = 0;

    // Header comment
    if (this.options.includeComments) {
      this.writeLine('/**');
      this.writeLine(` * Generated from ISL domain: ${domain.name.name}`);
      if (domain.version) {
        this.writeLine(` * Version: ${domain.version.value}`);
      }
      this.writeLine(' * DO NOT EDIT - This file is auto-generated');
      this.writeLine(' */');
      this.writeLine('');
    }

    // Generate enums first (enums are TypeDeclarations with EnumType definitions)
    for (const typeDecl of domain.types) {
      if (typeDecl.definition.kind === 'EnumType') {
        this.generateEnum(typeDecl.name.name, typeDecl.definition as EnumType);
        this.writeLine('');
      }
    }

    // Generate type aliases (non-enum types)
    for (const typeDecl of domain.types) {
      if (typeDecl.definition.kind !== 'EnumType') {
        this.generateTypeAlias(typeDecl);
        this.writeLine('');
      }
    }

    // Generate entity interfaces
    for (const entity of domain.entities) {
      this.generateEntity(entity);
      this.writeLine('');
    }

    // Generate behavior types
    for (const behavior of domain.behaviors) {
      this.generateBehaviorTypes(behavior);
      this.writeLine('');
    }

    return {
      filename: `${domain.name.name.toLowerCase()}.types.ts`,
      content: this.output.join('\n'),
    };
  }

  private generateEnum(name: string, enumType: EnumType): void {
    if (this.options.includeComments) {
      this.writeLine(`/** Enum: ${name} */`);
    }
    this.writeLine(`export enum ${name} {`);
    this.indent++;
    
    for (const variant of enumType.variants) {
      this.writeLine(`${variant.name.name} = '${variant.name.name}',`);
    }
    
    this.indent--;
    this.writeLine('}');
  }

  private generateTypeAlias(decl: TypeDeclaration): void {
    if (this.options.includeComments) {
      this.writeLine(`/** Type: ${decl.name.name} */`);
    }
    
    const tsType = this.typeDefinitionToTS(decl.definition);
    this.writeLine(`export type ${decl.name.name} = ${tsType};`);
    
    // Generate validation schema if it's a constrained type
    if (this.options.includeValidation && decl.definition.kind === 'ConstrainedType') {
      const constrained = decl.definition as ConstrainedType;
      if (constrained.constraints.length > 0) {
        this.writeLine('');
        this.generateTypeValidation(decl.name.name, constrained.constraints);
      }
    }
  }

  private generateTypeValidation(name: string, constraints: Constraint[]): void {
    this.writeLine(`export const ${name}Schema = {`);
    this.indent++;
    
    for (const constraint of constraints) {
      const value = this.expressionToTS(constraint.value);
      this.writeLine(`${constraint.name}: ${value},`);
    }
    
    this.indent--;
    this.writeLine('};');
  }

  private generateEntity(entity: Entity): void {
    if (this.options.includeComments) {
      this.writeLine(`/** Entity: ${entity.name.name} */`);
    }
    
    this.writeLine(`export interface ${entity.name.name} {`);
    this.indent++;
    
    for (const field of entity.fields) {
      this.generateField(field);
    }
    
    this.indent--;
    this.writeLine('}');

    // Generate entity repository interface
    this.writeLine('');
    this.writeLine(`export interface ${entity.name.name}Repository {`);
    this.indent++;
    this.writeLine(`findById(id: string): Promise<${entity.name.name} | null>;`);
    this.writeLine(`exists(id: string): Promise<boolean>;`);
    this.writeLine(`create(data: Omit<${entity.name.name}, 'id'>): Promise<${entity.name.name}>;`);
    this.writeLine(`update(id: string, data: Partial<${entity.name.name}>): Promise<${entity.name.name}>;`);
    this.writeLine(`delete(id: string): Promise<void>;`);
    this.indent--;
    this.writeLine('}');
  }

  private generateField(field: Field): void {
    const annotations = this.getFieldAnnotations(field);
    
    if (this.options.includeComments && annotations.length > 0) {
      this.writeLine(`/** ${annotations.join(', ')} */`);
    }
    
    const isReadonly = this.hasAnnotation(field, 'immutable');
    const readonly = isReadonly ? 'readonly ' : '';
    const optional = field.optional ? '?' : '';
    const tsType = this.typeDefinitionToTS(field.type);
    
    this.writeLine(`${readonly}${field.name.name}${optional}: ${tsType};`);
  }

  private generateBehaviorTypes(behavior: Behavior): void {
    const name = behavior.name.name;
    
    if (this.options.includeComments) {
      this.writeLine(`/** Behavior: ${name} */`);
      if (behavior.description) {
        this.writeLine(`/** ${behavior.description.value} */`);
      }
    }

    // Generate input type
    if (behavior.input) {
      this.generateInputType(name, behavior.input);
      this.writeLine('');
    }

    // Generate output type
    if (behavior.output) {
      this.generateOutputType(name, behavior.output);
      this.writeLine('');
    }

    // Generate behavior function type
    this.generateBehaviorFunction(behavior);
  }

  private generateInputType(behaviorName: string, input: InputSpec): void {
    this.writeLine(`export interface ${behaviorName}Input {`);
    this.indent++;
    
    for (const field of input.fields) {
      this.generateField(field);
    }
    
    this.indent--;
    this.writeLine('}');
  }

  private generateOutputType(behaviorName: string, output: OutputSpec): void {
    // Generate error types
    if (output.errors.length > 0) {
      this.writeLine(`export type ${behaviorName}ErrorCode =`);
      this.indent++;
      for (let i = 0; i < output.errors.length; i++) {
        const error = output.errors[i]!;
        const isLast = i === output.errors.length - 1;
        this.writeLine(`| '${error.name.name}'${isLast ? ';' : ''}`);
      }
      this.indent--;
      this.writeLine('');

      this.writeLine(`export interface ${behaviorName}Error {`);
      this.indent++;
      this.writeLine(`code: ${behaviorName}ErrorCode;`);
      this.writeLine('message: string;');
      this.writeLine('retriable?: boolean;');
      this.writeLine('retryAfter?: number;');
      this.indent--;
      this.writeLine('}');
      this.writeLine('');
    }

    // Generate success type
    const successType = this.typeDefinitionToTS(output.success);
    
    // Generate result type
    this.writeLine(`export type ${behaviorName}Result =`);
    this.indent++;
    this.writeLine(`| { success: true; data: ${successType} }`);
    if (output.errors.length > 0) {
      this.writeLine(`| { success: false; error: ${behaviorName}Error };`);
    } else {
      this.writeLine(`| { success: false; error: { code: string; message: string } };`);
    }
    this.indent--;
  }

  private generateBehaviorFunction(behavior: Behavior): void {
    const name = behavior.name.name;
    const inputType = behavior.input ? `${name}Input` : 'void';
    const outputType = behavior.output ? `${name}Result` : 'void';

    // Generate behavior interface
    this.writeLine(`export interface ${name}Behavior {`);
    this.indent++;
    this.writeLine(`execute(input: ${inputType}): Promise<${outputType}>;`);
    this.indent--;
    this.writeLine('}');

    // Generate behavior function type
    this.writeLine('');
    this.writeLine(`export type ${name}Function = (input: ${inputType}) => Promise<${outputType}>;`);
  }

  /**
   * Convert ISL TypeDefinition to TypeScript type string
   */
  private typeDefinitionToTS(type: TypeDefinition): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return this.primitiveTypeToTS(type.name);
      case 'ReferenceType':
        return type.name.parts.map(p => p.name).join('.');
      case 'ListType':
        return `${this.typeDefinitionToTS(type.element)}[]`;
      case 'MapType':
        return `Map<${this.typeDefinitionToTS(type.key)}, ${this.typeDefinitionToTS(type.value)}>`;
      case 'OptionalType':
        return `${this.typeDefinitionToTS(type.inner)} | null`;
      case 'StructType':
        const fields = type.fields.map(f => {
          const opt = f.optional ? '?' : '';
          return `${f.name.name}${opt}: ${this.typeDefinitionToTS(f.type)}`;
        }).join('; ');
        return `{ ${fields} }`;
      case 'UnionType':
        return type.variants.map(v => v.name.name).join(' | ');
      case 'EnumType':
        return type.variants.map(v => `'${v.name.name}'`).join(' | ');
      case 'ConstrainedType':
        // For constrained types, just use the base type in TS
        return this.typeDefinitionToTS(type.base);
      default:
        return 'unknown';
    }
  }

  /**
   * Map ISL primitive type names to TypeScript types
   */
  private primitiveTypeToTS(name: string): string {
    const typeMap: Record<string, string> = {
      'String': 'string',
      'Int': 'number',
      'Float': 'number',
      'Decimal': 'number',
      'Boolean': 'boolean',
      'UUID': 'string',
      'Email': 'string',
      'URL': 'string',
      'Phone': 'string',
      'IP': 'string',
      'Timestamp': 'Date',
      'Date': 'Date',
      'Duration': 'number',
      'Money': '{ amount: number; currency: string }',
      'JSON': 'Record<string, unknown>',
      'void': 'void',
    };

    return typeMap[name] ?? name;
  }

  /**
   * Convert ISL expression to TypeScript value
   */
  private expressionToTS(expr: Expression): string {
    switch (expr.kind) {
      case 'StringLiteral':
        return `'${expr.value}'`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'Identifier':
        return expr.name;
      case 'NullLiteral':
        return 'null';
      default:
        return 'unknown';
    }
  }

  private getFieldAnnotations(field: Field): string[] {
    return field.annotations.map(a => a.name.name);
  }

  private hasAnnotation(field: Field, name: string): boolean {
    return field.annotations.some(a => a.name.name.toLowerCase() === name.toLowerCase());
  }

  private writeLine(line: string): void {
    const indentStr = '  '.repeat(this.indent);
    this.output.push(indentStr + line);
  }
}

/**
 * Generate TypeScript types from an ISL domain
 */
export function generateTypes(
  domain: Domain,
  options?: TypeGeneratorOptions
): GeneratedTypes {
  const generator = new TypeGenerator(options);
  return generator.generate(domain);
}

// Re-export types for backward compatibility
export type { Domain, Entity, Behavior, TypeDeclaration, Field } from '@isl-lang/parser';
