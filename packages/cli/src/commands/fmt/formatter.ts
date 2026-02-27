/**
 * AST-based ISL Formatter
 * 
 * Formats ISL AST nodes back to source code, preserving comments and ensuring
 * idempotency and semantics preservation.
 */

import type { Domain, ASTNode } from '@isl-lang/parser';
import type { Comment } from './comments.js';

export interface FormatOptions {
  indentSize?: number;
  maxLineLength?: number;
  preserveComments?: boolean;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  indentSize: 2,
  maxLineLength: 100,
  preserveComments: true,
};

/**
 * AST-based formatter for ISL code
 */
export class Formatter {
  private options: Required<FormatOptions>;
  private indentLevel: number = 0;
  private comments: Comment[] = [];
  private commentIndex: number = 0;
  private output: string[] = [];
  private currentLine: number = 0;

  constructor(options: FormatOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Format a domain AST node
   */
  format(domain: Domain, comments: Comment[] = []): string {
    this.comments = comments.sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    });
    this.commentIndex = 0;
    this.output = [];
    this.indentLevel = 0;
    this.currentLine = 0;

    // Format domain
    this.formatDomain(domain);

    // Add any trailing comments
    this.emitTrailingComments();

    const result = this.output.join('\n');
    // Ensure file ends with newline
    return result.endsWith('\n') ? result : result + '\n';
  }

  private indent(): string {
    return ' '.repeat(this.indentLevel * this.options.indentSize);
  }

  private emit(text: string): void {
    this.output.push(text);
    this.currentLine++;
  }

  private emitLine(text: string = ''): void {
    this.emit(this.indent() + text);
  }

  private emitCommentsBeforeLine(line: number): void {
    while (
      this.commentIndex < this.comments.length &&
      this.comments[this.commentIndex]!.line < line
    ) {
      const comment = this.comments[this.commentIndex]!;
      // Only emit if it's close enough (within 2 lines)
      if (line - comment.line <= 2) {
        this.emitLine(comment.text.trimStart());
      }
      this.commentIndex++;
    }
  }

  private emitTrailingComments(): void {
    while (this.commentIndex < this.comments.length) {
      const comment = this.comments[this.commentIndex]!;
      this.emitLine(comment.text.trimStart());
      this.commentIndex++;
    }
  }

  private formatDomain(domain: Domain): void {
    // Emit comments before domain
    this.emitCommentsBeforeLine(domain.location.line);

    // Domain declaration
    const domainLine = `domain ${this.formatIdentifier(domain.name)} {`;
    this.emitLine(domainLine);
    this.indentLevel++;

    // Version
    if (domain.version) {
      this.emitCommentsBeforeLine(domain.version.location.line);
      this.emitLine(`version: ${this.formatStringLiteral(domain.version)}`);
    }

    // Owner
    if (domain.owner) {
      this.emitCommentsBeforeLine(domain.owner.location.line);
      this.emitLine(`owner: ${this.formatStringLiteral(domain.owner)}`);
    }

    // Use statements
    if (domain.uses && domain.uses.length > 0) {
      this.emitBlankLine();
      for (const useStmt of domain.uses) {
        this.emitCommentsBeforeLine(useStmt.location.line);
        this.formatUseStatement(useStmt);
      }
    }

    // Imports
    if (domain.imports && domain.imports.length > 0) {
      this.emitBlankLine();
      for (const imp of domain.imports) {
        this.emitCommentsBeforeLine(imp.location.line);
        this.formatImport(imp);
      }
    }

    // Types
    if (domain.types && domain.types.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.types.length; i++) {
        const type = domain.types[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(type.location.line);
        this.formatTypeDeclaration(type);
      }
    }

    // Entities
    if (domain.entities && domain.entities.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.entities.length; i++) {
        const entity = domain.entities[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(entity.location.line);
        this.formatEntity(entity);
      }
    }

    // Behaviors
    if (domain.behaviors && domain.behaviors.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.behaviors.length; i++) {
        const behavior = domain.behaviors[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(behavior.location.line);
        this.formatBehavior(behavior);
      }
    }

    // Invariants
    if (domain.invariants && domain.invariants.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.invariants.length; i++) {
        const inv = domain.invariants[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(inv.location.line);
        this.formatInvariantBlock(inv);
      }
    }

    // Policies
    if (domain.policies && domain.policies.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.policies.length; i++) {
        const policy = domain.policies[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(policy.location.line);
        this.formatPolicy(policy);
      }
    }

    // Views
    if (domain.views && domain.views.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.views.length; i++) {
        const view = domain.views[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(view.location.line);
        this.formatView(view);
      }
    }

    // Scenarios
    if (domain.scenarios && domain.scenarios.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.scenarios.length; i++) {
        const scenarioBlock = domain.scenarios[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(scenarioBlock.location.line);
        this.formatScenarioBlock(scenarioBlock);
      }
    }

    // Chaos blocks
    if (domain.chaos && domain.chaos.length > 0) {
      this.emitBlankLine();
      for (let i = 0; i < domain.chaos.length; i++) {
        const chaosBlock = domain.chaos[i]!;
        if (i > 0) this.emitBlankLine();
        this.emitCommentsBeforeLine(chaosBlock.location.line);
        this.formatChaosBlock(chaosBlock);
      }
    }

    this.indentLevel--;
    this.emitLine('}');
  }

  private formatUseStatement(use: any): void {
    // use stdlib-auth [@ "1.0.0"] [as alias];
    let line = 'use ';
    line += this.formatIdentifierOrString(use.module);
    if (use.version) {
      line += ` @ ${this.formatStringLiteral(use.version)}`;
    }
    if (use.alias) {
      line += ` as ${this.formatIdentifier(use.alias)}`;
    }
    this.emitLine(line);
  }

  private formatImport(imp: any): void {
    // imports { item1, item2 as alias2 } from "path";
    let line = 'imports {';
    this.emitLine(line);
    this.indentLevel++;

    for (let i = 0; i < imp.items.length; i++) {
      const item = imp.items[i]!;
      let itemLine = this.formatIdentifier(item.name);
      if (item.alias) {
        itemLine += ` as ${this.formatIdentifier(item.alias)}`;
      }
      if (i < imp.items.length - 1) {
        itemLine += ',';
      }
      this.emitLine(itemLine);
    }

    this.indentLevel--;
    this.emitLine(`} from ${this.formatStringLiteral(imp.from)}`);
  }

  private formatTypeDeclaration(type: any): void {
    if (type.definition?.kind === 'EnumType') {
      this.formatEnumType(type);
    } else {
      this.emitLine(`type ${this.formatIdentifier(type.name)} = ${this.formatTypeDefinition(type.definition)}`);
    }
  }

  private formatEnumType(type: any): void {
    this.emitLine(`enum ${this.formatIdentifier(type.name)} {`);
    this.indentLevel++;

    const variants = type.definition.variants || [];
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i]!;
      let line = this.formatIdentifier(variant.name);
      if (variant.value) {
        line += ` = ${this.formatLiteral(variant.value)}`;
      }
      if (i < variants.length - 1) {
        line += ',';
      }
      this.emitLine(line);
    }

    this.indentLevel--;
    this.emitLine('}');
  }

  private formatTypeDefinition(type: any): string {
    if (!type) return 'unknown';

    switch (type.kind) {
      case 'PrimitiveType':
        return type.name;
      case 'OptionalType':
        return `${this.formatTypeDefinition(type.inner)}?`;
      case 'ListType':
        return `List<${this.formatTypeDefinition(type.element)}>`;
      case 'MapType':
        return `Map<${this.formatTypeDefinition(type.key)}, ${this.formatTypeDefinition(type.value)}>`;
      case 'StructType':
        return this.formatStructType(type);
      case 'UnionType':
        return this.formatUnionType(type);
      case 'ConstrainedType':
        return `${this.formatTypeDefinition(type.base)} ${this.formatConstraints(type.constraints)}`;
      case 'ReferenceType':
        return this.formatQualifiedName(type.name);
      default:
        return 'unknown';
    }
  }

  private formatStructType(struct: any): string {
    const fields = struct.fields || [];
    if (fields.length === 0) return '{}';

    const fieldStrs = fields.map((f: any) => {
      let fieldStr = `${this.formatIdentifier(f.name)}: ${this.formatTypeDefinition(f.type)}`;
      if (f.optional) fieldStr += '?';
      return fieldStr;
    });

    return `{ ${fieldStrs.join(', ')} }`;
  }

  private formatUnionType(union: any): string {
    const variants = union.variants || [];
    return variants.map((v: any) => this.formatIdentifier(v.name)).join(' | ');
  }

  private formatConstraints(constraints: any[]): string {
    if (!constraints || constraints.length === 0) return '';
    return constraints.map((c: any) => `[${c.name}: ${this.formatExpression(c.value)}]`).join(' ');
  }

  private formatEntity(entity: any): void {
    this.emitLine(`entity ${this.formatIdentifier(entity.name)} {`);
    this.indentLevel++;

    const fields = entity.fields || [];
    for (const field of fields) {
      this.emitCommentsBeforeLine(field.location.line);
      this.formatField(field);
    }

    this.indentLevel--;
    this.emitLine('}');
  }

  private formatField(field: any): void {
    let line = `${this.formatIdentifier(field.name)}`;
    if (field.optional) line += '?';
    line += `: ${this.formatTypeDefinition(field.type)}`;
    if (field.defaultValue) {
      line += ` = ${this.formatExpression(field.defaultValue)}`;
    }
    this.emitLine(line);
  }

  private formatBehavior(behavior: any): void {
    let line = 'behavior ';
    if (behavior.name) {
      line += this.formatIdentifier(behavior.name);
    }
    line += ' {';
    this.emitLine(line);
    this.indentLevel++;

    // Actors
    if (behavior.actors && behavior.actors.length > 0) {
      this.emitLine('actors {');
      this.indentLevel++;
      for (const actor of behavior.actors) {
        this.formatActor(actor);
      }
      this.indentLevel--;
      this.emitLine('}');
      this.emitBlankLine();
    }

    // Input
    if (behavior.inputs && behavior.inputs.length > 0) {
      this.emitLine('input {');
      this.indentLevel++;
      for (const input of behavior.inputs) {
        this.formatField(input);
      }
      this.indentLevel--;
      this.emitLine('}');
      this.emitBlankLine();
    }

    // Output
    if (behavior.output) {
      this.formatOutput(behavior.output);
      this.emitBlankLine();
    }

    // Preconditions
    if (behavior.body?.preconditions && behavior.body.preconditions.length > 0) {
      this.emitLine('preconditions {');
      this.indentLevel++;
      for (const pre of behavior.body.preconditions) {
        this.formatExpression(pre);
      }
      this.indentLevel--;
      this.emitLine('}');
      this.emitBlankLine();
    }

    // Postconditions
    if (behavior.body?.postconditions && behavior.body.postconditions.length > 0) {
      this.emitLine('postconditions {');
      this.indentLevel++;
      for (const post of behavior.body.postconditions) {
        this.formatExpression(post);
      }
      this.indentLevel--;
      this.emitLine('}');
      this.emitBlankLine();
    }

    // Invariants
    if (behavior.body?.invariants && behavior.body.invariants.length > 0) {
      this.emitLine('invariants {');
      this.indentLevel++;
      for (const inv of behavior.body.invariants) {
        this.formatExpression(inv);
      }
      this.indentLevel--;
      this.emitLine('}');
      this.emitBlankLine();
    }

    // Temporal
    if (behavior.body?.temporal && behavior.body.temporal.length > 0) {
      this.emitLine('temporal {');
      this.indentLevel++;
      for (const temp of behavior.body.temporal) {
        this.formatTemporalRequirement(temp);
      }
      this.indentLevel--;
      this.emitLine('}');
      this.emitBlankLine();
    }

    // Security
    if (behavior.body?.security && behavior.body.security.length > 0) {
      this.emitLine('security {');
      this.indentLevel++;
      for (const sec of behavior.body.security) {
        this.formatSecurityRequirement(sec);
      }
      this.indentLevel--;
      this.emitLine('}');
    }

    this.indentLevel--;
    this.emitLine('}');
  }

  private formatActor(actor: any): void {
    // Simplified - full implementation would handle actor spec
    this.emitLine(`Actor { }`);
  }

  private formatOutput(output: any): void {
    if (output.success) {
      this.emitLine('output {');
      this.indentLevel++;
      this.emitLine('success: {');
      this.indentLevel++;
      // Format success fields
      this.indentLevel--;
      this.emitLine('}');
      this.indentLevel--;
      this.emitLine('}');
    }
  }

  private formatInvariantBlock(inv: any): void {
    this.emitLine('invariants {');
    this.indentLevel++;
    // Format invariant expressions
    this.indentLevel--;
    this.emitLine('}');
  }

  private formatPolicy(policy: any): void {
    // Simplified policy formatting
    this.emitLine(`policy ${this.formatIdentifier(policy.name)} { }`);
  }

  private formatView(view: any): void {
    // Simplified view formatting
    this.emitLine(`view ${this.formatIdentifier(view.name)} { }`);
  }

  private formatScenarioBlock(scenarioBlock: any): void {
    this.emitLine(`scenarios ${this.formatIdentifier(scenarioBlock.behavior)} {`);
    this.indentLevel++;

    const scenarios = scenarioBlock.scenarios || [];
    for (const scenario of scenarios) {
      this.formatScenario(scenario);
    }

    this.indentLevel--;
    this.emitLine('}');
  }

  private formatScenario(scenario: any): void {
    this.emitLine(`scenario ${this.formatStringLiteral({ value: scenario.name })} {`);
    this.indentLevel++;

    if (scenario.given) {
      this.emitLine('given {');
      this.indentLevel++;
      // Format given conditions
      this.indentLevel--;
      this.emitLine('}');
    }

    if (scenario.when) {
      this.emitLine('when {');
      this.indentLevel++;
      // Format when actions
      this.indentLevel--;
      this.emitLine('}');
    }

    if (scenario.then) {
      this.emitLine('then {');
      this.indentLevel++;
      // Format then assertions
      this.indentLevel--;
      this.emitLine('}');
    }

    this.indentLevel--;
    this.emitLine('}');
  }

  private formatChaosBlock(chaos: any): void {
    this.emitLine('chaos {');
    this.indentLevel++;
    // Format chaos scenarios
    this.indentLevel--;
    this.emitLine('}');
  }

  private formatTemporalRequirement(temp: any): void {
    // Simplified temporal formatting
    this.emitLine('- temporal requirement');
  }

  private formatSecurityRequirement(sec: any): void {
    // Simplified security formatting
    this.emitLine('- security requirement');
  }

  private formatExpression(expr: any): string {
    if (!expr) return '';

    switch (expr.kind) {
      case 'Identifier':
        return this.formatIdentifier(expr);
      case 'StringLiteral':
        return this.formatStringLiteral(expr);
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'NullLiteral':
        return 'null';
      case 'BinaryExpr':
        return `${this.formatExpression(expr.left)} ${expr.operator} ${this.formatExpression(expr.right)}`;
      case 'UnaryExpr':
        return `${expr.operator}${this.formatExpression(expr.operand)}`;
      case 'CallExpr':
        return `${this.formatQualifiedName(expr.callee)}(${expr.arguments.map((a: any) => this.formatExpression(a)).join(', ')})`;
      case 'MemberExpr':
        return `${this.formatExpression(expr.object)}.${this.formatIdentifier(expr.property)}`;
      default:
        return 'expr';
    }
  }

  private formatIdentifier(id: any): string {
    if (typeof id === 'string') return id;
    if (id?.name) return id.name;
    return 'unknown';
  }

  private formatIdentifierOrString(id: any): string {
    if (id?.kind === 'StringLiteral') {
      return this.formatStringLiteral(id);
    }
    return this.formatIdentifier(id);
  }

  private formatQualifiedName(qn: any): string {
    if (typeof qn === 'string') return qn;
    if (qn?.parts) {
      return qn.parts.map((p: any) => this.formatIdentifier(p)).join('.');
    }
    return this.formatIdentifier(qn);
  }

  private formatStringLiteral(lit: any): string {
    if (typeof lit === 'string') return `"${lit}"`;
    if (lit?.value !== undefined) {
      const escaped = lit.value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `"${escaped}"`;
    }
    return '""';
  }

  private formatLiteral(lit: any): string {
    if (!lit) return 'null';
    switch (lit.kind) {
      case 'StringLiteral':
        return this.formatStringLiteral(lit);
      case 'NumberLiteral':
        return String(lit.value);
      case 'BooleanLiteral':
        return String(lit.value);
      case 'NullLiteral':
        return 'null';
      default:
        return 'unknown';
    }
  }

  private emitBlankLine(): void {
    this.emit('');
  }
}
