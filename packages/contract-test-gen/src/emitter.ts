import type { TestSuite, TestCase } from './types.js';

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function serializeValue(value: unknown, indent: number = 4): string {
  if (value === null || value === undefined) return 'undefined';
  if (typeof value === 'string') return `'${escapeString(value)}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => `${pad(indent + 2)}${serializeValue(v, indent + 2)}`).join(',\n');
    return `[\n${items},\n${pad(indent)}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(
      ([k, v]) => `${pad(indent + 2)}${safeKey(k)}: ${serializeValue(v, indent + 2)}`,
    );
    return `{\n${lines.join(',\n')},\n${pad(indent)}}`;
  }

  return String(value);
}

function safeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${escapeString(key)}'`;
}

function pad(n: number): string {
  return ' '.repeat(n);
}

function emitFetchCall(test: TestCase, baseUrlVar: string): string {
  const lines: string[] = [];
  const hasBody = test.body !== undefined && test.method !== 'GET';

  lines.push(`    const response = await fetch(\`\${${baseUrlVar}}${test.path}\`, {`);
  lines.push(`      method: '${test.method}',`);

  if (test.headers && Object.keys(test.headers).length > 0) {
    lines.push(`      headers: ${serializeValue(test.headers, 6)},`);
  }

  if (hasBody) {
    lines.push(`      body: JSON.stringify(${serializeValue(test.body, 6)}),`);
  }

  lines.push('    });');
  return lines.join('\n');
}

function emitAssertions(test: TestCase, framework: 'vitest' | 'jest'): string {
  const lines: string[] = [];
  const expectFn = 'expect';

  lines.push(`    ${expectFn}(response.status).toBe(${test.expectedStatus});`);

  if (test.expectedStatus >= 200 && test.expectedStatus < 300) {
    lines.push('');
    lines.push('    const body = await response.json();');

    if (test.expectedShape) {
      lines.push('');
      for (const [field, expectedType] of Object.entries(test.expectedShape)) {
        lines.push(`    ${expectFn}(typeof body.${safeKey(field)}).toBe('${expectedType}');`);
      }
    }

    if (test.expectedFields) {
      lines.push('');
      for (const [field, value] of Object.entries(test.expectedFields)) {
        lines.push(`    ${expectFn}(body.${safeKey(field)}).toEqual(${serializeValue(value)});`);
      }
    }
  }

  if (test.expectedStatus >= 400) {
    lines.push('');
    lines.push('    const body = await response.json().catch(() => null);');
    lines.push(`    if (body) {`);
    lines.push(`      ${expectFn}(body).toHaveProperty('error');`);
    lines.push('    }');
  }

  return lines.join('\n');
}

function emitTestBlock(test: TestCase, framework: 'vitest' | 'jest', baseUrlVar: string): string {
  const lines: string[] = [];

  lines.push(`  it('${escapeString(test.name)}', async () => {`);
  lines.push(emitFetchCall(test, baseUrlVar));
  lines.push('');
  lines.push(emitAssertions(test, framework));
  lines.push('  });');

  return lines.join('\n');
}

function emitSuiteHeader(suite: TestSuite, framework: 'vitest' | 'jest'): string {
  const lines: string[] = [];

  if (framework === 'vitest') {
    lines.push("import { describe, it, expect } from 'vitest';");
  }

  lines.push('');
  lines.push(`const BASE_URL = process.env.API_BASE_URL ?? '${escapeString(suite.baseUrl)}';`);
  lines.push('');

  return lines.join('\n');
}

function groupTestsByCategory(tests: TestCase[]): Map<string, TestCase[]> {
  const groups = new Map<string, TestCase[]>();

  for (const test of tests) {
    let category: string;
    if (test.name.includes('unauthorized')) {
      category = 'Authentication';
    } else if (test.name.includes('invalid') || test.name.includes('empty body')) {
      category = 'Validation';
    } else if (test.name.includes('postcondition')) {
      category = 'Postconditions';
    } else if (
      test.name.includes('boundary') ||
      test.name.includes('below min') ||
      test.name.includes('above max') ||
      test.name.includes('at min') ||
      test.name.includes('at max') ||
      test.name.includes('-char string') ||
      test.name.includes('empty string') ||
      test.name.includes('missing @') ||
      test.name.includes('missing domain') ||
      test.name.includes('missing protocol') ||
      test.name.includes('truncated') ||
      test.name.includes('non-hex') ||
      test.name.includes('non-numeric') ||
      test.name.includes('letters in') ||
      test.name.includes('too short') ||
      test.name.includes('string "true"') ||
      test.name.includes('with spaces')
    ) {
      category = 'Boundary Values';
    } else {
      category = 'Happy Path';
    }

    const existing = groups.get(category) ?? [];
    existing.push(test);
    groups.set(category, existing);
  }

  return groups;
}

export function emitVitest(suite: TestSuite): string {
  const lines: string[] = [];

  lines.push(emitSuiteHeader(suite, 'vitest'));
  lines.push(`describe('${escapeString(suite.name)} Contract Tests', () => {`);

  const groups = groupTestsByCategory(suite.tests);

  for (const [category, tests] of groups) {
    lines.push('');
    lines.push(`  describe('${escapeString(category)}', () => {`);
    for (const test of tests) {
      lines.push('');
      lines.push(emitTestBlock(test, 'vitest', 'BASE_URL'));
    }
    lines.push('  });');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

export function emitJest(suite: TestSuite): string {
  const lines: string[] = [];

  lines.push("// Jest contract tests - auto-generated from ISL spec");
  lines.push("// Run with: npx jest --config jest.config.ts");
  lines.push('');
  lines.push(`const BASE_URL = process.env.API_BASE_URL ?? '${escapeString(suite.baseUrl)}';`);
  lines.push('');
  lines.push(`describe('${escapeString(suite.name)} Contract Tests', () => {`);

  const groups = groupTestsByCategory(suite.tests);

  for (const [category, tests] of groups) {
    lines.push('');
    lines.push(`  describe('${escapeString(category)}', () => {`);
    for (const test of tests) {
      lines.push('');
      lines.push(emitTestBlock(test, 'jest', 'BASE_URL'));
    }
    lines.push('  });');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}
