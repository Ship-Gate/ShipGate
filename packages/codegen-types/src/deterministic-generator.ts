/**
 * Deterministic TypeScript Type Generator
 *
 * Refactored generator that uses @isl-lang/codegen-core for stable,
 * deterministic output. Produces identical output for identical input,
 * with minimal diffs between regeneration runs.
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
} from '@isl-lang/isl-core';

import type { GeneratorOptions } from './generator.js';

// Import utilities from codegen-core (would be imported from package in production)
// For now, inline the necessary utilities

// ============================================================================
// Deterministic Utilities (inline from @isl-lang/codegen-core)
// ============================================================================

interface CodePrinter {
  readonly indentLevel: number;
  writeLine(line: string): void;
  write(text: string): void;
  blankLine(): void;
  indent(): void;
  dedent(): void;
  writeBlock(opener: string, closer: string, content: () => void): void;
  toString(): string;
}

function createPrinter(indentSize = 2): CodePrinter {
  const lines: string[] = [];
  let currentLine = '';
  let indentLevel = 0;

  const indentStr = ' '.repeat(indentSize);
  const getIndent = () => indentStr.repeat(indentLevel);

  return {
    get indentLevel() {
      return indentLevel;
    },
    writeLine(line: string): void {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(getIndent() + line);
    },
    write(text: string): void {
      if (!currentLine) currentLine = getIndent();
      currentLine += text;
    },
    blankLine(): void {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push('');
    },
    indent(): void {
      indentLevel++;
    },
    dedent(): void {
      if (indentLevel > 0) indentLevel--;
    },
    writeBlock(opener: string, closer: string, content: () => void): void {
      this.writeLine(opener);
      this.indent();
      content();
      this.dedent();
      this.writeLine(closer);
    },
    toString(): string {
      const allLines = currentLine ? [...lines, currentLine] : lines;
      return allLines.join('\n') + '\n';
    },
  };
}

function hashContent(content: string, length = 8): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, length);
}

function sortByName<T extends { name: string | { name: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = typeof a.name === 'string' ? a.name : a.name.name;
    const nameB = typeof b.name === 'string' ? b.name : b.name.name;
    return nameA.localeCompare(nameB);
  });
}

// ============================================================================
// Deterministic TypeScript Generator
// ============================================================================

export interface DeterministicGeneratorOptions extends GeneratorOptions {
  /** Include content hash in header */
  includeHash?: boolean;
  /** Source ISL file path (for header) */
  sourcePath?: string;
  /** Generator version (for header) */
  generatorVersion?: string;
}

export class DeterministicTypeScriptGenerator {
  private printer!: CodePrinter;
  private options: DeterministicGeneratorOptions;
  private sourceHash: string = '';

  constructor(options: DeterministicGeneratorOptions) {
    this.options = {
      comments: true,
      includeHash: true,
      generatorVersion: '1.0.0',
      ...options,
    };
  }

  /**
   * Generate TypeScript types from a domain
   */
  generate(domain: DomainDeclaration, islSource?: string): string {
    this.printer = createPrinter(2);
    this.sourceHash = islSource ? hashContent(islSource) : hashContent(domain.name.name);

    // Header (deterministic - no timestamps)
    this.writeHeader(domain);

    // Utility types (always in same order)
    this.writeUtilityTypes();

    // Enums (sorted alphabetically)
    const sortedEnums = sortByName(domain.enums);
    if (sortedEnums.length > 0) {
      this.writeSectionComment('Enums');
      for (const enumDecl of sortedEnums) {
        this.generateEnum(enumDecl);
        this.printer.blankLine();
      }
    }

    // Type aliases (sorted alphabetically)
    const sortedTypes = sortByName(domain.types);
    if (sortedTypes.length > 0) {
      this.writeSectionComment('Type Aliases');
      for (const typeDecl of sortedTypes) {
        this.generateTypeAlias(typeDecl);
        this.printer.blankLine();
      }
    }

    // Entities (sorted alphabetically)
    const sortedEntities = sortByName(domain.entities);
    if (sortedEntities.length > 0) {
      this.writeSectionComment('Entities');
      for (const entity of sortedEntities) {
        this.generateEntity(entity);
        this.printer.blankLine();
      }
    }

    // Behaviors (sorted alphabetically)
    const sortedBehaviors = sortByName(domain.behaviors);
    if (sortedBehaviors.length > 0) {
      for (const behavior of sortedBehaviors) {
        this.writeSectionComment(`Behavior: ${behavior.name.name}`);
        this.generateBehavior(behavior);
        this.printer.blankLine();
      }
    }

    return this.printer.toString();
  }

  // --------------------------------------------------------------------------
  // Header Generation (Deterministic)
  // --------------------------------------------------------------------------

  private writeHeader(domain: DomainDeclaration): void {
    const lines: string[] = ['/**', ' * @generated - DO NOT EDIT'];

    if (this.options.sourcePath) {
      lines.push(` * Source: ${this.options.sourcePath}`);
    }

    lines.push(` * Generator: @isl-lang/codegen-types@${this.options.generatorVersion}`);

    if (this.options.includeHash) {
      lines.push(` * Hash: ${this.sourceHash}`);
    }

    // Domain info
    lines.push(` * Domain: ${domain.name.name}`);
    if (domain.version) {
      lines.push(` * Version: ${domain.version.value}`);
    }

    lines.push(' */');

    for (const line of lines) {
      this.printer.writeLine(line);
    }
    this.printer.blankLine();
  }

  private writeSectionComment(title: string): void {
    const line = '='.repeat(76);
    this.printer.writeLine(`// ${line}`);
    this.printer.writeLine(`// ${title}`);
    this.printer.writeLine(`// ${line}`);
    this.printer.blankLine();
  }

  // --------------------------------------------------------------------------
  // Utility Types (Stable Order)
  // --------------------------------------------------------------------------

  private writeUtilityTypes(): void {
    this.writeSectionComment('Utility Types');

    // Always in this exact order
    const utilityTypes = [
      ['UUID', 'string', 'UUID string type'],
      ['Timestamp', 'string', 'ISO 8601 timestamp string'],
      ['Duration', 'number', 'Duration in milliseconds'],
      ['Decimal', 'string', 'Decimal number (use string for precision)'],
    ];

    for (const [name, type, description] of utilityTypes) {
      if (this.options.comments) {
        this.printer.writeLine(`/** ${description} */`);
      }
      this.printer.writeLine(`export type ${name} = ${type};`);
      this.printer.blankLine();
    }

    // Money type (always same structure)
    if (this.options.comments) {
      this.printer.writeLine('/** Money type */');
    }
    this.printer.writeBlock('export interface Money {', '}', () => {
      this.printer.writeLine('amount: Decimal;');
      this.printer.writeLine('currency: string;');
    });
    this.printer.blankLine();
  }

  // --------------------------------------------------------------------------
  // Enum Generation
  // --------------------------------------------------------------------------

  private generateEnum(decl: EnumDeclaration): void {
    if (this.options.comments) {
      this.printer.writeLine(`/** Enum: ${decl.name.name} */`);
    }

    this.printer.writeBlock(`export enum ${decl.name.name} {`, '}', () => {
      // Preserve declaration order for enum values
      for (const variant of decl.variants) {
        this.printer.writeLine(`${variant.name} = '${variant.name}',`);
      }
    });

    // Generate values array (stable)
    this.printer.blankLine();
    const variants = decl.variants.map((v) => `'${v.name}'`).join(', ');
    this.printer.writeLine(
      `export const ${decl.name.name}Values = [${variants}] as const;`
    );
  }

  // --------------------------------------------------------------------------
  // Type Alias Generation
  // --------------------------------------------------------------------------

  private generateTypeAlias(decl: TypeDeclaration): void {
    if (this.options.comments) {
      this.printer.writeLine(`/** Type: ${decl.name.name} */`);
      if (decl.constraints.length > 0) {
        const constraints = decl.constraints
          .map((c) => `${c.name.name}: ${this.constraintValueToString(c)}`)
          .join(', ');
        this.printer.writeLine(`/** Constraints: ${constraints} */`);
      }
    }

    const baseType = this.typeExprToTS(decl.baseType);
    this.printer.writeLine(`export type ${decl.name.name} = ${baseType};`);

    // Branded type for nominal typing
    this.printer.blankLine();
    if (this.options.comments) {
      this.printer.writeLine(`/** Branded type for ${decl.name.name} validation */`);
    }
    this.printer.writeLine(
      `export type ${decl.name.name}Branded = ${baseType} & { readonly __brand: '${decl.name.name}' };`
    );
  }

  // --------------------------------------------------------------------------
  // Entity Generation
  // --------------------------------------------------------------------------

  private generateEntity(entity: EntityDeclaration): void {
    if (this.options.comments) {
      this.printer.writeLine(`/** Entity: ${entity.name.name} */`);
    }

    this.printer.writeBlock(`export interface ${entity.name.name} {`, '}', () => {
      // Sort fields: id first, then required, then optional, then alphabetically within groups
      const sortedFields = this.sortFields(entity.fields);
      for (const field of sortedFields) {
        this.generateField(field);
      }
    });

    // Create input type
    this.printer.blankLine();
    if (this.options.comments) {
      this.printer.writeLine(`/** Input for creating a new ${entity.name.name} */`);
    }
    this.printer.writeBlock(`export interface ${entity.name.name}CreateInput {`, '}', () => {
      const createFields = entity.fields.filter(
        (f) => !this.hasAnnotation(f, 'computed') && !this.isAutoId(f)
      );
      const sortedCreateFields = this.sortFields(createFields);
      for (const field of sortedCreateFields) {
        this.generateField(field);
      }
    });

    // Update input type
    this.printer.blankLine();
    if (this.options.comments) {
      this.printer.writeLine(`/** Input for updating a ${entity.name.name} */`);
    }
    const mutableFields = entity.fields.filter(
      (f) => !this.hasAnnotation(f, 'immutable') && !this.hasAnnotation(f, 'computed')
    );
    if (mutableFields.length > 0) {
      const fieldNames = mutableFields
        .map((f) => f.name.name)
        .sort()
        .map((n) => `'${n}'`)
        .join(' | ');
      this.printer.writeLine(
        `export type ${entity.name.name}UpdateInput = Partial<Pick<${entity.name.name}, ${fieldNames}>>;`
      );
    } else {
      this.printer.writeLine(
        `export type ${entity.name.name}UpdateInput = Record<string, never>;`
      );
    }
  }

  private sortFields(fields: FieldDeclaration[]): FieldDeclaration[] {
    return [...fields].sort((a, b) => {
      // id fields first
      const aIsId = a.name.name === 'id' || a.name.name.endsWith('_id');
      const bIsId = b.name.name === 'id' || b.name.name.endsWith('_id');
      if (aIsId !== bIsId) return aIsId ? -1 : 1;

      // required before optional
      if (a.optional !== b.optional) return a.optional ? 1 : -1;

      // alphabetical
      return a.name.name.localeCompare(b.name.name);
    });
  }

  private generateField(field: FieldDeclaration): void {
    const annotations = this.getAnnotationNames(field);

    if (this.options.comments && annotations.length > 0) {
      this.printer.writeLine(`/** ${annotations.sort().join(', ')} */`);
    }

    const readonly = this.hasAnnotation(field, 'immutable') ? 'readonly ' : '';
    const optional = field.optional ? '?' : '';
    const tsType = this.typeExprToTS(field.type);

    this.printer.writeLine(`${readonly}${field.name.name}${optional}: ${tsType};`);
  }

  // --------------------------------------------------------------------------
  // Behavior Generation
  // --------------------------------------------------------------------------

  private generateBehavior(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (this.options.comments && behavior.description) {
      this.printer.writeLine(`/** ${behavior.description.value} */`);
    }

    // Input type
    if (behavior.input) {
      if (this.options.comments) {
        this.printer.writeLine(`/** Input for ${name} */`);
      }
      this.printer.writeBlock(`export interface ${name}Input {`, '}', () => {
        const sortedFields = this.sortFields(behavior.input!.fields);
        for (const field of sortedFields) {
          this.generateField(field);
        }
      });
      this.printer.blankLine();
    }

    // Output/Error types
    if (behavior.output) {
      // Error codes (sorted)
      if (behavior.output.errors.length > 0) {
        if (this.options.comments) {
          this.printer.writeLine(`/** Error codes for ${name} */`);
        }
        const errorCodes = behavior.output.errors
          .map((e) => e.name.name)
          .sort()
          .map((n) => `'${n}'`)
          .join(' | ');
        this.printer.writeLine(`export type ${name}ErrorCode = ${errorCodes};`);
        this.printer.blankLine();

        // Error interface
        if (this.options.comments) {
          this.printer.writeLine(`/** Error type for ${name} */`);
        }
        this.printer.writeBlock(`export interface ${name}Error {`, '}', () => {
          this.printer.writeLine(`code: ${name}ErrorCode;`);
          this.printer.writeLine('message: string;');
          this.printer.writeLine('retriable: boolean;');
          this.printer.writeLine('retryAfter?: number;');
          this.printer.writeLine('details?: Record<string, unknown>;');
        });
        this.printer.blankLine();
      }

      // Success type
      const successType = this.typeExprToTS(behavior.output.success);
      if (this.options.comments) {
        this.printer.writeLine(`/** Success type for ${name} */`);
      }
      this.printer.writeLine(`export type ${name}Success = ${successType};`);
      this.printer.blankLine();

      // Result type
      if (this.options.comments) {
        this.printer.writeLine(`/** Result type for ${name} */`);
      }
      this.printer.writeLine(`export type ${name}Result =`);
      this.printer.indent();
      this.printer.writeLine(`| { success: true; data: ${name}Success }`);
      if (behavior.output.errors.length > 0) {
        this.printer.writeLine(`| { success: false; error: ${name}Error };`);
      } else {
        this.printer.writeLine(
          '| { success: false; error: { code: string; message: string } };'
        );
      }
      this.printer.dedent();
      this.printer.blankLine();
    }

    // Function type
    const inputType = behavior.input ? `${name}Input` : 'void';
    const resultType = behavior.output ? `${name}Result` : 'void';

    if (this.options.comments) {
      this.printer.writeLine(`/** Function type for ${name} behavior */`);
    }
    this.printer.writeLine(
      `export type ${name}Function = (input: ${inputType}) => Promise<${resultType}>;`
    );
    this.printer.blankLine();

    if (this.options.comments) {
      this.printer.writeLine(`/** Handler interface for ${name} behavior */`);
    }
    this.printer.writeBlock(`export interface ${name}Handler {`, '}', () => {
      this.printer.writeLine(`execute(input: ${inputType}): Promise<${resultType}>;`);
    });
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
        const args = type.typeArguments.map((t) => this.typeExprToTS(t)).join(', ');

        if (name === 'List') return `${args}[]`;
        if (name === 'Set') return `Set<${args}>`;
        if (name === 'Map') return `Map<${args}>`;
        if (name === 'Optional') return `${args} | null`;

        return `${name}<${args}>`;
      }

      case 'UnionType': {
        const variants = type.variants
          .map((v) => v.name.name)
          .sort()
          .map((name) => `'${name}'`)
          .join(' | ');
        return variants;
      }

      case 'ObjectType': {
        const fields = type.fields
          .map(
            (f) =>
              `${f.name.name}${f.optional ? '?' : ''}: ${this.typeExprToTS(f.type)}`
          )
          .sort()
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
      String: 'string',
      Int: 'number',
      Float: 'number',
      Decimal: 'Decimal',
      Boolean: 'boolean',
      UUID: 'UUID',
      Email: 'string',
      URL: 'string',
      Phone: 'string',
      IP: 'string',
      Timestamp: 'Timestamp',
      Date: 'string',
      Duration: 'Duration',
      Money: 'Money',
      JSON: 'Record<string, unknown>',
      void: 'void',
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
    return field.annotations.map((a) => a.name.name);
  }

  private hasAnnotation(field: FieldDeclaration, name: string): boolean {
    return field.annotations.some(
      (a) => a.name.name.toLowerCase() === name.toLowerCase()
    );
  }

  private isAutoId(field: FieldDeclaration): boolean {
    return (
      field.name.name === 'id' &&
      this.hasAnnotation(field, 'immutable') &&
      this.hasAnnotation(field, 'unique')
    );
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate deterministic TypeScript types from an ISL domain
 */
export function generateDeterministicTypeScript(
  domain: DomainDeclaration,
  options?: Partial<DeterministicGeneratorOptions>,
  islSource?: string
): string {
  const generator = new DeterministicTypeScriptGenerator({
    language: 'typescript',
    validation: false,
    comments: true,
    ...options,
  });
  return generator.generate(domain, islSource);
}
