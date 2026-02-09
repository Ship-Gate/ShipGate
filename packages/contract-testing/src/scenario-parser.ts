/**
 * Scenario Parser
 * 
 * Extracts scenarios from ISL AST and converts them to test cases.
 */

import { parseISL } from '@isl-lang/isl-core';
import type { DomainDeclaration } from '@isl-lang/isl-core';

// ============================================================================
// Types
// ============================================================================

export interface ISLScenario {
  name: string;
  behaviorName: string;
  given: ScenarioStatement[];
  when: ScenarioStatement[];
  then: ScenarioExpression[];
  location?: { start: number; end: number };
}

export interface ScenarioStatement {
  kind: 'AssignmentStmt' | 'CallStmt';
  target?: string;
  call?: {
    callee: string;
    arguments: unknown[];
  };
  value?: unknown;
}

export interface ScenarioExpression {
  kind: string;
  expression: string;
  location?: { start: number; end: number };
}

export interface ParsedScenarios {
  behaviorName: string;
  scenarios: ISLScenario[];
}

// ============================================================================
// Scenario Parser
// ============================================================================

export class ScenarioParser {
  /**
   * Parse ISL file and extract scenarios
   */
  parseScenarios(islContent: string): ParsedScenarios[] {
    const result = parseISL(islContent);
    
    if (result.errors.length > 0) {
      throw new Error(`Failed to parse ISL: ${result.errors[0]?.message}`);
    }

    const domain = result.ast;
    if (!domain) {
      return [];
    }

    const parsedScenarios: ParsedScenarios[] = [];

    // Find scenario blocks in the domain
    for (const item of domain.items || []) {
      if (item.kind === 'ScenarioBlock') {
        const scenarioBlock = item as any;
        const behaviorName = scenarioBlock.behaviorName?.name || '';
        const scenarios: ISLScenario[] = [];

        for (const scenarioItem of scenarioBlock.scenarios || []) {
          if (scenarioItem.kind === 'Scenario') {
            const scenario = scenarioItem as any;
            scenarios.push({
              name: scenario.name?.value || '',
              behaviorName,
              given: this.parseStatements(scenario.given || []),
              when: this.parseStatements(scenario.when || []),
              then: this.parseExpressions(scenario.then || []),
              location: scenario.location,
            });
          }
        }

        if (scenarios.length > 0) {
          parsedScenarios.push({ behaviorName, scenarios });
        }
      }
    }

    return parsedScenarios;
  }

  /**
   * Parse statements from AST
   */
  private parseStatements(statements: any[]): ScenarioStatement[] {
    return statements.map((stmt) => {
      if (stmt.kind === 'AssignmentStmt') {
        return {
          kind: 'AssignmentStmt',
          target: stmt.target?.name,
          value: this.extractValue(stmt.value),
        };
      } else if (stmt.kind === 'CallStmt') {
        return {
          kind: 'CallStmt',
          call: {
            callee: this.extractCallee(stmt.call),
            arguments: this.extractArguments(stmt.call?.arguments || []),
          },
        };
      }
      return {
        kind: 'CallStmt',
        call: {
          callee: '',
          arguments: [],
        },
      };
    });
  }

  /**
   * Parse expressions from AST
   */
  private parseExpressions(expressions: any[]): ScenarioExpression[] {
    return expressions.map((expr) => ({
      kind: expr.kind || 'Expression',
      expression: this.expressionToString(expr),
      location: expr.location,
    }));
  }

  /**
   * Extract value from AST node
   */
  private extractValue(node: any): unknown {
    if (!node) return undefined;
    
    if (node.kind === 'CallExpr') {
      return {
        callee: this.extractCallee(node),
        arguments: this.extractArguments(node.arguments || []),
      };
    }
    
    if (node.kind === 'StringLiteral') return node.value;
    if (node.kind === 'NumberLiteral') return node.value;
    if (node.kind === 'BoolLiteral') return node.value;
    if (node.kind === 'Identifier') return node.name;
    
    return undefined;
  }

  /**
   * Extract callee name from call expression
   */
  private extractCallee(node: any): string {
    if (!node) return '';
    if (node.callee?.name) return node.callee.name;
    if (node.callee?.kind === 'Identifier') return node.callee.name || '';
    if (typeof node.callee === 'string') return node.callee;
    return '';
  }

  /**
   * Extract arguments from call expression
   */
  private extractArguments(args: any[]): unknown[] {
    return args.map((arg) => {
      if (arg.kind === 'StringLiteral') return arg.value;
      if (arg.kind === 'NumberLiteral') return arg.value;
      if (arg.kind === 'BoolLiteral') return arg.value;
      if (arg.kind === 'Identifier') return arg.name;
      return arg;
    });
  }

  /**
   * Convert expression AST to string
   */
  private expressionToString(expr: any): string {
    if (!expr) return '';
    
    if (expr.kind === 'BinaryExpr') {
      const left = this.expressionToString(expr.left);
      const right = this.expressionToString(expr.right);
      return `${left} ${expr.operator} ${right}`;
    }
    
    if (expr.kind === 'UnaryExpr') {
      const operand = this.expressionToString(expr.operand);
      return `${expr.operator}${operand}`;
    }
    
    if (expr.kind === 'MemberExpr') {
      const object = this.expressionToString(expr.object);
      return `${object}.${expr.property?.name || ''}`;
    }
    
    if (expr.kind === 'CallExpr') {
      const callee = this.extractCallee(expr);
      const args = this.extractArguments(expr.arguments || []);
      return `${callee}(${args.join(', ')})`;
    }
    
    if (expr.kind === 'StringLiteral') return `"${expr.value}"`;
    if (expr.kind === 'NumberLiteral') return String(expr.value);
    if (expr.kind === 'BoolLiteral') return String(expr.value);
    if (expr.kind === 'Identifier') return expr.name || '';
    if (expr.kind === 'ResultExpr') {
      return expr.property ? `result.${expr.property.name}` : 'result';
    }
    
    return '';
  }
}
