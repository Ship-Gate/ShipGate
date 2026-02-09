// ============================================================================
// Scenario Test Generator
// Generates test cases from ISL scenario blocks
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { TestFramework } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface ScenarioTest {
  name: string;
  description: string;
  code: string;
}

// ============================================================================
// SCENARIO TEST GENERATION
// ============================================================================

/**
 * Generate test cases from ISL scenarios for a behavior
 */
export function generateScenarioTests(
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): ScenarioTest[] {
  // Find scenario block for this behavior
  const scenarioBlock = domain.scenarios.find(
    (sb) => sb.behaviorName.name === behavior.name.name
  );

  if (!scenarioBlock || scenarioBlock.scenarios.length === 0) {
    return [];
  }

  const tests: ScenarioTest[] = [];

  for (const scenario of scenarioBlock.scenarios) {
    const scenarioName = scenario.name.value;
    const testCode = generateScenarioTestCode(scenario, behavior, domain, framework);
    
    tests.push({
      name: scenarioName,
      description: scenarioName,
      code: testCode,
    });
  }

  return tests;
}

/**
 * Generate test code for a single scenario
 */
function generateScenarioTestCode(
  scenario: AST.Scenario,
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  const behaviorName = behavior.name.name;
  const lines: string[] = [];

  // Convert given statements to setup code
  const setupCode = generateGivenCode(scenario.given, behavior, domain);
  
  // Convert when statements to execution code
  const executionCode = generateWhenCode(scenario.when, behavior, domain);
  
  // Convert then expressions to assertions
  const assertionCode = generateThenCode(scenario.then, behavior, domain, framework);

  lines.push('  // Given: Setup test state');
  lines.push(setupCode);
  lines.push('');
  lines.push('  // When: Execute behavior');
  lines.push(executionCode);
  lines.push('');
  lines.push('  // Then: Verify outcomes');
  lines.push(assertionCode);

  return lines.join('\n');
}

/**
 * Generate setup code from given block
 */
function generateGivenCode(
  statements: AST.Statement[],
  behavior: AST.Behavior,
  domain: AST.Domain
): string {
  const lines: string[] = [];

  for (const stmt of statements) {
    if (stmt.kind === 'AssignmentStmt') {
      const varName = stmt.target.name;
      const value = generateExpressionCode(stmt.value, behavior, domain);
      lines.push(`    const ${varName} = ${value};`);
    } else if (stmt.kind === 'CallStmt') {
      const callCode = generateCallCode(stmt.call, behavior, domain);
      lines.push(`    ${callCode};`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '    // No setup needed';
}

/**
 * Generate execution code from when block
 */
function generateWhenCode(
  statements: AST.Statement[],
  behavior: AST.Behavior,
  domain: AST.Domain
): string {
  const lines: string[] = [];

  for (const stmt of statements) {
    if (stmt.kind === 'AssignmentStmt') {
      const varName = stmt.target.name;
      const value = generateExpressionCode(stmt.value, behavior, domain);
      lines.push(`    const ${varName} = await ${value};`);
    } else if (stmt.kind === 'CallStmt') {
      const callCode = generateCallCode(stmt.call, behavior, domain);
      lines.push(`    await ${callCode};`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : `    const result = await ${behavior.name.name}(validInput);`;
}

/**
 * Generate assertion code from then block
 */
function generateThenCode(
  expressions: AST.Expression[],
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  const lines: string[] = [];

  for (const expr of expressions) {
    const assertion = generateAssertionFromExpression(expr, behavior, domain, framework);
    lines.push(`    ${assertion};`);
  }

  return lines.length > 0 ? lines.join('\n') : '    expect(result).toBeDefined();';
}

/**
 * Generate assertion from an expression
 */
function generateAssertionFromExpression(
  expr: AST.Expression,
  behavior: AST.Behavior,
  domain: AST.Domain,
  framework: TestFramework
): string {
  // Handle result is success/failure
  if (expr.kind === 'BinaryExpr' && expr.operator === 'is') {
    const left = generateExpressionCode(expr.left, behavior, domain);
    const right = generateExpressionCode(expr.right, behavior, domain);
    
    if (right === 'success') {
      return `expect(${left}.success).toBe(true)`;
    } else if (right === 'failure') {
      return `expect(${left}.success).toBe(false)`;
    }
  }

  // Handle result.property == value
  if (expr.kind === 'BinaryExpr' && expr.operator === '==') {
    const left = generateExpressionCode(expr.left, behavior, domain);
    const right = generateExpressionCode(expr.right, behavior, domain);
    return `expect(${left}).toEqual(${right})`;
  }

  // Handle result.error == ERROR_NAME
  if (expr.kind === 'BinaryExpr' && expr.operator === '==' && 
      expr.left.kind === 'MemberExpr' && expr.left.property.name === 'error') {
    const left = generateExpressionCode(expr.left, behavior, domain);
    const right = generateExpressionCode(expr.right, behavior, domain);
    return `expect(${left}).toBe(${right})`;
  }

  // Default: convert expression to assertion
  const exprCode = generateExpressionCode(expr, behavior, domain);
  return `expect(${exprCode}).toBeTruthy()`;
}

/**
 * Generate code from an expression
 */
function generateExpressionCode(
  expr: AST.Expression,
  behavior: AST.Behavior,
  domain: AST.Domain
): string {
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
      const object = generateExpressionCode(expr.object, behavior, domain);
      const property = expr.property.name;
      return `${object}.${property}`;
    
    case 'ResultExpr':
      return `result.${expr.property.name}`;
    
    case 'InputExpr':
      return `input.${expr.property.name}`;
    
    case 'BinaryExpr':
      const left = generateExpressionCode(expr.left, behavior, domain);
      const right = generateExpressionCode(expr.right, behavior, domain);
      const op = expr.operator === 'is' ? '===' : expr.operator;
      return `(${left} ${op} ${right})`;
    
    case 'CallExpr':
      const funcName = expr.callee.name;
      const args = expr.arguments.map(arg => generateExpressionCode(arg, behavior, domain)).join(', ');
      return `${funcName}(${args})`;
    
    default:
      return 'undefined';
  }
}

/**
 * Generate code from a call expression
 */
function generateCallCode(
  call: AST.CallExpr,
  behavior: AST.Behavior,
  domain: AST.Domain
): string {
  // Handle callee - could be Identifier or MemberExpr
  let funcName: string;
  if (call.callee.kind === 'Identifier') {
    funcName = call.callee.name;
  } else if (call.callee.kind === 'MemberExpr') {
    const object = generateExpressionCode(call.callee.object, behavior, domain);
    const property = call.callee.property.name;
    funcName = `${object}.${property}`;
  } else {
    funcName = generateExpressionCode(call.callee, behavior, domain);
  }
  
  const args = call.arguments.map(arg => {
    return generateExpressionCode(arg, behavior, domain);
  }).join(', ');
  
  return `${funcName}(${args})`;
}
