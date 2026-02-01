/**
 * TypeScript Type Generator
 * 
 * Generates TypeScript type definitions from ISL AST.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  TypeExpression,
  InputBlock,
  OutputBlock,
} from '@intentos/isl-core';

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
  generate(domain: DomainDeclaration): GeneratedTypes {
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

    // Generate enums first
    for (const enumDecl of domain.enums) {
      this.generateEnum(enumDecl);
      this.writeLine('');
    }

    // Generate type aliases
    for (const typeDecl of domain.types) {
      this.generateTypeAlias(typeDecl);
      this.writeLine('');
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

  private generateEnum(decl: EnumDeclaration): void {
    if (this.options.includeComments) {
      this.writeLine(`/** Enum: ${decl.name.name} */`);
    }
    this.writeLine(`export enum ${decl.name.name} {`);
    this.indent++;
    
    for (const variant of decl.variants) {
      this.writeLine(`${variant.name} = '${variant.name}',`);
    }
    
    this.indent--;
    this.writeLine('}');
  }

  private generateTypeAlias(decl: TypeDeclaration): void {
    if (this.options.includeComments) {
      this.writeLine(`/** Type: ${decl.name.name} */`);
    }
    
    const baseType = this.typeExpressionToTS(decl.baseType);
    this.writeLine(`export type ${decl.name.name} = ${baseType};`);
    
    // Generate validation schema if constraints exist
    if (this.options.includeValidation && decl.constraints.length > 0) {
      this.writeLine('');
      this.generateTypeValidation(decl);
    }
  }

  private generateTypeValidation(decl: TypeDeclaration): void {
    this.writeLine(`export const ${decl.name.name}Schema = {`);
    this.indent++;
    
    for (const constraint of decl.constraints) {
      const value = constraint.value 
        ? this.expressionToTS(constraint.value)
        : 'true';
      this.writeLine(`${constraint.name.name}: ${value},`);
    }
    
    this.indent--;
    this.writeLine('};');
  }

  private generateEntity(entity: EntityDeclaration): void {
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

  private generateField(field: FieldDeclaration): void {
    const annotations = this.getFieldAnnotations(field);
    
    if (this.options.includeComments && annotations.length > 0) {
      this.writeLine(`/** ${annotations.join(', ')} */`);
    }
    
    const isReadonly = this.hasAnnotation(field, 'immutable');
    const readonly = isReadonly ? 'readonly ' : '';
    const optional = field.optional ? '?' : '';
    const tsType = this.typeExpressionToTS(field.type);
    
    this.writeLine(`${readonly}${field.name.name}${optional}: ${tsType};`);
  }

  private generateBehaviorTypes(behavior: BehaviorDeclaration): void {
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

  private generateInputType(behaviorName: string, input: InputBlock): void {
    this.writeLine(`export interface ${behaviorName}Input {`);
    this.indent++;
    
    for (const field of input.fields) {
      this.generateField(field);
    }
    
    this.indent--;
    this.writeLine('}');
  }

  private generateOutputType(behaviorName: string, output: OutputBlock): void {
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
    const successType = this.typeExpressionToTS(output.success);
    
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

  private generateBehaviorFunction(behavior: BehaviorDeclaration): void {
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

  private typeExpressionToTS(type: TypeExpression): string {
    switch (type.kind) {
      case 'SimpleType':
        return this.simpleTypeToTS(type.name.name);
      case 'GenericType':
        const typeArgs = type.typeArguments.map(t => this.typeExpressionToTS(t)).join(', ');
        return `${type.name.name}<${typeArgs}>`;
      case 'UnionType':
        return type.variants.map(v => v.name.name).join(' | ');
      case 'ObjectType':
        const fields = type.fields.map(f => {
          const opt = f.optional ? '?' : '';
          return `${f.name.name}${opt}: ${this.typeExpressionToTS(f.type)}`;
        }).join('; ');
        return `{ ${fields} }`;
      case 'ArrayType':
        return `${this.typeExpressionToTS(type.elementType)}[]`;
      default:
        return 'unknown';
    }
  }

  private simpleTypeToTS(name: string): string {
    // Map ISL built-in types to TypeScript
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

  private expressionToTS(expr: any): string {
    switch (expr.kind) {
      case 'StringLiteral':
        return `'${expr.value}'`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'Identifier':
        return expr.name;
      default:
        return 'unknown';
    }
  }

  private getFieldAnnotations(field: FieldDeclaration): string[] {
    return field.annotations.map(a => a.name.name);
  }

  private hasAnnotation(field: FieldDeclaration, name: string): boolean {
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
  domain: DomainDeclaration,
  options?: TypeGeneratorOptions
): GeneratedTypes {
  const generator = new TypeGenerator(options);
  return generator.generate(domain);
}
