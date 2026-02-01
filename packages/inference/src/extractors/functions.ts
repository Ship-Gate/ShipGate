/**
 * Function Extractor
 *
 * Extract function signatures and metadata from parsed source files.
 */

import * as ts from 'typescript';
import type { TypeScriptParseResult, extractValidationsFromBody } from '../parsers/typescript.js';
import type { PythonParseResult, extractValidationsFromPython } from '../parsers/python.js';
import type { ExtractedFunction, ExtractedParameter, ExtractedError, ExtractedSideEffect } from '../analyzer.js';

/**
 * Extract functions from parse result
 */
export function extractFunctions(
  parseResult: TypeScriptParseResult | PythonParseResult
): ExtractedFunction[] {
  if (parseResult.language === 'typescript') {
    return extractFunctionsFromTypeScript(parseResult);
  } else {
    return extractFunctionsFromPython(parseResult);
  }
}

function extractFunctionsFromTypeScript(result: TypeScriptParseResult): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  // Extract standalone functions
  for (const func of result.functions) {
    const extracted = mapTypeScriptFunction(func, result.sourceFile);
    functions.push(extracted);
  }

  // Extract class methods (as behaviors)
  for (const cls of result.classes) {
    for (const method of cls.methods) {
      // Skip private methods and constructors
      if (method.name.startsWith('_') || method.name === 'constructor') continue;

      const extracted = mapTypeScriptFunction(method, result.sourceFile);
      extracted.name = `${cls.name}.${method.name}`;
      functions.push(extracted);
    }
  }

  return functions;
}

function mapTypeScriptFunction(
  func: {
    name: string;
    async: boolean;
    parameters: { name: string; type: string; optional: boolean; defaultValue?: string }[];
    returnType: string;
    body?: ts.Block;
    location: { file: string; line: number; column: number };
    jsdoc?: { description?: string; params: Map<string, string>; returns?: string; throws?: string[] };
  },
  sourceFile: ts.SourceFile
): ExtractedFunction {
  const parameters: ExtractedParameter[] = func.parameters.map((p) => ({
    name: toSnakeCase(p.name),
    type: mapTypeScriptType(p.type),
    optional: p.optional,
    defaultValue: p.defaultValue,
  }));

  // Extract errors from body
  const throwsErrors: ExtractedError[] = [];
  const sideEffects: ExtractedSideEffect[] = [];

  if (func.body) {
    analyzeTypeScriptBody(func.body, sourceFile, throwsErrors, sideEffects);
  }

  // Add errors from JSDoc
  if (func.jsdoc?.throws) {
    for (const throwDoc of func.jsdoc.throws) {
      const errorName = extractErrorName(throwDoc);
      if (!throwsErrors.some((e) => e.type === errorName)) {
        throwsErrors.push({
          type: errorName,
          message: throwDoc,
        });
      }
    }
  }

  return {
    name: toPascalCase(func.name),
    async: func.async,
    parameters,
    returnType: mapTypeScriptType(func.returnType),
    throwsErrors,
    validations: [],
    sideEffects,
    sourceLocation: func.location,
  };
}

function analyzeTypeScriptBody(
  body: ts.Block,
  sourceFile: ts.SourceFile,
  errors: ExtractedError[],
  sideEffects: ExtractedSideEffect[]
): void {
  function visit(node: ts.Node) {
    // Look for throw statements
    if (ts.isThrowStatement(node) && node.expression) {
      const errorInfo = extractErrorFromThrow(node, sourceFile);
      if (errorInfo && !errors.some((e) => e.type === errorInfo.type)) {
        errors.push(errorInfo);
      }
    }

    // Look for await expressions (potential side effects)
    if (ts.isAwaitExpression(node)) {
      const sideEffect = extractSideEffect(node, sourceFile);
      if (sideEffect) {
        sideEffects.push(sideEffect);
      }
    }

    // Look for property access that suggests database operations
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sourceFile);
      
      if (callText.includes('.create')) {
        sideEffects.push({ type: 'create', target: extractTarget(callText) });
      } else if (callText.includes('.update') || callText.includes('.save')) {
        sideEffects.push({ type: 'update', target: extractTarget(callText) });
      } else if (callText.includes('.delete') || callText.includes('.remove')) {
        sideEffects.push({ type: 'delete', target: extractTarget(callText) });
      } else if (callText.includes('.find') || callText.includes('.get') || callText.includes('.query')) {
        sideEffects.push({ type: 'read', target: extractTarget(callText) });
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(body, visit);
}

function extractErrorFromThrow(node: ts.ThrowStatement, sourceFile: ts.SourceFile): ExtractedError | null {
  if (!node.expression) return null;

  if (ts.isNewExpression(node.expression)) {
    const errorType = node.expression.expression.getText(sourceFile);
    let message: string | undefined;
    let condition: string | undefined;

    // Extract message from first argument
    if (node.expression.arguments && node.expression.arguments.length > 0) {
      const firstArg = node.expression.arguments[0];
      if (ts.isStringLiteral(firstArg)) {
        message = firstArg.text;
        condition = message;
      }
    }

    return {
      type: toScreamingSnakeCase(errorType.replace(/Error$/, '')),
      condition,
      message,
    };
  }

  return null;
}

function extractSideEffect(node: ts.AwaitExpression, sourceFile: ts.SourceFile): ExtractedSideEffect | null {
  const text = node.expression.getText(sourceFile);

  if (text.includes('.create')) {
    return { type: 'create', target: extractTarget(text) };
  }
  if (text.includes('.update') || text.includes('.save')) {
    return { type: 'update', target: extractTarget(text) };
  }
  if (text.includes('.delete') || text.includes('.remove')) {
    return { type: 'delete', target: extractTarget(text) };
  }
  if (text.includes('.find') || text.includes('.get')) {
    return { type: 'read', target: extractTarget(text) };
  }
  if (text.includes('fetch') || text.includes('http') || text.includes('axios')) {
    return { type: 'external', target: 'HTTP' };
  }

  return null;
}

function extractTarget(callText: string): string {
  // Extract entity name from patterns like "db.users.create" or "userRepository.create"
  const match = callText.match(/(?:db\.)?(\w+)(?:Repository)?\.(?:create|update|delete|find|get)/i);
  if (match) {
    return capitalize(match[1].replace(/s$/, '')); // users -> User
  }
  return 'Entity';
}

function extractFunctionsFromPython(result: PythonParseResult): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  // Extract standalone functions
  for (const func of result.functions) {
    const extracted = mapPythonFunction(func);
    functions.push(extracted);
  }

  // Extract class methods
  for (const cls of result.classes) {
    for (const method of cls.methods) {
      // Skip private methods and dunder methods
      if (method.name.startsWith('_')) continue;

      const extracted = mapPythonFunction(method);
      extracted.name = `${cls.name}.${toPascalCase(method.name)}`;
      functions.push(extracted);
    }
  }

  return functions;
}

function mapPythonFunction(func: {
  name: string;
  async: boolean;
  parameters: { name: string; type?: string; default?: string; optional: boolean }[];
  returnType?: string;
  body: string;
  location: { file: string; line: number };
  docstring?: string;
}): ExtractedFunction {
  const parameters: ExtractedParameter[] = func.parameters
    .filter((p) => p.name !== 'self' && p.name !== 'cls')
    .map((p) => ({
      name: p.name,
      type: mapPythonType(p.type ?? 'Any'),
      optional: p.optional,
      defaultValue: p.default,
    }));

  // Extract errors from body
  const throwsErrors: ExtractedError[] = [];
  const errorMatches = func.body.matchAll(/raise\s+(\w+)\(["']([^"']+)["']\)/g);
  for (const match of errorMatches) {
    const errorType = toScreamingSnakeCase(match[1].replace(/Error$/, ''));
    if (!throwsErrors.some((e) => e.type === errorType)) {
      throwsErrors.push({
        type: errorType,
        condition: match[2],
        message: match[2],
      });
    }
  }

  // Extract side effects
  const sideEffects: ExtractedSideEffect[] = [];
  if (func.body.includes('.create(') || func.body.includes('.add(')) {
    sideEffects.push({ type: 'create', target: 'Entity' });
  }
  if (func.body.includes('.update(') || func.body.includes('.save(')) {
    sideEffects.push({ type: 'update', target: 'Entity' });
  }
  if (func.body.includes('.delete(') || func.body.includes('.remove(')) {
    sideEffects.push({ type: 'delete', target: 'Entity' });
  }

  return {
    name: toPascalCase(func.name),
    async: func.async,
    parameters,
    returnType: mapPythonType(func.returnType ?? 'None'),
    throwsErrors,
    validations: [],
    sideEffects,
    sourceLocation: { ...func.location, column: 1 },
  };
}

function mapTypeScriptType(tsType: string): string {
  const typeMap: Record<string, string> = {
    string: 'String',
    number: 'Int',
    boolean: 'Boolean',
    Date: 'Timestamp',
    void: 'Void',
  };

  // Handle Promise<T>
  const promiseMatch = tsType.match(/Promise<(.+)>/);
  if (promiseMatch) {
    return mapTypeScriptType(promiseMatch[1]);
  }

  return typeMap[tsType] ?? capitalize(tsType);
}

function mapPythonType(pyType: string): string {
  const typeMap: Record<string, string> = {
    str: 'String',
    int: 'Int',
    float: 'Float',
    bool: 'Boolean',
    datetime: 'Timestamp',
    None: 'Void',
  };

  return typeMap[pyType] ?? capitalize(pyType);
}

function extractErrorName(throwDoc: string): string {
  // Extract error name from JSDoc @throws comment
  const match = throwDoc.match(/^(\w+)/);
  return match ? toScreamingSnakeCase(match[1]) : 'UNKNOWN_ERROR';
}

function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

function toScreamingSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
