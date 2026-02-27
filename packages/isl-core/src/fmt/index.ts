/**
 * ISL Formatter
 * 
 * Pretty-prints ISL AST back to source code.
 */

import type * as AST from '../ast/types.js';

// ============================================================================
// Format Options
// ============================================================================

export interface FormatOptions {
  /** Indentation string (default: 2 spaces) */
  indent?: string;
  /** Maximum line width (default: 80) */
  maxWidth?: number;
  /** Insert blank lines between declarations */
  blankLinesBetweenDeclarations?: boolean;
  /** Sort declarations alphabetically */
  sortDeclarations?: boolean;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  indent: '  ',
  maxWidth: 80,
  blankLinesBetweenDeclarations: true,
  sortDeclarations: false,
};

// ============================================================================
// Formatter Implementation
// ============================================================================

export class Formatter {
  private options: Required<FormatOptions>;
  private indentLevel: number = 0;

  constructor(options: FormatOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Format a domain declaration to ISL source
   */
  format(ast: AST.DomainDeclaration): string {
    this.indentLevel = 0;
    return this.formatDomain(ast);
  }

  private formatDomain(domain: AST.DomainDeclaration): string {
    const parts: string[] = [];

    parts.push(`domain ${domain.name.name} {`);
    this.indentLevel++;

    // Version
    if (domain.version) {
      parts.push(this.line(`version: "${domain.version.value}"`));
    }

    // Imports
    if (domain.imports.length > 0) {
      if (parts.length > 1 && this.options.blankLinesBetweenDeclarations) {
        parts.push('');
      }
      parts.push(this.line('imports {'));
      this.indentLevel++;
      for (const imp of domain.imports) {
        parts.push(this.formatImport(imp));
      }
      this.indentLevel--;
      parts.push(this.line('}'));
    }

    // Entities
    const entities = this.options.sortDeclarations
      ? [...domain.entities].sort((a, b) => a.name.name.localeCompare(b.name.name))
      : domain.entities;

    for (const entity of entities) {
      if (this.options.blankLinesBetweenDeclarations) {
        parts.push('');
      }
      parts.push(this.formatEntity(entity));
    }

    // Types
    const types = this.options.sortDeclarations
      ? [...domain.types].sort((a, b) => a.name.name.localeCompare(b.name.name))
      : domain.types;

    for (const type of types) {
      if (this.options.blankLinesBetweenDeclarations) {
        parts.push('');
      }
      parts.push(this.formatTypeDeclaration(type));
    }

    // Enums
    const enums = this.options.sortDeclarations
      ? [...domain.enums].sort((a, b) => a.name.name.localeCompare(b.name.name))
      : domain.enums;

    for (const enumDecl of enums) {
      if (this.options.blankLinesBetweenDeclarations) {
        parts.push('');
      }
      parts.push(this.formatEnum(enumDecl));
    }

    // Behaviors
    const behaviors = this.options.sortDeclarations
      ? [...domain.behaviors].sort((a, b) => a.name.name.localeCompare(b.name.name))
      : domain.behaviors;

    for (const behavior of behaviors) {
      if (this.options.blankLinesBetweenDeclarations) {
        parts.push('');
      }
      parts.push(this.formatBehavior(behavior));
    }

    // Invariants
    for (const invariantsBlock of domain.invariants) {
      if (this.options.blankLinesBetweenDeclarations) {
        parts.push('');
      }
      parts.push(this.formatInvariantsBlock(invariantsBlock));
    }

    this.indentLevel--;
    parts.push('}');

    return parts.join('\n');
  }

  private formatImport(imp: AST.ImportDeclaration): string {
    const names = imp.names.map(n => n.name).join(', ');
    if (imp.names.length > 1) {
      return this.line(`{ ${names} } from "${imp.from.value}"`);
    }
    return this.line(`${names} from "${imp.from.value}"`);
  }

  private formatEntity(entity: AST.EntityDeclaration): string {
    const parts: string[] = [];
    parts.push(this.line(`entity ${entity.name.name} {`));
    this.indentLevel++;

    for (const field of entity.fields) {
      parts.push(this.formatField(field));
    }

    if (entity.invariants && entity.invariants.length > 0) {
      parts.push('');
      parts.push(this.line('invariants {'));
      this.indentLevel++;
      for (const inv of entity.invariants) {
        parts.push(this.line(`- ${this.formatExpression(inv.expression)}`));
      }
      this.indentLevel--;
      parts.push(this.line('}'));
    }

    if (entity.lifecycle) {
      parts.push('');
      parts.push(this.formatLifecycle(entity.lifecycle));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatField(field: AST.FieldDeclaration): string {
    let line = `${field.name.name}: ${this.formatTypeExpression(field.type)}`;
    
    if (field.optional) {
      line += '?';
    }

    if (field.annotations.length > 0) {
      const annotations = field.annotations
        .map(a => a.value ? `${a.name.name}: ${this.formatExpression(a.value)}` : a.name.name)
        .join(', ');
      line += ` [${annotations}]`;
    }

    if (field.constraints.length > 0) {
      const constraints = field.constraints
        .map(c => c.value ? `${c.name.name}: ${this.formatExpression(c.value)}` : c.name.name)
        .join(', ');
      line += ` { ${constraints} }`;
    }

    if (field.defaultValue) {
      line += ` = ${this.formatExpression(field.defaultValue)}`;
    }

    return this.line(line);
  }

  private formatTypeDeclaration(type: AST.TypeDeclaration): string {
    let line = `type ${type.name.name} = ${this.formatTypeExpression(type.baseType)}`;
    
    if (type.constraints.length > 0) {
      const constraints = type.constraints
        .map(c => c.value ? `${c.name.name}: ${this.formatExpression(c.value)}` : c.name.name)
        .join(', ');
      line += ` { ${constraints} }`;
    }

    return this.line(line);
  }

  private formatEnum(enumDecl: AST.EnumDeclaration): string {
    const parts: string[] = [];
    parts.push(this.line(`enum ${enumDecl.name.name} {`));
    this.indentLevel++;
    
    const variants = enumDecl.variants.map(v => v.name).join(', ');
    parts.push(this.line(variants));
    
    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatBehavior(behavior: AST.BehaviorDeclaration): string {
    const parts: string[] = [];
    parts.push(this.line(`behavior ${behavior.name.name} {`));
    this.indentLevel++;

    if (behavior.description) {
      parts.push(this.line(`description: "${behavior.description.value}"`));
    }

    if (behavior.actors) {
      parts.push('');
      parts.push(this.formatActorsBlock(behavior.actors));
    }

    if (behavior.input) {
      parts.push('');
      parts.push(this.formatInputBlock(behavior.input));
    }

    if (behavior.output) {
      parts.push('');
      parts.push(this.formatOutputBlock(behavior.output));
    }

    if (behavior.preconditions) {
      parts.push('');
      parts.push(this.formatConditionBlock('preconditions', behavior.preconditions));
    }

    if (behavior.postconditions) {
      parts.push('');
      parts.push(this.formatConditionBlock('postconditions', behavior.postconditions));
    }

    if (behavior.invariants && behavior.invariants.length > 0) {
      parts.push('');
      parts.push(this.line('invariants {'));
      this.indentLevel++;
      for (const inv of behavior.invariants) {
        parts.push(this.line(`- ${this.formatExpression(inv.expression)}`));
      }
      this.indentLevel--;
      parts.push(this.line('}'));
    }

    if (behavior.temporal) {
      parts.push('');
      parts.push(this.formatTemporalBlock(behavior.temporal));
    }

    if (behavior.security) {
      parts.push('');
      parts.push(this.formatSecurityBlock(behavior.security));
    }

    if (behavior.compliance) {
      parts.push('');
      parts.push(this.formatComplianceBlock(behavior.compliance));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatActorsBlock(actors: AST.ActorsBlock): string {
    const parts: string[] = [];
    parts.push(this.line('actors {'));
    this.indentLevel++;

    for (const actor of actors.actors) {
      parts.push(this.line(`${actor.name.name} {`));
      this.indentLevel++;
      for (const constraint of actor.constraints) {
        parts.push(this.line(`${constraint.type}: ${this.formatExpression(constraint.value)}`));
      }
      this.indentLevel--;
      parts.push(this.line('}'));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatInputBlock(input: AST.InputBlock): string {
    const parts: string[] = [];
    parts.push(this.line('input {'));
    this.indentLevel++;

    for (const field of input.fields) {
      parts.push(this.formatField(field));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatOutputBlock(output: AST.OutputBlock): string {
    const parts: string[] = [];
    parts.push(this.line('output {'));
    this.indentLevel++;

    parts.push(this.line(`success: ${this.formatTypeExpression(output.success)}`));

    if (output.errors.length > 0) {
      parts.push(this.line('failure {'));
      this.indentLevel++;
      for (const err of output.errors) {
        parts.push(this.formatErrorDeclaration(err));
      }
      this.indentLevel--;
      parts.push(this.line('}'));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatErrorDeclaration(error: AST.ErrorDeclaration): string {
    const props: string[] = [];
    if (error.when) {
      props.push(`when: "${error.when.value}"`);
    }
    if (error.retriable !== undefined) {
      props.push(`retriable: ${error.retriable}`);
    }
    if (error.retryAfter) {
      props.push(`retry_after: ${this.formatExpression(error.retryAfter)}`);
    }

    if (props.length === 0) {
      return this.line(error.name.name);
    }

    const parts: string[] = [];
    parts.push(this.line(`${error.name.name} {`));
    this.indentLevel++;
    for (const prop of props) {
      parts.push(this.line(prop));
    }
    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatConditionBlock(name: string, block: AST.ConditionBlock): string {
    const parts: string[] = [];
    parts.push(this.line(`${name} {`));
    this.indentLevel++;

    for (const condition of block.conditions) {
      if (condition.guard) {
        const guardName = typeof condition.guard === 'string' ? condition.guard : condition.guard.name;
        parts.push(this.line(`${guardName} implies {`));
        this.indentLevel++;
      }
      
      for (const stmt of condition.statements) {
        parts.push(this.line(`- ${this.formatExpression(stmt.expression)}`));
      }
      
      if (condition.guard) {
        this.indentLevel--;
        parts.push(this.line('}'));
      }
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatInvariantsBlock(block: AST.InvariantsBlock): string {
    const parts: string[] = [];
    parts.push(this.line(`invariants ${block.name.name} {`));
    this.indentLevel++;

    if (block.description) {
      parts.push(this.line(`description: "${block.description.value}"`));
    }

    if (block.scope) {
      parts.push(this.line(`scope: ${block.scope}`));
    }

    for (const inv of block.invariants) {
      parts.push(this.line(`- ${this.formatExpression(inv.expression)}`));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatTemporalBlock(temporal: AST.TemporalBlock): string {
    const parts: string[] = [];
    parts.push(this.line('temporal {'));
    this.indentLevel++;

    for (const req of temporal.requirements) {
      let line = `- ${req.type}`;
      if (req.duration) {
        line += ` ${req.duration.value}${req.duration.unit}`;
      }
      if (req.percentile) {
        line += ` (${req.percentile})`;
      }
      line += `: ${this.formatExpression(req.condition)}`;
      parts.push(this.line(line));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatSecurityBlock(security: AST.SecurityBlock): string {
    const parts: string[] = [];
    parts.push(this.line('security {'));
    this.indentLevel++;

    for (const req of security.requirements) {
      parts.push(this.line(`- ${this.formatExpression(req.expression)}`));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatComplianceBlock(compliance: AST.ComplianceBlock): string {
    const parts: string[] = [];
    parts.push(this.line('compliance {'));
    this.indentLevel++;

    for (const standard of compliance.standards) {
      parts.push(this.line(`${standard.name.name} {`));
      this.indentLevel++;
      for (const req of standard.requirements) {
        parts.push(this.line(`- ${this.formatExpression(req.expression)}`));
      }
      this.indentLevel--;
      parts.push(this.line('}'));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatLifecycle(lifecycle: AST.LifecycleBlock): string {
    const parts: string[] = [];
    parts.push(this.line('lifecycle {'));
    this.indentLevel++;

    for (const transition of lifecycle.transitions) {
      const states = transition.states.map(s => s.name).join(' -> ');
      parts.push(this.line(states));
    }

    this.indentLevel--;
    parts.push(this.line('}'));
    return parts.join('\n');
  }

  private formatTypeExpression(type: AST.TypeExpression): string {
    switch (type.kind) {
      case 'SimpleType':
        return type.name.name;
      case 'GenericType':
        const args = type.typeArguments.map(t => this.formatTypeExpression(t)).join(', ');
        return `${type.name.name}<${args}>`;
      case 'UnionType':
        return '| ' + type.variants.map(v => v.name.name).join(' | ');
      case 'ObjectType':
        const fields = type.fields.map(f => `${f.name.name}: ${this.formatTypeExpression(f.type)}`);
        return `{ ${fields.join(', ')} }`;
      case 'ArrayType':
        return `List<${this.formatTypeExpression(type.elementType)}>`;
    }
  }

  private formatExpression(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'NumberLiteral':
        return expr.unit ? `${expr.value}${expr.unit}` : String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'NullLiteral':
        return 'null';
      case 'DurationLiteral':
        return `${expr.value}${expr.unit}`;
      case 'BinaryExpression':
        return `${this.formatExpression(expr.left)} ${expr.operator} ${this.formatExpression(expr.right)}`;
      case 'UnaryExpression':
        return `${expr.operator} ${this.formatExpression(expr.operand)}`;
      case 'MemberExpression':
        return `${this.formatExpression(expr.object)}.${expr.property.name}`;
      case 'CallExpression':
        const args = expr.arguments.map(a => this.formatExpression(a)).join(', ');
        return `${this.formatExpression(expr.callee)}(${args})`;
      case 'ComparisonExpression':
        return `${this.formatExpression(expr.left)} ${expr.operator} ${this.formatExpression(expr.right)}`;
      case 'LogicalExpression':
        return `${this.formatExpression(expr.left)} ${expr.operator} ${this.formatExpression(expr.right)}`;
      case 'QuantifiedExpression':
        return `${expr.quantifier} ${expr.variable.name} in ${this.formatExpression(expr.collection)}: ${this.formatExpression(expr.predicate)}`;
      case 'OldExpression':
        return `old(${this.formatExpression(expr.expression)})`;
    }
  }

  private line(content: string): string {
    return this.currentIndent() + content;
  }

  private currentIndent(): string {
    return this.options.indent.repeat(this.indentLevel);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Format an ISL AST to source code
 */
export function format(ast: AST.DomainDeclaration, options?: FormatOptions): string {
  const formatter = new Formatter(options);
  return formatter.format(ast);
}

/**
 * Format with default options
 */
export function fmt(ast: AST.DomainDeclaration): string {
  return format(ast);
}
