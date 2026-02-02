/**
 * Fixture-based Tests
 *
 * Loads JSON fixtures and evaluates IR expressions against contexts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  IR,
  evaluate,
  createEvaluationContext,
  resetNodeIdCounter,
  type IRExpr,
  type ContextOptions,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load fixtures
const fixturesPath = resolve(__dirname, '../fixtures/contexts.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

// IR Parser - converts pseudo-notation to actual IR
// This is a simplified parser for test fixtures
function parseIR(notation: string, ctx: ContextOptions): IRExpr {
  notation = notation.trim();

  // Literals
  if (notation === 'true') return IR.bool(true);
  if (notation === 'false') return IR.bool(false);
  if (notation === 'null') return IR.null();
  if (/^-?\d+(\.\d+)?$/.test(notation)) return IR.number(parseFloat(notation));
  if (notation.startsWith("'") && notation.endsWith("'")) {
    return IR.string(notation.slice(1, -1));
  }
  if (notation.startsWith('"') && notation.endsWith('"')) {
    return IR.string(notation.slice(1, -1));
  }

  // Regex
  const regexMatch = notation.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    return IR.regex(regexMatch[1]!, regexMatch[2] || '');
  }

  // Function-style IR nodes
  const funcMatch = notation.match(/^(\w+)\((.*)$/);
  if (funcMatch) {
    const funcName = funcMatch[1]!;
    const rest = funcMatch[2]!;

    // Find the matching closing paren
    let parenDepth = 1;
    let bracketDepth = 0;
    let braceDepth = 0;
    let i = 0;
    while (i < rest.length && parenDepth > 0) {
      if (rest[i] === '(' && bracketDepth === 0 && braceDepth === 0) parenDepth++;
      if (rest[i] === ')' && bracketDepth === 0 && braceDepth === 0) parenDepth--;
      if (rest[i] === '[') bracketDepth++;
      if (rest[i] === ']') bracketDepth--;
      if (rest[i] === '{') braceDepth++;
      if (rest[i] === '}') braceDepth--;
      i++;
    }

    const argsStr = rest.slice(0, i - 1);
    const args = parseArgs(argsStr, ctx);

    switch (funcName) {
      case 'Existence':
        return IR.exists(args[0] as IRExpr, args[1] === true);
      case 'Compare': {
        const op = args[0] as string;
        // Handle == as equality check
        if (op === '==') {
          return IR.eq(args[1] as IRExpr, args[2] as IRExpr, false);
        }
        return IR.compare(op as any, args[1] as IRExpr, args[2] as IRExpr);
      }
      case 'Equality':
        return IR.eq(args[0] as IRExpr, args[1] as IRExpr, args[2] === true);
      case 'StringLength':
        return IR.strLen(args[0] as IRExpr);
      case 'StringMatches':
        return IR.strMatches(args[0] as IRExpr, args[1] as IRExpr);
      case 'StringIncludes': {
        // args[1] might be a string, need to convert to IR.string
        const target = args[0] as IRExpr;
        const substring = typeof args[1] === 'string' ? IR.string(args[1]) : args[1] as IRExpr;
        return IR.strIncludes(target, substring);
      }
      case 'StringStartsWith': {
        const target = args[0] as IRExpr;
        const prefix = typeof args[1] === 'string' ? IR.string(args[1]) : args[1] as IRExpr;
        return IR.strStartsWith(target, prefix);
      }
      case 'StringEndsWith': {
        const target = args[0] as IRExpr;
        const suffix = typeof args[1] === 'string' ? IR.string(args[1]) : args[1] as IRExpr;
        return IR.strEndsWith(target, suffix);
      }
      case 'Between':
        return IR.between(args[0] as IRExpr, args[1] as IRExpr, args[2] as IRExpr, args[3] === true);
      case 'InSet':
        return IR.inSet(args[0] as IRExpr, args[1] as IRExpr[], args[2] === true);
      case 'And':
        return IR.and(args[0] as IRExpr[]);
      case 'Or':
        return IR.or(args[0] as IRExpr[]);
      case 'Not':
        return IR.not(args[0] as IRExpr);
      case 'Implies':
        return IR.implies(args[0] as IRExpr, args[1] as IRExpr);
      case 'ArrayLength':
        return IR.arrayLen(args[0] as IRExpr);
      case 'ArrayIncludes': {
        const target = args[0] as IRExpr;
        const element = typeof args[1] === 'string' ? IR.string(args[1]) : args[1] as IRExpr;
        return IR.arrayIncludes(target, element);
      }
      case 'QuantifierAll':
        return IR.quantAll(args[0] as IRExpr, args[1] as string, args[2] as IRExpr);
      case 'QuantifierAny':
        return IR.quantAny(args[0] as IRExpr, args[1] as string, args[2] as IRExpr);
      case 'QuantifierNone':
        return IR.quantNone(args[0] as IRExpr, args[1] as string, args[2] as IRExpr);
      case 'QuantifierCount':
        return IR.quantCount(args[0] as IRExpr, args[1] as string, args[2] as IRExpr);
      case 'EntityExists':
        return IR.entityExists(args[0] as string, args[1] === null ? undefined : args[1] as IRExpr);
      case 'EntityCount':
        return IR.entityCount(args[0] as string, args[1] === null ? undefined : args[1] as IRExpr);
      case 'EntityLookup':
        return IR.entityLookup(args[0] as string, args[1] as IRExpr);
      default:
        return IR.call(funcName, args.filter((a): a is IRExpr => a !== null && typeof a !== 'string' && typeof a !== 'boolean'));
    }
  }

  // Property access chains
  if (notation.includes('.')) {
    const parts = notation.split('.');
    let result: IRExpr;

    // Handle special prefixes
    if (parts[0] === 'input') {
      if (parts.length === 2) {
        result = IR.input(parts[1]!);
      } else {
        result = IR.input(parts[1]!);
        for (let i = 2; i < parts.length; i++) {
          result = IR.prop(result, parts[i]!);
        }
      }
    } else if (parts[0] === 'result') {
      if (parts.length === 2) {
        result = IR.result(parts[1]);
      } else {
        result = IR.result(parts[1]);
        for (let i = 2; i < parts.length; i++) {
          result = IR.prop(result, parts[i]!);
        }
      }
    } else {
      result = IR.variable(parts[0]!);
      for (let i = 1; i < parts.length; i++) {
        result = IR.prop(result, parts[i]!);
      }
    }
    return result;
  }

  // Simple variable
  return IR.variable(notation);
}

function parseArgs(argsStr: string, ctx: ContextOptions): (IRExpr | string | boolean | null | IRExpr[])[] {
  const args: (IRExpr | string | boolean | null | IRExpr[])[] = [];
  let current = '';
  let depth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i <= argsStr.length; i++) {
    const char = argsStr[i];

    if (i === argsStr.length || (char === ',' && depth === 0 && bracketDepth === 0 && braceDepth === 0 && !inString)) {
      const trimmed = current.trim();
      if (trimmed) {
        args.push(parseArgValue(trimmed, ctx));
      }
      current = '';
      continue;
    }

    if ((char === '"' || char === "'") && !inString) {
      inString = true;
      stringChar = char;
    } else if (char === stringChar && inString) {
      inString = false;
    }

    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === '[') bracketDepth++;
      if (char === ']') bracketDepth--;
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    current += char;
  }

  return args;
}

function parseArgValue(value: string, ctx: ContextOptions): IRExpr | string | boolean | null | IRExpr[] {
  value = value.trim();

  // Boolean/null
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  // Comparison operators as strings (including ==)
  if (value === '>' || value === '>=' || value === '<' || value === '<=' || value === '==') {
    return value;
  }

  // String literal (for entity names, variable names)
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  // Double-quoted string literal
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  // Array
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1);
    if (!inner.trim()) return [];

    const elements = parseArgs(inner, ctx);
    return elements.map((e) => {
      if (typeof e === 'string') return IR.string(e);
      if (typeof e === 'boolean') return IR.bool(e);
      if (e === null) return IR.null();
      if (Array.isArray(e)) return IR.list(e);
      return e;
    });
  }

  // Map/Object
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1);
    const entries: { key: string; value: IRExpr }[] = [];

    // Simple parsing: key: value pairs
    const pairs = inner.split(',');
    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx > 0) {
        const key = pair.slice(0, colonIdx).trim();
        const val = pair.slice(colonIdx + 1).trim();
        const parsed = parseArgValue(val, ctx);
        entries.push({
          key,
          value: typeof parsed === 'string'
            ? IR.string(parsed)
            : typeof parsed === 'boolean'
              ? IR.bool(parsed)
              : parsed === null
                ? IR.null()
                : Array.isArray(parsed)
                  ? IR.list(parsed)
                  : parsed as IRExpr,
        });
      }
    }
    return IR.map(entries);
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return IR.number(parseFloat(value));
  }

  // Regex
  const regexMatch = value.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    return IR.regex(regexMatch[1]!, regexMatch[2] || '');
  }

  // Function call or complex expression
  if (value.includes('(')) {
    return parseIR(value, ctx);
  }

  // Variable or property chain
  return parseIR(value, ctx);
}

// Test runner
describe('Fixture-based Evaluation Tests', () => {
  beforeEach(() => resetNodeIdCounter());

  for (const testContext of fixtures.contexts) {
    describe(`Context: ${testContext.id} - ${testContext.description}`, () => {
      const contextOpts: ContextOptions = {
        input: testContext.context.input || {},
        result: testContext.context.result,
        variables: testContext.context.variables || {},
        entities: testContext.context.entities || {},
      };

      for (const test of testContext.tests) {
        it(`${test.ir} => ${JSON.stringify(test.expected)}`, () => {
          resetNodeIdCounter();

          try {
            const ir = parseIR(test.ir, contextOpts);
            const evalCtx = createEvaluationContext(contextOpts);
            const result = evaluate(ir, evalCtx);

            expect(result).toEqual(test.expected);
          } catch (error) {
            // If parsing fails, provide helpful error message
            throw new Error(`Failed to parse/evaluate: ${test.ir}\n${error}`);
          }
        });
      }
    });
  }
});

// Additional edge case tests
describe('Fixture Edge Cases', () => {
  beforeEach(() => resetNodeIdCounter());

  it('handles deeply nested property chains', () => {
    const ir = IR.prop(IR.prop(IR.prop(IR.prop(IR.variable('a'), 'b'), 'c'), 'd'), 'e');
    const ctx = createEvaluationContext({
      variables: { a: { b: { c: { d: { e: 'found' } } } } },
    });
    expect(evaluate(ir, ctx)).toBe('found');
  });

  it('handles null in deep chains gracefully', () => {
    const ir = IR.prop(IR.prop(IR.variable('a'), 'b'), 'c');
    const ctx = createEvaluationContext({
      variables: { a: { b: null } },
    });
    expect(evaluate(ir, ctx)).toBeUndefined();
  });

  it('handles empty arrays in quantifiers', () => {
    const ir = IR.quantAll(IR.variable('arr'), 'x', IR.compare('>', IR.variable('x'), IR.number(0)));
    const ctx = createEvaluationContext({ variables: { arr: [] } });
    // All in empty set is vacuously true
    expect(evaluate(ir, ctx)).toBe(true);
  });

  it('handles empty arrays in any quantifier', () => {
    const ir = IR.quantAny(IR.variable('arr'), 'x', IR.compare('>', IR.variable('x'), IR.number(0)));
    const ctx = createEvaluationContext({ variables: { arr: [] } });
    // Any in empty set is false
    expect(evaluate(ir, ctx)).toBe(false);
  });
});
