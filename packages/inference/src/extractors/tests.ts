/**
 * Test Extractor
 *
 * Extract test cases to enhance inferred specifications.
 */

import type { TypeScriptParseResult } from '../parsers/typescript.js';
import type { PythonParseResult } from '../parsers/python.js';
import type { ExtractedTestCase } from '../analyzer.js';

/**
 * Extract test cases from parse result
 */
export function extractFromTests(
  parseResult: TypeScriptParseResult | PythonParseResult
): ExtractedTestCase[] {
  if (parseResult.language === 'typescript') {
    return extractTestsFromTypeScript(parseResult);
  } else {
    return extractTestsFromPython(parseResult);
  }
}

function extractTestsFromTypeScript(result: TypeScriptParseResult): ExtractedTestCase[] {
  const testCases: ExtractedTestCase[] = [];

  for (const func of result.functions) {
    // Match test function patterns: test(), it(), describe blocks
    if (!isTestFunction(func.name)) continue;

    const testCase = extractTypeScriptTestCase(func, result);
    if (testCase) {
      testCases.push(testCase);
    }
  }

  return testCases;
}

function isTestFunction(name: string): boolean {
  const testPatterns = [
    /^test/i,
    /^it$/,
    /^should/i,
    /Test$/,
    /Spec$/,
  ];
  return testPatterns.some((p) => p.test(name));
}

function extractTypeScriptTestCase(
  func: {
    name: string;
    body?: import('typescript').Block;
    parameters: { name: string; type: string }[];
  },
  result: TypeScriptParseResult
): ExtractedTestCase | null {
  if (!func.body) return null;

  const bodyText = func.body.getText(result.sourceFile);

  // Extract test name from the first string argument or function name
  const testNameMatch = bodyText.match(/(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
  const testName = (testNameMatch && testNameMatch[1]) ? testNameMatch[1] : func.name;

  // Extract function being tested
  const functionNameMatch = bodyText.match(/(?:await\s+)?(\w+)\s*\(/);
  const functionName = (functionNameMatch && functionNameMatch[1]) ? functionNameMatch[1] : 'unknown';

  // Extract input values from calls
  const inputs = extractInputsFromTest(bodyText);

  // Extract expected values from assertions
  const { expectedOutput, expectedError, assertions } = extractExpectations(bodyText);

  return {
    name: testName,
    functionName,
    inputs,
    expectedOutput,
    expectedError,
    assertions,
  };
}

function extractInputsFromTest(bodyText: string): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Extract object literals passed to functions
  const objectMatch = bodyText.match(/\(\s*\{([^}]+)\}\s*\)/);
  if (objectMatch && objectMatch[1]) {
    const props = objectMatch[1].matchAll(/(\w+)\s*:\s*(['"`]?)([^,}'"]+)\2/g);
    for (const prop of props) {
      const key = prop[1];
      const value = prop[3];
      if (key && value) {
        inputs[key] = isNumeric(value.trim()) ? Number(value.trim()) : value.trim();
      }
    }
  }

  // Extract simple string/number arguments
  const simpleArgsMatch = bodyText.match(/\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/);
  if (simpleArgsMatch && simpleArgsMatch[1]) {
    if (!Object.keys(inputs).length) {
      inputs['arg1'] = simpleArgsMatch[1];
      if (simpleArgsMatch[2]) {
        inputs['arg2'] = simpleArgsMatch[2];
      }
    }
  }

  return inputs;
}

function extractExpectations(bodyText: string): {
  expectedOutput?: unknown;
  expectedError?: string;
  assertions: string[];
} {
  const assertions: string[] = [];
  let expectedOutput: unknown;
  let expectedError: string | undefined;

  // Extract expect().toBe/toEqual assertions
  const expectMatches = bodyText.matchAll(/expect\(([^)]+)\)\.(\w+)\(([^)]*)\)/g);
  for (const match of expectMatches) {
    const actualPart = match[1];
    const matcherPart = match[2];
    const expectedPart = match[3];
    if (!actualPart || !matcherPart) continue;
    
    const actual = actualPart.trim();
    const matcher = matcherPart;
    const expected = expectedPart?.trim() ?? '';

    assertions.push(`${actual} ${matcherToOperator(matcher)} ${expected}`);

    // Track expected output
    if (actual.includes('result') || actual.includes('response')) {
      if (matcher === 'toBe' || matcher === 'toEqual') {
        expectedOutput = parseExpectedValue(expected);
      }
    }
  }

  // Extract error expectations
  const errorMatch = bodyText.match(/\.rejects\.toThrow\(['"`]?([^'"`)]*)['"`]?\)/);
  if (errorMatch) {
    expectedError = errorMatch[1] || 'Error';
  }

  const toThrowMatch = bodyText.match(/expect\([^)]+\)\.toThrow\(['"`]?([^'"`)]*)['"`]?\)/);
  if (toThrowMatch) {
    expectedError = toThrowMatch[1] || 'Error';
  }

  // Extract Jest/Vitest assertions
  const assertMatches = bodyText.matchAll(/assert(?:\.(\w+))?\(([^)]+)\)/g);
  for (const match of assertMatches) {
    const type = match[1] ?? 'true';
    const args = match[2];
    if (args) {
      assertions.push(`assert.${type}(${args})`);
    }
  }

  return { expectedOutput, expectedError, assertions };
}

function matcherToOperator(matcher: string): string {
  const operators: Record<string, string> = {
    toBe: '==',
    toEqual: '==',
    toBeTruthy: '== true',
    toBeFalsy: '== false',
    toBeNull: '== null',
    toBeUndefined: '== undefined',
    toBeGreaterThan: '>',
    toBeLessThan: '<',
    toBeGreaterThanOrEqual: '>=',
    toBeLessThanOrEqual: '<=',
    toContain: 'contains',
    toHaveLength: '.length ==',
  };
  return operators[matcher] ?? matcher;
}

function parseExpectedValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;
  if (isNumeric(value)) return Number(value);
  if (value.startsWith("'") || value.startsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function extractTestsFromPython(result: PythonParseResult): ExtractedTestCase[] {
  const testCases: ExtractedTestCase[] = [];

  for (const func of result.functions) {
    // Match pytest function patterns
    if (!func.name.startsWith('test_')) continue;

    const testCase = extractPythonTestCase(func);
    if (testCase) {
      testCases.push(testCase);
    }
  }

  // Extract from test classes
  for (const cls of result.classes) {
    if (!cls.name.startsWith('Test')) continue;

    for (const method of cls.methods) {
      if (!method.name.startsWith('test_')) continue;

      const testCase = extractPythonTestCase(method);
      if (testCase) {
        testCases.push(testCase);
      }
    }
  }

  return testCases;
}

function extractPythonTestCase(func: {
  name: string;
  body: string;
  docstring?: string;
}): ExtractedTestCase | null {
  const testName = func.docstring ?? func.name.replace(/^test_/, '').replace(/_/g, ' ');

  // Extract function being tested
  const funcCallMatch = func.body.match(/(?:await\s+)?(\w+)\s*\(/);
  const functionName = (funcCallMatch && funcCallMatch[1]) ? funcCallMatch[1] : 'unknown';

  // Extract inputs
  const inputs = extractPythonInputs(func.body);

  // Extract assertions
  const assertions: string[] = [];
  let expectedError: string | undefined;

  // assert statements
  const assertMatches = func.body.matchAll(/assert\s+([^,\n]+)/g);
  for (const match of assertMatches) {
    const assertion = match[1];
    if (assertion) {
      assertions.push(assertion.trim());
    }
  }

  // pytest.raises
  const raisesMatch = func.body.match(/pytest\.raises\((\w+)\)/);
  if (raisesMatch && raisesMatch[1]) {
    expectedError = raisesMatch[1];
  }

  return {
    name: testName,
    functionName,
    inputs,
    expectedError,
    assertions,
  };
}

function extractPythonInputs(body: string): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Extract keyword arguments
  const kwargMatches = body.matchAll(/(\w+)\s*=\s*(['"]?)([^,)'"]+)\2/g);
  for (const match of kwargMatches) {
    const key = match[1];
    const value = match[3];
    if (!key || !value) continue;
    // Skip common non-input patterns
    if (['assert', 'return', 'raise', 'await'].includes(key)) continue;

    const trimmedValue = value.trim();
    inputs[key] = isNumeric(trimmedValue) ? Number(trimmedValue) : trimmedValue;
  }

  return inputs;
}

function isNumeric(value: string): boolean {
  return !isNaN(Number(value)) && !isNaN(parseFloat(value));
}
