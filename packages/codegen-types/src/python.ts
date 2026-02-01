/**
 * Python Type Generator
 * 
 * Generates Python dataclasses and Pydantic models from ISL domain definitions.
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
// Python Generator
// ============================================================================

export class PythonGenerator {
  private output: string[] = [];
  private indent = 0;
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate Python dataclasses from a domain
   */
  generate(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    // Header and imports
    this.writeHeader(domain);
    this.writeDataclassImports();

    // Enums
    for (const enumDecl of domain.enums) {
      this.generateEnum(enumDecl);
      this.writeLine('');
    }

    // Type aliases (using TypeAlias)
    for (const typeDecl of domain.types) {
      this.generateTypeAlias(typeDecl);
      this.writeLine('');
    }

    // Entity dataclasses
    for (const entity of domain.entities) {
      this.generateEntity(entity);
      this.writeLine('');
    }

    // Behavior types
    for (const behavior of domain.behaviors) {
      this.generateBehavior(behavior);
      this.writeLine('');
    }

    return this.output.join('\n');
  }

  /**
   * Generate Pydantic models from a domain
   */
  generatePydantic(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    // Header and imports
    this.writeHeader(domain);
    this.writePydanticImports();

    // Enums
    for (const enumDecl of domain.enums) {
      this.generateEnum(enumDecl);
      this.writeLine('');
    }

    // Type aliases with Pydantic validators
    for (const typeDecl of domain.types) {
      this.generatePydanticType(typeDecl);
      this.writeLine('');
    }

    // Entity Pydantic models
    for (const entity of domain.entities) {
      this.generatePydanticEntity(entity);
      this.writeLine('');
    }

    // Behavior types
    for (const behavior of domain.behaviors) {
      this.generatePydanticBehavior(behavior);
      this.writeLine('');
    }

    return this.output.join('\n');
  }

  // --------------------------------------------------------------------------
  // Header and Imports
  // --------------------------------------------------------------------------

  private writeHeader(domain: DomainDeclaration): void {
    this.writeLine('"""');
    this.writeLine(`Generated Python types for ${domain.name.name} domain`);
    if (domain.version) {
      this.writeLine(`Version: ${domain.version.value}`);
    }
    this.writeLine('');
    this.writeLine('DO NOT EDIT - This file is auto-generated from ISL');
    this.writeLine(`Generated at: ${new Date().toISOString()}`);
    this.writeLine('"""');
    this.writeLine('');
  }

  private writeDataclassImports(): void {
    this.writeLine('from __future__ import annotations');
    this.writeLine('from dataclasses import dataclass, field');
    this.writeLine('from datetime import datetime');
    this.writeLine('from decimal import Decimal');
    this.writeLine('from enum import Enum, auto');
    this.writeLine('from typing import (');
    this.indent++;
    this.writeLine('Any,');
    this.writeLine('Dict,');
    this.writeLine('Generic,');
    this.writeLine('List,');
    this.writeLine('Literal,');
    this.writeLine('Optional,');
    this.writeLine('Protocol,');
    this.writeLine('Set,');
    this.writeLine('TypeAlias,');
    this.writeLine('TypeVar,');
    this.writeLine('Union,');
    this.indent--;
    this.writeLine(')');
    this.writeLine('from uuid import UUID');
    this.writeLine('');
    this.writeLine('');
    this.writeLine('# Type aliases for ISL primitives');
    this.writeLine('Timestamp: TypeAlias = datetime');
    this.writeLine('Duration: TypeAlias = int  # milliseconds');
    this.writeLine('');
    this.writeLine('');
    this.writeLine('@dataclass(frozen=True)');
    this.writeLine('class Money:');
    this.indent++;
    this.writeLine('"""Money type with amount and currency"""');
    this.writeLine('amount: Decimal');
    this.writeLine('currency: str');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  private writePydanticImports(): void {
    this.writeLine('from __future__ import annotations');
    this.writeLine('from datetime import datetime');
    this.writeLine('from decimal import Decimal');
    this.writeLine('from enum import Enum');
    this.writeLine('from typing import (');
    this.indent++;
    this.writeLine('Annotated,');
    this.writeLine('Any,');
    this.writeLine('Dict,');
    this.writeLine('Generic,');
    this.writeLine('List,');
    this.writeLine('Literal,');
    this.writeLine('Optional,');
    this.writeLine('Set,');
    this.writeLine('TypeVar,');
    this.writeLine('Union,');
    this.indent--;
    this.writeLine(')');
    this.writeLine('from uuid import UUID');
    this.writeLine('');
    this.writeLine('from pydantic import (');
    this.indent++;
    this.writeLine('BaseModel,');
    this.writeLine('ConfigDict,');
    this.writeLine('Field,');
    this.writeLine('field_validator,');
    this.writeLine('model_validator,');
    this.writeLine(')');
    this.indent--;
    this.writeLine('from pydantic.functional_validators import AfterValidator');
    this.writeLine('');
    this.writeLine('');
    this.writeLine('# Type aliases');
    this.writeLine('Timestamp = datetime');
    this.writeLine('Duration = int  # milliseconds');
    this.writeLine('');
    this.writeLine('');
    this.writeLine('class Money(BaseModel):');
    this.indent++;
    this.writeLine('"""Money type with amount and currency"""');
    this.writeLine('model_config = ConfigDict(frozen=True)');
    this.writeLine('');
    this.writeLine('amount: Decimal');
    this.writeLine('currency: str');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  // --------------------------------------------------------------------------
  // Enum Generation
  // --------------------------------------------------------------------------

  private generateEnum(decl: EnumDeclaration): void {
    this.writeLine(`class ${decl.name.name}(str, Enum):`);
    this.indent++;
    this.writeLine(`"""Enum: ${decl.name.name}"""`);

    for (const variant of decl.variants) {
      this.writeLine(`${variant.name} = "${variant.name}"`);
    }

    this.indent--;
  }

  // --------------------------------------------------------------------------
  // Type Alias Generation
  // --------------------------------------------------------------------------

  private generateTypeAlias(decl: TypeDeclaration): void {
    const baseType = this.typeExprToPython(decl.baseType);
    
    if (this.options.comments && decl.constraints.length > 0) {
      const constraints = decl.constraints
        .map(c => `${c.name.name}: ${this.constraintValueToString(c)}`)
        .join(', ');
      this.writeLine(`# Constraints: ${constraints}`);
    }

    this.writeLine(`${decl.name.name}: TypeAlias = ${baseType}`);
  }

  private generatePydanticType(decl: TypeDeclaration): void {
    const baseType = this.typeExprToPython(decl.baseType);
    const typeName = decl.name.name;

    // Generate validator function
    if (decl.constraints.length > 0) {
      this.writeLine(`def validate_${this.toSnakeCase(typeName)}(value: ${baseType}) -> ${baseType}:`);
      this.indent++;
      this.writeLine(`"""Validate ${typeName} constraints"""`);

      for (const constraint of decl.constraints) {
        this.generateConstraintValidation(constraint, baseType);
      }

      this.writeLine('return value');
      this.indent--;
      this.writeLine('');

      // Create annotated type
      this.writeLine(`${typeName} = Annotated[${baseType}, AfterValidator(validate_${this.toSnakeCase(typeName)})]`);
    } else {
      this.writeLine(`${typeName}: TypeAlias = ${baseType}`);
    }
  }

  private generateConstraintValidation(constraint: TypeConstraint, baseType: string): void {
    const name = constraint.name.name;
    const value = this.constraintValueToString(constraint);

    switch (name) {
      case 'min':
      case 'min_value':
        this.writeLine(`if value < ${value}:`);
        this.indent++;
        this.writeLine(`raise ValueError(f"Value must be >= ${value}, got {value}")`);
        this.indent--;
        break;

      case 'max':
      case 'max_value':
        this.writeLine(`if value > ${value}:`);
        this.indent++;
        this.writeLine(`raise ValueError(f"Value must be <= ${value}, got {value}")`);
        this.indent--;
        break;

      case 'min_length':
        this.writeLine(`if len(value) < ${value}:`);
        this.indent++;
        this.writeLine(`raise ValueError(f"Length must be >= ${value}, got {len(value)}")`);
        this.indent--;
        break;

      case 'max_length':
        this.writeLine(`if len(value) > ${value}:`);
        this.indent++;
        this.writeLine(`raise ValueError(f"Length must be <= ${value}, got {len(value)}")`);
        this.indent--;
        break;

      case 'pattern':
      case 'format':
        this.writeLine('import re');
        this.writeLine(`if not re.match(r${value}, value):`);
        this.indent++;
        this.writeLine(`raise ValueError(f"Value must match pattern ${value}")`);
        this.indent--;
        break;

      case 'precision':
        this.writeLine(`# Precision: ${value} decimal places`);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Entity Generation (Dataclass)
  // --------------------------------------------------------------------------

  private generateEntity(entity: EntityDeclaration): void {
    this.writeLine('@dataclass');
    this.writeLine(`class ${entity.name.name}:`);
    this.indent++;
    this.writeLine(`"""Entity: ${entity.name.name}"""`);

    for (const field of entity.fields) {
      this.generateDataclassField(field);
    }

    this.indent--;
  }

  private generateDataclassField(field: FieldDeclaration): void {
    const pyType = this.typeExprToPython(field.type);
    const optional = field.optional;
    const annotations = this.getAnnotationNames(field);

    let typeStr = optional ? `Optional[${pyType}]` : pyType;
    let defaultStr = '';

    if (optional) {
      defaultStr = ' = None';
    } else if (field.defaultValue) {
      defaultStr = ` = ${this.exprToPython(field.defaultValue)}`;
    }

    if (this.options.comments && annotations.length > 0) {
      this.writeLine(`# ${annotations.join(', ')}`);
    }

    this.writeLine(`${this.toSnakeCase(field.name.name)}: ${typeStr}${defaultStr}`);
  }

  // --------------------------------------------------------------------------
  // Entity Generation (Pydantic)
  // --------------------------------------------------------------------------

  private generatePydanticEntity(entity: EntityDeclaration): void {
    this.writeLine(`class ${entity.name.name}(BaseModel):`);
    this.indent++;
    this.writeLine(`"""Entity: ${entity.name.name}"""`);

    // Model config
    const hasImmutable = entity.fields.some(f => this.hasAnnotation(f, 'immutable'));
    if (hasImmutable) {
      this.writeLine('model_config = ConfigDict(frozen=True)');
      this.writeLine('');
    }

    for (const field of entity.fields) {
      this.generatePydanticField(field);
    }

    this.indent--;

    // Generate create input model
    this.writeLine('');
    this.writeLine(`class ${entity.name.name}CreateInput(BaseModel):`);
    this.indent++;
    this.writeLine(`"""Input for creating a new ${entity.name.name}"""`);

    const createFields = entity.fields.filter(
      f => !this.hasAnnotation(f, 'computed') && 
           (!this.hasAnnotation(f, 'immutable') || !this.isIdField(f))
    );

    for (const field of createFields) {
      this.generatePydanticField(field);
    }

    if (createFields.length === 0) {
      this.writeLine('pass');
    }

    this.indent--;

    // Generate update input model
    this.writeLine('');
    this.writeLine(`class ${entity.name.name}UpdateInput(BaseModel):`);
    this.indent++;
    this.writeLine(`"""Input for updating a ${entity.name.name}"""`);

    const updateFields = entity.fields.filter(
      f => !this.hasAnnotation(f, 'immutable') && !this.hasAnnotation(f, 'computed')
    );

    for (const field of updateFields) {
      const pyType = this.typeExprToPython(field.type);
      this.writeLine(`${this.toSnakeCase(field.name.name)}: Optional[${pyType}] = None`);
    }

    if (updateFields.length === 0) {
      this.writeLine('pass');
    }

    this.indent--;
  }

  private generatePydanticField(field: FieldDeclaration): void {
    const pyType = this.typeExprToPython(field.type);
    const optional = field.optional;
    const annotations = this.getAnnotationNames(field);
    const fieldName = this.toSnakeCase(field.name.name);

    let typeStr = optional ? `Optional[${pyType}]` : pyType;
    
    // Build Field() arguments
    const fieldArgs: string[] = [];

    if (optional) {
      fieldArgs.push('default=None');
    } else if (field.defaultValue) {
      fieldArgs.push(`default=${this.exprToPython(field.defaultValue)}`);
    }

    // Add constraints from field
    for (const constraint of field.constraints) {
      const name = constraint.name.name;
      const value = this.constraintValueToString(constraint);

      switch (name) {
        case 'min':
        case 'min_value':
          fieldArgs.push(`ge=${value}`);
          break;
        case 'max':
        case 'max_value':
          fieldArgs.push(`le=${value}`);
          break;
        case 'min_length':
          fieldArgs.push(`min_length=${value}`);
          break;
        case 'max_length':
          fieldArgs.push(`max_length=${value}`);
          break;
        case 'pattern':
          fieldArgs.push(`pattern=${value}`);
          break;
      }
    }

    // Add description from annotations
    if (annotations.length > 0) {
      fieldArgs.push(`description="${annotations.join(', ')}"`);
    }

    if (fieldArgs.length > 0) {
      this.writeLine(`${fieldName}: ${typeStr} = Field(${fieldArgs.join(', ')})`);
    } else {
      this.writeLine(`${fieldName}: ${typeStr}`);
    }
  }

  // --------------------------------------------------------------------------
  // Behavior Generation
  // --------------------------------------------------------------------------

  private generateBehavior(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (this.options.comments) {
      this.writeLine('# ' + '='.repeat(76));
      this.writeLine(`# Behavior: ${name}`);
      if (behavior.description) {
        this.writeLine(`# ${behavior.description.value}`);
      }
      this.writeLine('# ' + '='.repeat(76));
      this.writeLine('');
    }

    // Generate input type
    if (behavior.input) {
      this.writeLine('@dataclass');
      this.writeLine(`class ${name}Input:`);
      this.indent++;
      this.writeLine(`"""Input for ${name}"""`);
      for (const field of behavior.input.fields) {
        this.generateDataclassField(field);
      }
      this.indent--;
      this.writeLine('');
    }

    // Generate error types
    if (behavior.output?.errors.length) {
      this.generateBehaviorErrors(name, behavior.output);
    }

    // Generate result type
    this.generateBehaviorResult(behavior);
  }

  private generatePydanticBehavior(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (this.options.comments) {
      this.writeLine('# ' + '='.repeat(76));
      this.writeLine(`# Behavior: ${name}`);
      if (behavior.description) {
        this.writeLine(`# ${behavior.description.value}`);
      }
      this.writeLine('# ' + '='.repeat(76));
      this.writeLine('');
    }

    // Generate input type
    if (behavior.input) {
      this.writeLine(`class ${name}Input(BaseModel):`);
      this.indent++;
      this.writeLine(`"""Input for ${name}"""`);
      for (const field of behavior.input.fields) {
        this.generatePydanticField(field);
      }
      this.indent--;
      this.writeLine('');
    }

    // Generate error types
    if (behavior.output?.errors.length) {
      this.generatePydanticBehaviorErrors(name, behavior.output);
    }

    // Generate result type
    this.generatePydanticBehaviorResult(behavior);
  }

  private generateBehaviorErrors(name: string, output: OutputBlock): void {
    // Error code enum
    this.writeLine(`class ${name}ErrorCode(str, Enum):`);
    this.indent++;
    this.writeLine(`"""Error codes for ${name}"""`);
    for (const error of output.errors) {
      this.writeLine(`${error.name.name} = "${error.name.name}"`);
    }
    this.indent--;
    this.writeLine('');

    // Error dataclass
    this.writeLine('@dataclass');
    this.writeLine(`class ${name}Error:`);
    this.indent++;
    this.writeLine(`"""Error type for ${name}"""`);
    this.writeLine(`code: ${name}ErrorCode`);
    this.writeLine('message: str');
    this.writeLine('retriable: bool = False');
    this.writeLine('retry_after: Optional[int] = None');
    this.writeLine('details: Optional[Dict[str, Any]] = None');
    this.indent--;
    this.writeLine('');
  }

  private generatePydanticBehaviorErrors(name: string, output: OutputBlock): void {
    // Error code enum
    this.writeLine(`class ${name}ErrorCode(str, Enum):`);
    this.indent++;
    this.writeLine(`"""Error codes for ${name}"""`);
    for (const error of output.errors) {
      this.writeLine(`${error.name.name} = "${error.name.name}"`);
    }
    this.indent--;
    this.writeLine('');

    // Error model
    this.writeLine(`class ${name}Error(BaseModel):`);
    this.indent++;
    this.writeLine(`"""Error type for ${name}"""`);
    this.writeLine(`code: ${name}ErrorCode`);
    this.writeLine('message: str');
    this.writeLine('retriable: bool = False');
    this.writeLine('retry_after: Optional[int] = None');
    this.writeLine('details: Optional[Dict[str, Any]] = None');
    this.indent--;
    this.writeLine('');
  }

  private generateBehaviorResult(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (behavior.output) {
      const successType = this.typeExprToPython(behavior.output.success);

      this.writeLine('@dataclass');
      this.writeLine(`class ${name}Success:`);
      this.indent++;
      this.writeLine(`"""Success result for ${name}"""`);
      this.writeLine('success: Literal[True] = True');
      this.writeLine(`data: ${successType} = field(default_factory=lambda: None)  # type: ignore`);
      this.indent--;
      this.writeLine('');

      if (behavior.output.errors.length > 0) {
        this.writeLine('@dataclass');
        this.writeLine(`class ${name}Failure:`);
        this.indent++;
        this.writeLine(`"""Failure result for ${name}"""`);
        this.writeLine('success: Literal[False] = False');
        this.writeLine(`error: ${name}Error = field(default_factory=lambda: None)  # type: ignore`);
        this.indent--;
        this.writeLine('');

        this.writeLine(`${name}Result = Union[${name}Success, ${name}Failure]`);
      } else {
        this.writeLine(`${name}Result = ${name}Success`);
      }
    }
  }

  private generatePydanticBehaviorResult(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (behavior.output) {
      const successType = this.typeExprToPython(behavior.output.success);

      this.writeLine(`class ${name}Success(BaseModel):`);
      this.indent++;
      this.writeLine(`"""Success result for ${name}"""`);
      this.writeLine('success: Literal[True] = True');
      this.writeLine(`data: ${successType}`);
      this.indent--;
      this.writeLine('');

      if (behavior.output.errors.length > 0) {
        this.writeLine(`class ${name}Failure(BaseModel):`);
        this.indent++;
        this.writeLine(`"""Failure result for ${name}"""`);
        this.writeLine('success: Literal[False] = False');
        this.writeLine(`error: ${name}Error`);
        this.indent--;
        this.writeLine('');

        this.writeLine(`${name}Result = Union[${name}Success, ${name}Failure]`);
      } else {
        this.writeLine(`${name}Result = ${name}Success`);
      }
    }

    // Protocol for handler
    this.writeLine('');
    this.writeLine(`class ${name}Handler(Protocol):`);
    this.indent++;
    this.writeLine(`"""Protocol for ${name} handler"""`);
    const inputType = behavior.input ? `${name}Input` : 'None';
    const resultType = behavior.output ? `${name}Result` : 'None';
    this.writeLine(`async def execute(self, input: ${inputType}) -> ${resultType}: ...`);
    this.indent--;
  }

  // --------------------------------------------------------------------------
  // Type Expression Conversion
  // --------------------------------------------------------------------------

  private typeExprToPython(type: TypeExpression): string {
    switch (type.kind) {
      case 'SimpleType':
        return this.simpleTypeToPython(type.name.name);

      case 'GenericType': {
        const name = type.name.name;
        const args = type.typeArguments.map(t => this.typeExprToPython(t)).join(', ');

        if (name === 'List') return `List[${args}]`;
        if (name === 'Set') return `Set[${args}]`;
        if (name === 'Map') return `Dict[${args}]`;
        if (name === 'Optional') return `Optional[${args}]`;

        return `${name}[${args}]`;
      }

      case 'UnionType': {
        const variants = type.variants.map(v => v.name.name);
        return `Union[${variants.join(', ')}]`;
      }

      case 'ObjectType': {
        // For inline objects, we'd need to generate a TypedDict
        return 'Dict[str, Any]';
      }

      case 'ArrayType':
        return `List[${this.typeExprToPython(type.elementType)}]`;

      default:
        return 'Any';
    }
  }

  private simpleTypeToPython(name: string): string {
    const typeMap: Record<string, string> = {
      'String': 'str',
      'Int': 'int',
      'Float': 'float',
      'Decimal': 'Decimal',
      'Boolean': 'bool',
      'UUID': 'UUID',
      'Email': 'str',
      'URL': 'str',
      'Phone': 'str',
      'IP': 'str',
      'Timestamp': 'Timestamp',
      'Date': 'datetime',
      'Duration': 'Duration',
      'Money': 'Money',
      'JSON': 'Dict[str, Any]',
      'void': 'None',
    };

    return typeMap[name] ?? name;
  }

  private exprToPython(expr: any): string {
    switch (expr.kind) {
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return expr.value ? 'True' : 'False';
      case 'NullLiteral':
        return 'None';
      default:
        return 'None';
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private constraintValueToString(constraint: TypeConstraint): string {
    if (!constraint.value) return 'True';

    switch (constraint.value.kind) {
      case 'StringLiteral':
        return `"${constraint.value.value}"`;
      case 'NumberLiteral':
        return String(constraint.value.value);
      case 'BooleanLiteral':
        return constraint.value.value ? 'True' : 'False';
      default:
        return 'None';
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

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/__/g, '_');
  }

  private writeLine(line: string): void {
    const indentStr = '    '.repeat(this.indent);
    this.output.push(indentStr + line);
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Generate Python dataclasses from an ISL domain
 */
export function generatePython(
  domain: DomainDeclaration,
  options?: Partial<GeneratorOptions>
): string {
  const generator = new PythonGenerator({
    language: 'python',
    validation: false,
    comments: true,
    ...options,
  });
  return generator.generate(domain);
}
