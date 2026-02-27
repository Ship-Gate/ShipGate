/**
 * ISL Type Checker
 * 
 * Semantic analysis and type checking for ISL programs.
 */

import type * as AST from '../ast/types.js';
import type { SourceSpan } from '../lexer/tokens.js';

// ============================================================================
// Check Result Types
// ============================================================================

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  span: SourceSpan;
  code?: string;
  relatedInfo?: Array<{
    message: string;
    span: SourceSpan;
  }>;
}

export interface CheckResult {
  valid: boolean;
  diagnostics: Diagnostic[];
  symbols?: SymbolTable;
}

// ============================================================================
// Symbol Table
// ============================================================================

export interface Symbol {
  name: string;
  kind: 'entity' | 'behavior' | 'type' | 'enum' | 'field' | 'parameter';
  declaration: AST.BaseNode;
  type?: AST.TypeExpression;
}

export interface SymbolTable {
  symbols: Map<string, Symbol>;
  scopes: Map<string, SymbolTable>;
}

// ============================================================================
// Check Options
// ============================================================================

export interface CheckOptions {
  /** Allow undefined type references (experimental features) */
  allowUndefinedTypes?: boolean;
  /** Strict mode - treat warnings as errors */
  strict?: boolean;
  /** Custom type definitions */
  customTypes?: Map<string, AST.TypeExpression>;
}

// ============================================================================
// Built-in Types
// ============================================================================

const BUILTIN_TYPES = new Set([
  // Primitive types
  'String', 'Int', 'Float', 'Boolean', 'Void', 'Any',
  // Lowercase variants
  'string', 'int', 'float', 'boolean', 'void', 'any',
  // Common types
  'UUID', 'DateTime', 'Duration', 'Email', 'URL', 'Money',
  // Collections
  'List', 'Set', 'Map', 'Optional', 'Result',
]);

// ============================================================================
// Type Checker Implementation
// ============================================================================

export class TypeChecker {
  private diagnostics: Diagnostic[] = [];
  private symbols: SymbolTable;
  private options: CheckOptions;

  constructor(options: CheckOptions = {}) {
    this.options = options;
    this.symbols = { symbols: new Map(), scopes: new Map() };
  }

  /**
   * Check a domain declaration
   */
  check(ast: AST.DomainDeclaration): CheckResult {
    this.diagnostics = [];
    this.symbols = { symbols: new Map(), scopes: new Map() };

    // First pass: collect all declarations
    this.collectDeclarations(ast);

    // Second pass: validate references
    this.validateDomain(ast);

    const hasErrors = this.diagnostics.some(d => d.severity === 'error');

    return {
      valid: !hasErrors,
      diagnostics: this.diagnostics,
      symbols: this.symbols,
    };
  }

  private collectDeclarations(domain: AST.DomainDeclaration): void {
    // Register domain name
    this.symbols.symbols.set(domain.name.name, {
      name: domain.name.name,
      kind: 'type',
      declaration: domain,
    });

    // Register entities
    for (const entity of domain.entities) {
      if (this.symbols.symbols.has(entity.name.name)) {
        this.addDiagnostic(
          'error',
          `Duplicate declaration: '${entity.name.name}'`,
          entity.name.span,
          'E001'
        );
      } else {
        this.symbols.symbols.set(entity.name.name, {
          name: entity.name.name,
          kind: 'entity',
          declaration: entity,
        });
      }
    }

    // Register types
    for (const type of domain.types) {
      if (this.symbols.symbols.has(type.name.name)) {
        this.addDiagnostic(
          'error',
          `Duplicate declaration: '${type.name.name}'`,
          type.name.span,
          'E001'
        );
      } else {
        this.symbols.symbols.set(type.name.name, {
          name: type.name.name,
          kind: 'type',
          declaration: type,
          type: type.baseType,
        });
      }
    }

    // Register enums
    for (const enumDecl of domain.enums) {
      if (this.symbols.symbols.has(enumDecl.name.name)) {
        this.addDiagnostic(
          'error',
          `Duplicate declaration: '${enumDecl.name.name}'`,
          enumDecl.name.span,
          'E001'
        );
      } else {
        this.symbols.symbols.set(enumDecl.name.name, {
          name: enumDecl.name.name,
          kind: 'enum',
          declaration: enumDecl,
        });
      }
    }

    // Register behaviors
    for (const behavior of domain.behaviors) {
      if (this.symbols.symbols.has(behavior.name.name)) {
        this.addDiagnostic(
          'error',
          `Duplicate declaration: '${behavior.name.name}'`,
          behavior.name.span,
          'E001'
        );
      } else {
        this.symbols.symbols.set(behavior.name.name, {
          name: behavior.name.name,
          kind: 'behavior',
          declaration: behavior,
        });
      }
    }
  }

  private validateDomain(domain: AST.DomainDeclaration): void {
    // Validate entities
    for (const entity of domain.entities) {
      this.validateEntity(entity);
    }

    // Validate behaviors
    for (const behavior of domain.behaviors) {
      this.validateBehavior(behavior);
    }

    // Validate types
    for (const type of domain.types) {
      this.validateTypeDeclaration(type);
    }
  }

  private validateEntity(entity: AST.EntityDeclaration): void {
    // Check fields
    const fieldNames = new Set<string>();
    for (const field of entity.fields) {
      if (fieldNames.has(field.name.name)) {
        this.addDiagnostic(
          'error',
          `Duplicate field: '${field.name.name}'`,
          field.name.span,
          'E002'
        );
      } else {
        fieldNames.add(field.name.name);
      }

      this.validateTypeReference(field.type);
    }

    // Check lifecycle
    if (entity.lifecycle) {
      this.validateLifecycle(entity.lifecycle);
    }
  }

  private validateBehavior(behavior: AST.BehaviorDeclaration): void {
    // Validate input types
    if (behavior.input) {
      for (const field of behavior.input.fields) {
        this.validateTypeReference(field.type);
      }
    }

    // Validate output types
    if (behavior.output) {
      this.validateTypeReference(behavior.output.success);
    }
  }

  private validateTypeDeclaration(type: AST.TypeDeclaration): void {
    this.validateTypeReference(type.baseType);
  }

  private validateTypeReference(typeExpr: AST.TypeExpression): void {
    switch (typeExpr.kind) {
      case 'SimpleType':
        if (!this.isKnownType(typeExpr.name.name)) {
          if (!this.options.allowUndefinedTypes) {
            this.addDiagnostic(
              'error',
              `Unknown type: '${typeExpr.name.name}'`,
              typeExpr.span,
              'E003'
            );
          }
        }
        break;
      case 'GenericType':
        if (!this.isKnownType(typeExpr.name.name)) {
          if (!this.options.allowUndefinedTypes) {
            this.addDiagnostic(
              'error',
              `Unknown type: '${typeExpr.name.name}'`,
              typeExpr.span,
              'E003'
            );
          }
        }
        for (const arg of typeExpr.typeArguments) {
          this.validateTypeReference(arg);
        }
        break;
      case 'UnionType':
        // Union types are always valid
        break;
      case 'ObjectType':
        for (const field of typeExpr.fields) {
          this.validateTypeReference(field.type);
        }
        break;
      case 'ArrayType':
        this.validateTypeReference(typeExpr.elementType);
        break;
    }
  }

  private validateLifecycle(lifecycle: AST.LifecycleBlock): void {
    const states = new Set<string>();
    for (const transition of lifecycle.transitions) {
      for (const state of transition.states) {
        states.add(state.name);
      }
    }
    // Lifecycle states are implicitly valid
  }

  private isKnownType(name: string): boolean {
    // Check built-in types
    if (BUILTIN_TYPES.has(name)) return true;
    // Check custom types
    if (this.options.customTypes?.has(name)) return true;
    // Check declared types
    return this.symbols.symbols.has(name);
  }

  private addDiagnostic(
    severity: DiagnosticSeverity,
    message: string,
    span: SourceSpan,
    code?: string
  ): void {
    // In strict mode, warnings become errors
    const finalSeverity = this.options.strict && severity === 'warning' ? 'error' : severity;
    this.diagnostics.push({ severity: finalSeverity, message, span, code });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check an ISL AST for semantic errors
 */
export function check(ast: AST.DomainDeclaration, options?: CheckOptions): CheckResult {
  const checker = new TypeChecker(options);
  return checker.check(ast);
}

/**
 * Quick validation check - returns true if no errors
 */
export function isValid(ast: AST.DomainDeclaration): boolean {
  return check(ast).valid;
}
