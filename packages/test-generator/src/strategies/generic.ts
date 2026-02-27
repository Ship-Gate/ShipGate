// ============================================================================
// Generic Domain Strategy
// Fallback strategy for domains that don't match specific patterns
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { BaseDomainStrategy } from './base';
import type {
  DomainType,
  GeneratedAssertion,
  StrategyContext,
} from '../types';

/**
 * Generic fallback strategy for any domain
 * 
 * Generates basic assertions from ISL expressions
 */
export class GenericStrategy extends BaseDomainStrategy {
  domain: DomainType = 'generic';

  matches(_behavior: AST.Behavior, _domain: AST.Domain): boolean {
    // Generic strategy always matches as fallback
    return true;
  }

  generatePreconditionAssertions(
    precondition: AST.Expression,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const exprStr = this.compileExpr(precondition);

    // Generate basic precondition test
    assertions.push(this.supported(
      `// Precondition check\nexpect(${exprStr}).toBe(true);`,
      `Precondition: ${this.truncate(exprStr, 50)}`,
      'generic.precondition'
    ));

    // Generate negative test
    assertions.push(this.supported(
      `// Should fail when precondition is violated\nconst invalidInput = createInputViolating('${this.truncate(exprStr, 30)}');\nconst result = await ${behavior.name.name}(invalidInput);\nexpect(result.success).toBe(false);`,
      `Should reject when ${this.truncate(exprStr, 30)} is false`,
      'generic.precondition'
    ));

    return assertions;
  }

  generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    _behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const condition = this.getConditionName(postcondition.condition);

    for (const predicate of postcondition.predicates) {
      const exprStr = this.compileExpr(predicate);

      assertions.push(this.supported(
        `// Postcondition (${condition})\nexpect(${exprStr}).toBe(true);`,
        `Postcondition (${condition}): ${this.truncate(exprStr, 50)}`,
        'generic.postcondition'
      ));
    }

    return assertions;
  }

  generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const errorName = errorSpec.name.name;
    const when = errorSpec.when?.value || 'specific conditions';

    return [
      this.supported(
        `// Error case: ${errorName}\nconst errorInput = createInputFor${this.sanitizeName(errorName)}();\nconst result = await ${behavior.name.name}(errorInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(${errorSpec.retriable});`,
        `Should return ${errorName} when ${when}`,
        'generic.postcondition'
      ),
    ];
  }

  private getConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'any error';
    return condition.name;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  }

  private sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
