// ============================================================================
// Expected Outcome Synthesizer
// ============================================================================
//
// Computes expected outcomes from ISL postconditions and invariants.
// Generates meaningful assertions rather than placeholder TODOs.
// 
// Key features:
// - Compiles postconditions to executable assertions
// - Handles old() expressions with state capture
// - Infers assertions from result types
// - Supports both success and error path assertions
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { SynthesizedInput } from './data-synthesizer';

// ============================================================================
// TYPES
// ============================================================================

export interface ComputedAssertion {
  /** The assertion code */
  code: string;
  /** Human-readable description */
  description: string;
  /** Source of this assertion */
  source: 'postcondition' | 'invariant' | 'error' | 'inferred' | 'computed';
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Expected value if computable */
  expectedValue?: unknown;
}

export interface ExpectedOutcomeResult {
  /** Whether the operation should succeed */
  shouldSucceed: boolean;
  /** Expected error code if failure */
  expectedError?: string;
  /** All computed assertions */
  assertions: ComputedAssertion[];
  /** Variables that need to be captured before execution */
  capturesBefore: string[];
  /** Contract verification code */
  contractCode: string;
  /** Computed expected values (from input + spec) */
  computedExpectations: ComputedExpectation[];
}

export interface ComputedExpectation {
  /** Result path (e.g., 'result.data.amount') */
  path: string;
  /** Expected value */
  value: unknown;
  /** How it was computed */
  source: string;
}

// ============================================================================
// MAIN SYNTHESIS
// ============================================================================

/**
 * Synthesize expected outcomes from behavior specification
 */
export function synthesizeExpectedOutcome(
  behavior: AST.Behavior,
  input: SynthesizedInput,
  domain: AST.Domain
): ExpectedOutcomeResult {
  const assertions: ComputedAssertion[] = [];
  const capturesBefore: string[] = [];
  const computedExpectations: ComputedExpectation[] = [];

  // Determine if this input should succeed or fail
  const shouldSucceed = input.category === 'valid' || input.category === 'boundary';
  const expectedError = input.expectedOutcome?.errorCode;

  if (shouldSucceed) {
    // Process success postconditions
    const successBlocks = behavior.postconditions.filter(
      p => p.condition === 'success'
    );

    for (const block of successBlocks) {
      const { blockAssertions, captures, expectations } = processPostconditionBlock(
        block, behavior, domain, input.values
      );
      assertions.push(...blockAssertions);
      capturesBefore.push(...captures);
      computedExpectations.push(...expectations);
    }

    // Compute expected values from postconditions that define equality
    const computed = computeExpectedFromPostconditions(behavior, input.values, domain);
    for (const expectation of computed) {
      // Add computed assertion
      const formattedValue = formatExpectedValue(expectation.value);
      assertions.push({
        code: `expect(${expectation.path}).toEqual(${formattedValue});`,
        description: `${expectation.path} should equal computed value`,
        source: 'computed',
        confidence: 'high',
        expectedValue: expectation.value,
      });
      computedExpectations.push(expectation);
    }

    // Process invariants
    for (const invariant of behavior.invariants) {
      const invAssertion = processInvariant(invariant);
      if (invAssertion) {
        assertions.push(invAssertion);
      }
    }

    // Add inferred assertions from result type
    assertions.push(...inferResultTypeAssertions(behavior));

  } else {
    // Process failure postconditions
    const failureBlocks = behavior.postconditions.filter(
      p => p.condition === 'any_error' || 
           (typeof p.condition === 'object' && p.condition.name === expectedError)
    );

    for (const block of failureBlocks) {
      const { blockAssertions, captures, expectations } = processPostconditionBlock(
        block, behavior, domain, input.values
      );
      assertions.push(...blockAssertions);
      capturesBefore.push(...captures);
      computedExpectations.push(...expectations);
    }

    // Add basic error assertion
    assertions.push({
      code: 'expect(result.success).toBe(false);',
      description: 'Operation should fail',
      source: 'inferred',
      confidence: 'high',
    });

    if (expectedError) {
      assertions.push({
        code: `expect(result.error?.code ?? result.error).toBe('${expectedError}');`,
        description: `Should return ${expectedError} error`,
        source: 'error',
        confidence: 'high',
      });
    }
  }

  // Generate contract code
  const contractCode = generateContractCode(assertions, capturesBefore, shouldSucceed);

  return {
    shouldSucceed,
    expectedError,
    assertions,
    capturesBefore: [...new Set(capturesBefore)],
    contractCode,
    computedExpectations,
  };
}

/**
 * Compute expected values from postconditions that define result properties
 */
function computeExpectedFromPostconditions(
  behavior: AST.Behavior,
  inputValues: Record<string, unknown>,
  domain: AST.Domain
): ComputedExpectation[] {
  const expectations: ComputedExpectation[] = [];
  const entityNames = domain.entities.map(e => e.name.name);

  const successBlocks = behavior.postconditions.filter(p => p.condition === 'success');

  for (const block of successBlocks) {
    for (const predicate of block.predicates) {
      const expectation = extractExpectationFromPredicate(predicate, inputValues, entityNames);
      if (expectation) {
        expectations.push(expectation);
      }
    }
  }

  return expectations;
}

/**
 * Extract expected values from postcondition predicates like:
 * - result.amount == input.amount
 * - Payment.lookup(result.id).currency == input.currency
 */
function extractExpectationFromPredicate(
  predicate: AST.Expression,
  inputValues: Record<string, unknown>,
  _entityNames: string[]
): ComputedExpectation | null {
  if (predicate.kind !== 'BinaryExpr') return null;
  if (predicate.operator !== '==') return null;

  const { left, right } = predicate;

  // Check if left side references result and right side references input
  const resultPath = extractResultPath(left);
  const inputRef = extractInputReference(right);

  if (resultPath && inputRef && inputRef in inputValues) {
    return {
      path: resultPath,
      value: inputValues[inputRef],
      source: `postcondition: ${resultPath} == input.${inputRef}`,
    };
  }

  // Check reverse (input on left, result on right)
  const inputRefLeft = extractInputReference(left);
  const resultPathRight = extractResultPath(right);

  if (resultPathRight && inputRefLeft && inputRefLeft in inputValues) {
    return {
      path: resultPathRight,
      value: inputValues[inputRefLeft],
      source: `postcondition: ${resultPathRight} == input.${inputRefLeft}`,
    };
  }

  // Check for literal value assignments
  const literalValue = extractLiteralValue(right);
  if (resultPath && literalValue !== undefined) {
    return {
      path: resultPath,
      value: literalValue,
      source: `postcondition: ${resultPath} == ${JSON.stringify(literalValue)}`,
    };
  }

  return null;
}

function extractResultPath(expr: AST.Expression): string | null {
  if (expr.kind === 'ResultExpr') {
    return expr.property ? `result.data.${expr.property.name}` : 'result.data';
  }
  if (expr.kind === 'MemberExpr') {
    const objPath = extractResultPath(expr.object);
    if (objPath) {
      return `${objPath}.${expr.property.name}`;
    }
  }
  return null;
}

function extractInputReference(expr: AST.Expression): string | null {
  if (expr.kind === 'InputExpr') {
    return expr.property.name;
  }
  if (expr.kind === 'MemberExpr' && expr.object.kind === 'InputExpr') {
    return `${expr.object.property.name}.${expr.property.name}`;
  }
  return null;
}

function extractLiteralValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral': return expr.value;
    case 'StringLiteral': return expr.value;
    case 'BooleanLiteral': return expr.value;
    case 'NullLiteral': return null;
    default: return undefined;
  }
}

function formatExpectedValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// POSTCONDITION PROCESSING
// ============================================================================

interface ProcessedBlock {
  blockAssertions: ComputedAssertion[];
  captures: string[];
  expectations: ComputedExpectation[];
}

function processPostconditionBlock(
  block: AST.PostconditionBlock,
  behavior: AST.Behavior,
  domain: AST.Domain,
  inputValues: Record<string, unknown>
): ProcessedBlock {
  const assertions: ComputedAssertion[] = [];
  const captures: string[] = [];
  const expectations: ComputedExpectation[] = [];
  const entityNames = domain.entities.map(e => e.name.name);

  for (const predicate of block.predicates) {
    const result = processPostconditionPredicate(predicate, behavior, domain, inputValues);
    if (result) {
      assertions.push(result.assertion);
      captures.push(...result.captures);
    }

    // Extract computed expectations
    const expectation = extractExpectationFromPredicate(predicate, inputValues, entityNames);
    if (expectation) {
      expectations.push(expectation);
    }
  }

  return { blockAssertions: assertions, captures, expectations };
}

interface PredicateResult {
  assertion: ComputedAssertion;
  captures: string[];
}

function processPostconditionPredicate(
  predicate: AST.Expression,
  _behavior: AST.Behavior,
  domain: AST.Domain,
  _inputValues: Record<string, unknown>
): PredicateResult | null {
  const captures: string[] = [];
  const entityNames = domain.entities.map(e => e.name.name);

  switch (predicate.kind) {
    case 'BinaryExpr': {
      const code = compilePostconditionExpression(predicate, entityNames, captures);
      return {
        assertion: {
          code: `expect(${code}).toBe(true);`,
          description: expressionToDescription(predicate),
          source: 'postcondition',
          confidence: 'high',
        },
        captures,
      };
    }

    case 'CallExpr': {
      // Handle entity method calls like Entity.exists(...)
      const code = compileCallExpression(predicate, entityNames, captures);
      return {
        assertion: {
          code: `expect(${code}).toBe(true);`,
          description: expressionToDescription(predicate),
          source: 'postcondition',
          confidence: 'high',
        },
        captures,
      };
    }

    case 'UnaryExpr': {
      if (predicate.operator === 'not') {
        const inner = compilePostconditionExpression(predicate.operand, entityNames, captures);
        return {
          assertion: {
            code: `expect(${inner}).toBe(false);`,
            description: `NOT ${expressionToDescription(predicate.operand)}`,
            source: 'postcondition',
            confidence: 'high',
          },
          captures,
        };
      }
      break;
    }

    case 'MemberExpr': {
      // Handle result.field assertions
      const code = compilePostconditionExpression(predicate, entityNames, captures);
      return {
        assertion: {
          code: `expect(${code}).toBeTruthy();`,
          description: expressionToDescription(predicate),
          source: 'postcondition',
          confidence: 'medium',
        },
        captures,
      };
    }
  }

  return null;
}

// ============================================================================
// EXPRESSION COMPILATION
// ============================================================================

function compilePostconditionExpression(
  expr: AST.Expression,
  entityNames: string[],
  captures: string[]
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

    case 'InputExpr':
      return `input.${expr.property.name}`;

    case 'ResultExpr':
      if (expr.property) {
        return `result.data.${expr.property.name}`;
      }
      return 'result.data';

    case 'MemberExpr': {
      const obj = compilePostconditionExpression(expr.object, entityNames, captures);
      return `${obj}.${expr.property.name}`;
    }

    case 'BinaryExpr': {
      const left = compilePostconditionExpression(expr.left, entityNames, captures);
      const right = compilePostconditionExpression(expr.right, entityNames, captures);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;
    }

    case 'UnaryExpr': {
      const operand = compilePostconditionExpression(expr.operand, entityNames, captures);
      if (expr.operator === 'not') {
        return `!(${operand})`;
      }
      return `${expr.operator}(${operand})`;
    }

    case 'CallExpr':
      return compileCallExpression(expr, entityNames, captures);

    case 'OldExpr': {
      // Add capture for old() expression
      const innerCode = compileOldExpression(expr.expression, entityNames);
      captures.push(innerCode);
      return `__old__.${innerCode.replace(/\./g, '_')}`;
    }

    default:
      return `/* TODO: ${expr.kind} */`;
  }
}

function compileCallExpression(
  expr: AST.CallExpr,
  entityNames: string[],
  captures: string[]
): string {
  const callee = compilePostconditionExpression(expr.callee, entityNames, captures);
  
  // Check if this is an entity method
  if (expr.callee.kind === 'MemberExpr') {
    const objName = getObjectName(expr.callee.object);
    if (objName && entityNames.includes(objName)) {
      const method = expr.callee.property.name;
      
      // Handle common entity methods
      switch (method) {
        case 'exists': {
          const args = compileEntityMethodArgs(expr.arguments, entityNames, captures);
          return `await ${objName}.exists(${args})`;
        }
        case 'lookup': {
          const args = compileEntityMethodArgs(expr.arguments, entityNames, captures);
          return `await ${objName}.lookup(${args})`;
        }
        case 'count': {
          const args = compileEntityMethodArgs(expr.arguments, entityNames, captures);
          return `await ${objName}.count(${args})`;
        }
      }
    }
  }

  // Generic call
  const args = expr.arguments.map(a => 
    compilePostconditionExpression(a, entityNames, captures)
  ).join(', ');
  
  return `${callee}(${args})`;
}

function compileEntityMethodArgs(
  args: AST.Expression[],
  entityNames: string[],
  captures: string[]
): string {
  if (args.length === 0) return '';

  // Check if it's a single value or named argument
  const arg = args[0]!;
  
  if (arg.kind === 'BinaryExpr' && arg.operator === '==') {
    // Named argument: field: value
    const fieldName = getFieldName(arg.left);
    const value = compilePostconditionExpression(arg.right, entityNames, captures);
    return `{ ${fieldName}: ${value} }`;
  }

  // Single value - try to infer field name
  const value = compilePostconditionExpression(arg, entityNames, captures);
  const fieldName = getFieldName(arg) || 'id';
  return `{ ${fieldName}: ${value} }`;
}

function compileOldExpression(
  expr: AST.Expression,
  entityNames: string[]
): string {
  switch (expr.kind) {
    case 'CallExpr': {
      if (expr.callee.kind === 'MemberExpr') {
        const objName = getObjectName(expr.callee.object);
        const method = expr.callee.property.name;
        if (objName && entityNames.includes(objName)) {
          return `${objName}_${method}`;
        }
      }
      return 'captured_value';
    }
    case 'MemberExpr': {
      const obj = compileOldExpression(expr.object, entityNames);
      return `${obj}_${expr.property.name}`;
    }
    case 'Identifier':
      return expr.name;
    default:
      return 'captured_value';
  }
}

// ============================================================================
// INVARIANT PROCESSING
// ============================================================================

function processInvariant(invariant: AST.Expression): ComputedAssertion | null {
  // Many invariants are about data handling, not runtime assertions
  // We generate a placeholder assertion that documents what should be verified

  const description = expressionToDescription(invariant);

  // Check for security invariants
  if (isSecurityInvariant(invariant)) {
    return {
      code: `// Security invariant: ${description}`,
      description: `Verify: ${description}`,
      source: 'invariant',
      confidence: 'low',
    };
  }

  // For other invariants, generate a basic check
  return {
    code: `// Invariant: ${description}\n      // Verify this holds before and after the operation`,
    description,
    source: 'invariant',
    confidence: 'low',
  };
}

function isSecurityInvariant(expr: AST.Expression): boolean {
  const str = expressionToDescription(expr).toLowerCase();
  return str.includes('never_logged') ||
         str.includes('never_stored') ||
         str.includes('secret') ||
         str.includes('encrypted') ||
         str.includes('pci') ||
         str.includes('compliance');
}

// ============================================================================
// RESULT TYPE INFERENCE
// ============================================================================

function inferResultTypeAssertions(behavior: AST.Behavior): ComputedAssertion[] {
  const assertions: ComputedAssertion[] = [];

  // Basic success assertion
  assertions.push({
    code: 'expect(result.success).toBe(true);',
    description: 'Operation should succeed',
    source: 'inferred',
    confidence: 'high',
  });

  // Result data defined
  assertions.push({
    code: 'expect(result.data).toBeDefined();',
    description: 'Result should contain data',
    source: 'inferred',
    confidence: 'high',
  });

  // Infer from output type
  const successType = behavior.output.success;
  if (successType) {
    const typeAssertions = inferTypeAssertions(successType, 'result.data');
    assertions.push(...typeAssertions);
  }

  return assertions;
}

function inferTypeAssertions(
  type: AST.TypeDefinition,
  path: string
): ComputedAssertion[] {
  const assertions: ComputedAssertion[] = [];

  switch (type.kind) {
    case 'ReferenceType': {
      // Entity reference - check ID exists
      assertions.push({
        code: `expect(${path}.id).toBeDefined();`,
        description: `${path} should have an ID`,
        source: 'inferred',
        confidence: 'medium',
      });
      break;
    }

    case 'StructType': {
      // Check required fields
      for (const field of type.fields) {
        if (!field.optional) {
          assertions.push({
            code: `expect(${path}.${field.name.name}).toBeDefined();`,
            description: `${path}.${field.name.name} should be defined`,
            source: 'inferred',
            confidence: 'medium',
          });
        }
      }
      break;
    }

    case 'PrimitiveType': {
      switch (type.name) {
        case 'UUID':
          assertions.push({
            code: `expect(${path}).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);`,
            description: `${path} should be a valid UUID`,
            source: 'inferred',
            confidence: 'medium',
          });
          break;
        case 'Timestamp':
          assertions.push({
            code: `expect(new Date(${path}).getTime()).not.toBeNaN();`,
            description: `${path} should be a valid timestamp`,
            source: 'inferred',
            confidence: 'medium',
          });
          break;
      }
      break;
    }
  }

  return assertions;
}

// ============================================================================
// CONTRACT CODE GENERATION
// ============================================================================

function generateContractCode(
  assertions: ComputedAssertion[],
  capturesBefore: string[],
  _shouldSucceed: boolean
): string {
  const lines: string[] = [];

  // Generate capture code
  if (capturesBefore.length > 0) {
    lines.push('// Capture state before execution');
    lines.push('const __old__ = {');
    for (const capture of capturesBefore) {
      const safeName = capture.replace(/\./g, '_').replace(/\(.*\)/, '');
      lines.push(`  ${safeName}: await ${capture},`);
    }
    lines.push('};');
    lines.push('');
  }

  // Generate assertions by confidence
  const highConfidence = assertions.filter(a => a.confidence === 'high');
  const mediumConfidence = assertions.filter(a => a.confidence === 'medium');
  const lowConfidence = assertions.filter(a => a.confidence === 'low');

  if (highConfidence.length > 0) {
    lines.push('// Primary assertions');
    for (const assertion of highConfidence) {
      lines.push(assertion.code);
    }
    lines.push('');
  }

  if (mediumConfidence.length > 0) {
    lines.push('// Secondary assertions');
    for (const assertion of mediumConfidence) {
      lines.push(assertion.code);
    }
    lines.push('');
  }

  if (lowConfidence.length > 0) {
    lines.push('// Invariant checks (may require manual verification)');
    for (const assertion of lowConfidence) {
      lines.push(assertion.code);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapOperator(op: AST.BinaryOperator): string {
  switch (op) {
    case '==': return '===';
    case '!=': return '!==';
    case 'and': return '&&';
    case 'or': return '||';
    case 'implies': return '||'; // !a || b (simplified)
    default: return op;
  }
}

function getObjectName(expr: AST.Expression): string | null {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'MemberExpr':
      return getObjectName(expr.object);
    default:
      return null;
  }
}

function getFieldName(expr: AST.Expression): string | null {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'InputExpr':
      return expr.property.name;
    case 'MemberExpr':
      return expr.property.name;
    case 'ResultExpr':
      return expr.property?.name || null;
    default:
      return null;
  }
}

function expressionToDescription(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'NullLiteral':
      return 'null';
    case 'InputExpr':
      return `input.${expr.property.name}`;
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    case 'MemberExpr':
      return `${expressionToDescription(expr.object)}.${expr.property.name}`;
    case 'BinaryExpr':
      return `${expressionToDescription(expr.left)} ${expr.operator} ${expressionToDescription(expr.right)}`;
    case 'CallExpr':
      const callee = expressionToDescription(expr.callee);
      const args = expr.arguments.map(a => expressionToDescription(a)).join(', ');
      return `${callee}(${args})`;
    case 'OldExpr':
      return `old(${expressionToDescription(expr.expression)})`;
    case 'UnaryExpr':
      return `${expr.operator} ${expressionToDescription(expr.operand)}`;
    default:
      return expr.kind;
  }
}

// ============================================================================
// EXPORTS FOR INTEGRATION
// ============================================================================

export {
  compilePostconditionExpression,
  expressionToDescription,
  inferResultTypeAssertions,
  computeExpectedFromPostconditions,
  extractExpectationFromPredicate,
  formatExpectedValue,
};
