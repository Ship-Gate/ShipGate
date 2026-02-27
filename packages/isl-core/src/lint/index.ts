/**
 * ISL Linter
 * 
 * Style and best-practice checks for ISL programs.
 */

import type * as AST from '../ast/types.js';
import type { SourceSpan } from '../lexer/tokens.js';

// ============================================================================
// Lint Types
// ============================================================================

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintRule {
  id: string;
  name: string;
  description: string;
  severity: LintSeverity;
  enabled: boolean;
}

export interface LintMessage {
  ruleId: string;
  severity: LintSeverity;
  message: string;
  span: SourceSpan;
  fix?: LintFix;
}

export interface LintFix {
  description: string;
  replacement: string;
}

export interface LintResult {
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface LintOptions {
  /** Rules to enable/disable */
  rules?: Partial<Record<string, boolean>>;
  /** Severity overrides */
  severities?: Partial<Record<string, LintSeverity>>;
}

// ============================================================================
// Built-in Rules
// ============================================================================

export const BUILTIN_RULES: LintRule[] = [
  {
    id: 'naming/entity-pascal-case',
    name: 'Entity PascalCase',
    description: 'Entity names should use PascalCase',
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'naming/behavior-pascal-case',
    name: 'Behavior PascalCase',
    description: 'Behavior names should use PascalCase',
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'naming/field-camel-case',
    name: 'Field camelCase',
    description: 'Field names should use camelCase',
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'style/no-empty-blocks',
    name: 'No Empty Blocks',
    description: 'Blocks should not be empty',
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'best-practice/require-description',
    name: 'Require Description',
    description: 'Behaviors should have descriptions',
    severity: 'info',
    enabled: true,
  },
  {
    id: 'best-practice/require-preconditions',
    name: 'Require Preconditions',
    description: 'Behaviors should have preconditions',
    severity: 'info',
    enabled: false,
  },
  {
    id: 'best-practice/require-postconditions',
    name: 'Require Postconditions',
    description: 'Behaviors should have postconditions',
    severity: 'info',
    enabled: false,
  },
  {
    id: 'complexity/max-fields',
    name: 'Max Fields',
    description: 'Entities should not have too many fields',
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'complexity/max-behaviors',
    name: 'Max Behaviors',
    description: 'Domains should not have too many behaviors',
    severity: 'warning',
    enabled: true,
  },
];

// ============================================================================
// Linter Implementation
// ============================================================================

export class Linter {
  private rules: Map<string, LintRule>;
  private messages: LintMessage[] = [];

  constructor(options: LintOptions = {}) {
    this.rules = new Map();
    
    // Initialize rules
    for (const rule of BUILTIN_RULES) {
      const enabled = options.rules?.[rule.id] ?? rule.enabled;
      const severity = options.severities?.[rule.id] ?? rule.severity;
      this.rules.set(rule.id, { ...rule, enabled, severity });
    }
  }

  /**
   * Lint a domain declaration
   */
  lint(ast: AST.DomainDeclaration): LintResult {
    this.messages = [];

    this.lintDomain(ast);

    return this.buildResult();
  }

  private lintDomain(domain: AST.DomainDeclaration): void {
    // Check complexity
    this.checkMaxBehaviors(domain);

    // Lint entities
    for (const entity of domain.entities) {
      this.lintEntity(entity);
    }

    // Lint behaviors
    for (const behavior of domain.behaviors) {
      this.lintBehavior(behavior);
    }

    // Lint types
    for (const type of domain.types) {
      this.lintTypeDeclaration(type);
    }

    // Lint enums
    for (const enumDecl of domain.enums) {
      this.lintEnum(enumDecl);
    }
  }

  private lintEntity(entity: AST.EntityDeclaration): void {
    // Check naming
    this.checkPascalCase('naming/entity-pascal-case', entity.name);

    // Check field count
    this.checkMaxFields(entity);

    // Lint fields
    for (const field of entity.fields) {
      this.lintField(field);
    }

    // Check for empty blocks
    if (entity.fields.length === 0 && !entity.invariants && !entity.lifecycle) {
      this.addMessage(
        'style/no-empty-blocks',
        `Entity '${entity.name.name}' has no fields`,
        entity.span
      );
    }
  }

  private lintBehavior(behavior: AST.BehaviorDeclaration): void {
    // Check naming
    this.checkPascalCase('naming/behavior-pascal-case', behavior.name);

    // Check for description
    if (!behavior.description) {
      this.addMessage(
        'best-practice/require-description',
        `Behavior '${behavior.name.name}' should have a description`,
        behavior.name.span
      );
    }

    // Check for preconditions
    if (!behavior.preconditions || behavior.preconditions.conditions.length === 0) {
      this.addMessage(
        'best-practice/require-preconditions',
        `Behavior '${behavior.name.name}' should have preconditions`,
        behavior.name.span
      );
    }

    // Check for postconditions
    if (!behavior.postconditions || behavior.postconditions.conditions.length === 0) {
      this.addMessage(
        'best-practice/require-postconditions',
        `Behavior '${behavior.name.name}' should have postconditions`,
        behavior.name.span
      );
    }

    // Lint input fields
    if (behavior.input) {
      for (const field of behavior.input.fields) {
        this.lintField(field);
      }
    }
  }

  private lintField(field: AST.FieldDeclaration): void {
    // Check naming
    this.checkCamelCase('naming/field-camel-case', field.name);
  }

  private lintTypeDeclaration(type: AST.TypeDeclaration): void {
    // Check naming
    this.checkPascalCase('naming/entity-pascal-case', type.name);
  }

  private lintEnum(enumDecl: AST.EnumDeclaration): void {
    // Check naming
    this.checkPascalCase('naming/entity-pascal-case', enumDecl.name);
  }

  private checkPascalCase(ruleId: string, identifier: AST.Identifier): void {
    const name = identifier.name;
    if (!this.isPascalCase(name)) {
      const suggested = this.toPascalCase(name);
      this.addMessage(
        ruleId,
        `'${name}' should be PascalCase (suggested: '${suggested}')`,
        identifier.span,
        { description: 'Rename to PascalCase', replacement: suggested }
      );
    }
  }

  private checkCamelCase(ruleId: string, identifier: AST.Identifier): void {
    const name = identifier.name;
    if (!this.isCamelCase(name)) {
      const suggested = this.toCamelCase(name);
      this.addMessage(
        ruleId,
        `'${name}' should be camelCase (suggested: '${suggested}')`,
        identifier.span,
        { description: 'Rename to camelCase', replacement: suggested }
      );
    }
  }

  private checkMaxFields(entity: AST.EntityDeclaration): void {
    const MAX_FIELDS = 20;
    if (entity.fields.length > MAX_FIELDS) {
      this.addMessage(
        'complexity/max-fields',
        `Entity '${entity.name.name}' has ${entity.fields.length} fields (max recommended: ${MAX_FIELDS})`,
        entity.span
      );
    }
  }

  private checkMaxBehaviors(domain: AST.DomainDeclaration): void {
    const MAX_BEHAVIORS = 50;
    if (domain.behaviors.length > MAX_BEHAVIORS) {
      this.addMessage(
        'complexity/max-behaviors',
        `Domain '${domain.name.name}' has ${domain.behaviors.length} behaviors (max recommended: ${MAX_BEHAVIORS})`,
        domain.span
      );
    }
  }

  // Naming helpers

  private isPascalCase(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  private isCamelCase(name: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }

  private toPascalCase(name: string): string {
    return name
      .split(/[_-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  private toCamelCase(name: string): string {
    const pascal = this.toPascalCase(name);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  // Message handling

  private addMessage(ruleId: string, message: string, span: SourceSpan, fix?: LintFix): void {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return;

    this.messages.push({
      ruleId,
      severity: rule.severity,
      message,
      span,
      fix,
    });
  }

  private buildResult(): LintResult {
    const errorCount = this.messages.filter(m => m.severity === 'error').length;
    const warningCount = this.messages.filter(m => m.severity === 'warning').length;
    const infoCount = this.messages.filter(m => m.severity === 'info').length;

    return {
      messages: this.messages,
      errorCount,
      warningCount,
      infoCount,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Lint an ISL AST
 */
export function lint(ast: AST.DomainDeclaration, options?: LintOptions): LintResult {
  const linter = new Linter(options);
  return linter.lint(ast);
}

/**
 * Get all available lint rules
 */
export function getRules(): LintRule[] {
  return [...BUILTIN_RULES];
}
