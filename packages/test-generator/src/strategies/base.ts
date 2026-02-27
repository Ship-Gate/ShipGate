// ============================================================================
// Base Domain Strategy
// Provides common functionality for all domain strategies
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  DomainStrategy,
  DomainType,
  GeneratedAssertion,
  StrategyContext,
  AssertionPattern,
} from '../types';

/**
 * Abstract base class for domain strategies
 */
export abstract class BaseDomainStrategy implements DomainStrategy {
  abstract domain: DomainType;

  abstract matches(behavior: AST.Behavior, domain: AST.Domain): boolean;

  abstract generatePreconditionAssertions(
    precondition: AST.Expression,
    behavior: AST.Behavior,
    context: StrategyContext
  ): GeneratedAssertion[];

  abstract generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    behavior: AST.Behavior,
    context: StrategyContext
  ): GeneratedAssertion[];

  abstract generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    context: StrategyContext
  ): GeneratedAssertion[];

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Create a supported assertion
   */
  protected supported(
    code: string,
    description: string,
    pattern: AssertionPattern
  ): GeneratedAssertion {
    return { code, description, pattern, status: 'supported' };
  }

  /**
   * Create a needs_impl assertion (scaffold)
   */
  protected needsImpl(
    code: string,
    description: string,
    pattern: AssertionPattern,
    hint: string
  ): GeneratedAssertion {
    return {
      code,
      description,
      pattern,
      status: 'needs_impl',
      implementationHint: hint,
    };
  }

  /**
   * Create an unsupported assertion (will be tracked as open question)
   */
  protected unsupported(
    description: string,
    pattern: AssertionPattern
  ): GeneratedAssertion {
    return {
      code: `// UNSUPPORTED: ${description}`,
      description,
      pattern,
      status: 'unsupported',
    };
  }

  /**
   * Extract field name from member expression
   */
  protected getFieldName(expr: AST.Expression): string | null {
    if (expr.kind === 'MemberExpr') {
      return expr.property.name;
    }
    if (expr.kind === 'InputExpr') {
      return expr.property.name;
    }
    if (expr.kind === 'ResultExpr' && expr.property) {
      return expr.property.name;
    }
    return null;
  }

  /**
   * Check if expression references a field
   */
  protected referencesField(expr: AST.Expression, fieldName: string): boolean {
    const name = this.getFieldName(expr);
    return name === fieldName;
  }

  /**
   * Check if expression is a comparison
   */
  protected isComparison(
    expr: AST.Expression,
    operator?: AST.BinaryOperator
  ): expr is AST.BinaryExpr {
    if (expr.kind !== 'BinaryExpr') return false;
    if (operator) return expr.operator === operator;
    return ['==', '!=', '<', '>', '<=', '>='].includes(expr.operator);
  }

  /**
   * Check if expression is a numeric constraint
   */
  protected isNumericConstraint(expr: AST.Expression): boolean {
    return (
      this.isComparison(expr) &&
      ['<', '>', '<=', '>='].includes(expr.operator)
    );
  }

  /**
   * Get string value from literal
   */
  protected getStringValue(expr: AST.Expression): string | null {
    if (expr.kind === 'StringLiteral') {
      return expr.value;
    }
    return null;
  }

  /**
   * Get number value from literal
   */
  protected getNumberValue(expr: AST.Expression): number | null {
    if (expr.kind === 'NumberLiteral') {
      return expr.value;
    }
    return null;
  }

  /**
   * Compile expression to TypeScript
   */
  protected compileExpr(expr: AST.Expression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'StringLiteral':
        return JSON.stringify(expr.value);
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'NullLiteral':
        return 'null';
      case 'MemberExpr':
        return `${this.compileExpr(expr.object)}.${expr.property.name}`;
      case 'InputExpr':
        return `input.${expr.property.name}`;
      case 'ResultExpr':
        return expr.property ? `result.${expr.property.name}` : 'result';
      case 'BinaryExpr':
        return `(${this.compileExpr(expr.left)} ${this.mapOperator(expr.operator)} ${this.compileExpr(expr.right)})`;
      case 'UnaryExpr':
        const op = expr.operator === 'not' ? '!' : expr.operator;
        return `${op}(${this.compileExpr(expr.operand)})`;
      case 'CallExpr':
        const callee = this.compileExpr(expr.callee);
        const args = expr.arguments.map(a => this.compileExpr(a)).join(', ');
        return `${callee}(${args})`;
      default:
        return `/* unsupported: ${expr.kind} */`;
    }
  }

  /**
   * Map ISL operator to TypeScript
   */
  protected mapOperator(op: AST.BinaryOperator): string {
    switch (op) {
      case '==': return '===';
      case '!=': return '!==';
      case 'and': return '&&';
      case 'or': return '||';
      case 'implies': return '||'; // !a || b
      default: return op;
    }
  }

  /**
   * Generate expect statement
   */
  protected expect(
    actual: string,
    matcher: string,
    expected?: string
  ): string {
    if (expected !== undefined) {
      return `expect(${actual}).${matcher}(${expected});`;
    }
    return `expect(${actual}).${matcher}();`;
  }

  /**
   * Check if behavior name matches patterns
   */
  protected behaviorNameMatches(
    behavior: AST.Behavior,
    patterns: string[]
  ): boolean {
    const name = behavior.name.name.toLowerCase();
    return patterns.some(p => name.includes(p.toLowerCase()));
  }

  /**
   * Check if domain name matches patterns
   */
  protected domainNameMatches(
    domain: AST.Domain,
    patterns: string[]
  ): boolean {
    const name = domain.name.name.toLowerCase();
    return patterns.some(p => name.includes(p.toLowerCase()));
  }
}
