/**
 * Validation Extractor
 *
 * Extract validation logic from function bodies.
 */

import * as ts from 'typescript';
import type { TypeScriptParseResult } from '../parsers/typescript.js';
import type { PythonParseResult } from '../parsers/python.js';
import type { ExtractedValidation } from '../analyzer.js';

/**
 * Extract validations from parse result
 */
export function extractValidations(
  parseResult: TypeScriptParseResult | PythonParseResult
): ExtractedValidation[] {
  if (parseResult.language === 'typescript') {
    return extractValidationsFromTypeScript(parseResult);
  } else {
    return extractValidationsFromPython(parseResult);
  }
}

function extractValidationsFromTypeScript(result: TypeScriptParseResult): ExtractedValidation[] {
  const validations: ExtractedValidation[] = [];

  // Extract from functions
  for (const func of result.functions) {
    if (func.body) {
      const funcValidations = analyzeTypeScriptBody(func.body, result.sourceFile);
      validations.push(...funcValidations);
    }
  }

  // Extract from class methods
  for (const cls of result.classes) {
    for (const method of cls.methods) {
      if (method.body) {
        const methodValidations = analyzeTypeScriptBody(method.body, result.sourceFile);
        validations.push(...methodValidations);
      }
    }
  }

  return validations;
}

function analyzeTypeScriptBody(body: ts.Block, sourceFile: ts.SourceFile): ExtractedValidation[] {
  const validations: ExtractedValidation[] = [];

  function visit(node: ts.Node) {
    // Pattern 1: if (condition) throw new Error(...)
    if (ts.isIfStatement(node)) {
      const validation = extractFromIfThrow(node, sourceFile);
      if (validation) {
        validations.push(validation);
      }
    }

    // Pattern 2: assert(condition) or console.assert(condition)
    if (ts.isCallExpression(node)) {
      const callName = node.expression.getText(sourceFile);
      if (callName === 'assert' || callName === 'console.assert') {
        const validation = extractFromAssert(node, sourceFile);
        if (validation) {
          validations.push(validation);
        }
      }
    }

    // Pattern 3: Early return with condition
    if (ts.isIfStatement(node) && ts.isReturnStatement(node.thenStatement)) {
      const validation = extractFromEarlyReturn(node, sourceFile);
      if (validation) {
        validations.push(validation);
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(body, visit);
  return validations;
}

function extractFromIfThrow(node: ts.IfStatement, sourceFile: ts.SourceFile): ExtractedValidation | null {
  // Check if then branch contains throw
  let hasThrow = false;
  let errorMessage: string | undefined;

  function checkThrow(n: ts.Node) {
    if (ts.isThrowStatement(n)) {
      hasThrow = true;
      if (n.expression && ts.isNewExpression(n.expression)) {
        const args = n.expression.arguments;
        if (args && args.length > 0 && ts.isStringLiteral(args[0])) {
          errorMessage = args[0].text;
        }
      }
    }
    ts.forEachChild(n, checkThrow);
  }

  if (ts.isBlock(node.thenStatement)) {
    ts.forEachChild(node.thenStatement, checkThrow);
  } else if (ts.isThrowStatement(node.thenStatement)) {
    hasThrow = true;
  }

  if (!hasThrow) return null;

  // The condition in if triggers error, so the actual precondition is the negation
  const condition = node.expression.getText(sourceFile);
  const islCondition = convertToISLCondition(condition, true);

  return {
    condition: islCondition,
    errorMessage,
    type: 'precondition',
    field: extractFieldFromCondition(condition),
  };
}

function extractFromAssert(node: ts.CallExpression, sourceFile: ts.SourceFile): ExtractedValidation | null {
  if (node.arguments.length === 0) return null;

  const condition = node.arguments[0].getText(sourceFile);
  const message = node.arguments.length > 1 && ts.isStringLiteral(node.arguments[1])
    ? node.arguments[1].text
    : undefined;

  return {
    condition: convertToISLCondition(condition, false),
    errorMessage: message,
    type: 'invariant',
    field: extractFieldFromCondition(condition),
  };
}

function extractFromEarlyReturn(node: ts.IfStatement, sourceFile: ts.SourceFile): ExtractedValidation | null {
  const condition = node.expression.getText(sourceFile);

  return {
    condition: convertToISLCondition(condition, true),
    type: 'precondition',
    field: extractFieldFromCondition(condition),
  };
}

function extractValidationsFromPython(result: PythonParseResult): ExtractedValidation[] {
  const validations: ExtractedValidation[] = [];

  // Extract from standalone functions
  for (const func of result.functions) {
    const funcValidations = analyzePythonBody(func.body);
    validations.push(...funcValidations);
  }

  // Extract from class methods
  for (const cls of result.classes) {
    for (const method of cls.methods) {
      const methodValidations = analyzePythonBody(method.body);
      validations.push(...methodValidations);
    }
  }

  return validations;
}

function analyzePythonBody(body: string): ExtractedValidation[] {
  const validations: ExtractedValidation[] = [];

  // Pattern 1: if condition: raise Error("message")
  const ifRaiseMatches = body.matchAll(/if\s+(not\s+)?([^:]+):\s*\n\s+raise\s+\w+\(["']([^"']+)["']\)/g);
  for (const match of ifRaiseMatches) {
    const negated = !!match[1];
    const condition = match[2].trim();
    const errorMessage = match[3];

    validations.push({
      condition: convertPythonToISL(condition, !negated),
      errorMessage,
      type: 'precondition',
      field: extractFieldFromCondition(condition),
    });
  }

  // Pattern 2: assert condition, "message"
  const assertMatches = body.matchAll(/assert\s+([^,\n]+)(?:,\s*["']([^"']+)["'])?/g);
  for (const match of assertMatches) {
    const condition = match[1].trim();
    const message = match[2];

    validations.push({
      condition: convertPythonToISL(condition, false),
      errorMessage: message,
      type: 'invariant',
      field: extractFieldFromCondition(condition),
    });
  }

  return validations;
}

/**
 * Convert a TypeScript/JavaScript condition to ISL format
 */
function convertToISLCondition(condition: string, negate: boolean): string {
  let isl = condition;

  // Replace operators
  isl = isl.replace(/===/g, '==');
  isl = isl.replace(/!==/g, '!=');
  isl = isl.replace(/&&/g, 'and');
  isl = isl.replace(/\|\|/g, 'or');
  isl = isl.replace(/!/g, 'not ');

  // Replace common patterns
  isl = isl.replace(/\.includes\((['"])@\1\)/g, '.is_valid_format');
  isl = isl.replace(/\.includes\(/g, '.contains(');
  isl = isl.replace(/\.length/g, '.length');
  isl = isl.replace(/\.trim\(\)/g, '');

  // Handle negation
  if (negate) {
    if (isl.startsWith('not ')) {
      isl = isl.slice(4);
    } else if (isl.includes(' and ') || isl.includes(' or ')) {
      // For complex conditions, wrap in not
      isl = `not (${isl})`;
    } else {
      isl = `not ${isl}`;
    }
  }

  // Clean up double negations
  isl = isl.replace(/not not /g, '');
  isl = isl.replace(/not  /g, 'not ');

  return isl;
}

/**
 * Convert a Python condition to ISL format
 */
function convertPythonToISL(condition: string, negate: boolean): string {
  let isl = condition;

  // Python 'in' for string containment
  isl = isl.replace(/["']@["']\s+in\s+(\w+)/g, '$1.is_valid_format');
  isl = isl.replace(/["']([^"']+)["']\s+in\s+(\w+)/g, '$2.contains("$1")');

  // len() function
  isl = isl.replace(/len\((\w+)\)/g, '$1.length');

  // Handle negation
  if (negate) {
    if (isl.startsWith('not ')) {
      isl = isl.slice(4);
    } else {
      isl = `not ${isl}`;
    }
  }

  return isl;
}

/**
 * Extract field name from a condition if it references a specific field
 */
function extractFieldFromCondition(condition: string): string | undefined {
  // Match patterns like "email.includes" or "username.length" or "input.email"
  const match = condition.match(/(?:input\.)?(\w+)\.(?:includes|length|is_valid|contains|trim)/);
  if (match) {
    return match[1];
  }

  // Match patterns like "email" in simple comparisons
  const simpleMatch = condition.match(/^!?(\w+)$/);
  if (simpleMatch) {
    return simpleMatch[1];
  }

  return undefined;
}
