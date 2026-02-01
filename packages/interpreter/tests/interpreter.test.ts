// ============================================================================
// ISL Interpreter - Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import {
  ISLInterpreter,
  loadBindings,
  loadJsonBindings,
  parseTestData,
  toValue,
  fromValue,
  createBindings,
  runWithTimeout,
  cloneValue,
  valuesEqual,
  generateJsonReport,
  generateTerminalReport,
  generateJUnitReport,
  generateMarkdownReport,
  DEFAULT_OPTIONS,
  BindingError,
  TimeoutError,
} from '../src';
import type { Value, TestData, VerificationReport } from '../src';

// ============================================================================
// BINDINGS TESTS
// ============================================================================

describe('Bindings', () => {
  describe('loadJsonBindings', () => {
    it('should load valid JSON test data', async () => {
      const fixturePath = resolve(__dirname, 'fixtures/payment.json');
      const testData = await loadJsonBindings(fixturePath);
      
      expect(testData.intent).toBe('TransferFunds');
      expect(testData.bindings.pre.sender).toBeDefined();
      expect(testData.bindings.pre.receiver).toBeDefined();
      expect(testData.bindings.pre.amount).toBe(100);
    });
    
    it('should throw BindingError for missing file', async () => {
      await expect(loadJsonBindings('nonexistent.json')).rejects.toThrow(BindingError);
    });
  });
  
  describe('parseTestData', () => {
    it('should parse valid test data', () => {
      const data = {
        intent: 'TestBehavior',
        bindings: {
          pre: { x: 1, y: 2 },
          post: { x: 3, y: 4 },
        },
      };
      
      const result = parseTestData(data);
      
      expect(result.intent).toBe('TestBehavior');
      expect(result.bindings.pre.x).toBe(1);
      expect(result.bindings.post?.x).toBe(3);
    });
    
    it('should throw for missing intent', () => {
      const data = { bindings: { pre: {} } };
      expect(() => parseTestData(data)).toThrow(BindingError);
    });
    
    it('should throw for missing bindings', () => {
      const data = { intent: 'Test' };
      expect(() => parseTestData(data)).toThrow(BindingError);
    });
    
    it('should parse scenarios', () => {
      const data = {
        intent: 'TestBehavior',
        bindings: { pre: {} },
        scenarios: [
          { name: 'test scenario', given: { x: 1 } },
        ],
      };
      
      const result = parseTestData(data);
      
      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios![0].name).toBe('test scenario');
    });
  });
  
  describe('toValue / fromValue', () => {
    it('should convert primitives', () => {
      expect(toValue(true)).toEqual({ tag: 'boolean', value: true });
      expect(toValue(42)).toEqual({ tag: 'int', value: 42n });
      expect(toValue(3.14)).toEqual({ tag: 'float', value: 3.14 });
      expect(toValue('hello')).toEqual({ tag: 'string', value: 'hello' });
      expect(toValue(null)).toEqual({ tag: 'option', value: null });
    });
    
    it('should convert arrays', () => {
      const value = toValue([1, 2, 3]);
      expect(value.tag).toBe('list');
      expect((value as { tag: 'list'; elements: Value[] }).elements).toHaveLength(3);
    });
    
    it('should convert objects', () => {
      const value = toValue({ x: 1, y: 'hello' });
      expect(value.tag).toBe('record');
      const fields = (value as { tag: 'record'; fields: Map<string, Value> }).fields;
      expect(fields.get('x')).toEqual({ tag: 'int', value: 1n });
      expect(fields.get('y')).toEqual({ tag: 'string', value: 'hello' });
    });
    
    it('should detect UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const value = toValue(uuid);
      expect(value.tag).toBe('uuid');
      expect((value as { tag: 'uuid'; value: string }).value).toBe(uuid);
    });
    
    it('should detect timestamps', () => {
      const ts = '2024-01-15T10:30:00Z';
      const value = toValue(ts);
      expect(value.tag).toBe('timestamp');
    });
    
    it('should round-trip values', () => {
      const original = { x: 42, y: 'hello', z: [1, 2, 3] };
      const value = toValue(original);
      const result = fromValue(value);
      
      expect(result).toEqual({ x: 42, y: 'hello', z: [1, 2, 3] });
    });
  });
  
  describe('createBindings', () => {
    it('should create bindings from test data', () => {
      const testData: TestData = {
        intent: 'Test',
        bindings: {
          pre: { x: 1, y: 2 },
          post: { x: 3, y: 4 },
        },
      };
      
      const bindings = createBindings(testData);
      
      expect(bindings.pre.get('x')).toEqual({ tag: 'int', value: 1n });
      expect(bindings.post.get('x')).toEqual({ tag: 'int', value: 3n });
      expect(bindings.old.get('x')).toEqual({ tag: 'int', value: 1n });
    });
  });
});

// ============================================================================
// SANDBOX TESTS
// ============================================================================

describe('Sandbox', () => {
  describe('runWithTimeout', () => {
    it('should complete fast operations', async () => {
      const result = await runWithTimeout(() => 42, 1000);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
      expect(result.timedOut).toBe(false);
    });
    
    it('should handle async operations', async () => {
      const result = await runWithTimeout(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'done';
      }, 1000);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('done');
    });
    
    it('should timeout slow operations', async () => {
      const result = await runWithTimeout(async () => {
        await new Promise((r) => setTimeout(r, 500));
        return 'done';
      }, 100);
      
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toBeInstanceOf(TimeoutError);
    });
    
    it('should catch errors', async () => {
      const result = await runWithTimeout(() => {
        throw new Error('test error');
      }, 1000);
      
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(false);
      expect(result.error?.message).toBe('test error');
    });
  });
});

// ============================================================================
// EXECUTOR TESTS
// ============================================================================

describe('Executor', () => {
  describe('cloneValue', () => {
    it('should deep clone primitives', () => {
      const original: Value = { tag: 'int', value: 42n };
      const cloned = cloneValue(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });
    
    it('should deep clone records', () => {
      const original: Value = {
        tag: 'record',
        type: 'Test',
        fields: new Map([['x', { tag: 'int', value: 1n }]]),
      };
      
      const cloned = cloneValue(original);
      
      expect(cloned).toEqual(original);
      expect((cloned as any).fields).not.toBe((original as any).fields);
    });
    
    it('should deep clone lists', () => {
      const original: Value = {
        tag: 'list',
        elements: [
          { tag: 'int', value: 1n },
          { tag: 'int', value: 2n },
        ],
      };
      
      const cloned = cloneValue(original);
      
      expect(cloned).toEqual(original);
      expect((cloned as any).elements).not.toBe((original as any).elements);
    });
  });
  
  describe('valuesEqual', () => {
    it('should compare primitives', () => {
      expect(valuesEqual(
        { tag: 'int', value: 42n },
        { tag: 'int', value: 42n }
      )).toBe(true);
      
      expect(valuesEqual(
        { tag: 'int', value: 42n },
        { tag: 'int', value: 43n }
      )).toBe(false);
      
      expect(valuesEqual(
        { tag: 'int', value: 42n },
        { tag: 'float', value: 42 }
      )).toBe(false);
    });
    
    it('should compare records', () => {
      const a: Value = {
        tag: 'record',
        type: 'Test',
        fields: new Map([['x', { tag: 'int', value: 1n }]]),
      };
      
      const b: Value = {
        tag: 'record',
        type: 'Test',
        fields: new Map([['x', { tag: 'int', value: 1n }]]),
      };
      
      const c: Value = {
        tag: 'record',
        type: 'Test',
        fields: new Map([['x', { tag: 'int', value: 2n }]]),
      };
      
      expect(valuesEqual(a, b)).toBe(true);
      expect(valuesEqual(a, c)).toBe(false);
    });
    
    it('should compare lists', () => {
      const a: Value = {
        tag: 'list',
        elements: [{ tag: 'int', value: 1n }, { tag: 'int', value: 2n }],
      };
      
      const b: Value = {
        tag: 'list',
        elements: [{ tag: 'int', value: 1n }, { tag: 'int', value: 2n }],
      };
      
      const c: Value = {
        tag: 'list',
        elements: [{ tag: 'int', value: 1n }],
      };
      
      expect(valuesEqual(a, b)).toBe(true);
      expect(valuesEqual(a, c)).toBe(false);
    });
  });
});

// ============================================================================
// REPORT TESTS
// ============================================================================

describe('Reports', () => {
  const mockReport: VerificationReport = {
    specPath: './test.isl',
    targetPath: './test.ts',
    testDataPath: './test.json',
    mode: 'static',
    behaviors: [
      {
        behavior: 'TestBehavior',
        description: 'A test behavior',
        preconditions: [
          {
            type: 'precondition',
            expression: 'x > 0',
            result: { status: 'passed', message: 'x > 0' },
            duration: 1,
          },
        ],
        postconditions: [
          {
            type: 'postcondition',
            expression: 'result == x + 1',
            result: { status: 'passed', message: 'result == x + 1' },
            duration: 2,
          },
        ],
        invariants: [],
        scenarios: [
          {
            name: 'happy path',
            given: [],
            when: [],
            then: [{ status: 'passed', message: 'assertion passed' }],
            passed: true,
            duration: 10,
          },
          {
            name: 'error case',
            given: [],
            when: [],
            then: [
              {
                status: 'failed',
                message: 'assertion failed',
                expected: 'ERROR_CODE',
                actual: 'WRONG_CODE',
              },
            ],
            passed: false,
            duration: 5,
          },
        ],
        duration: 20,
        passed: false,
      },
    ],
    summary: {
      total: 4,
      passed: 3,
      failed: 1,
      skipped: 0,
      errors: 0,
    },
    duration: 100,
    timestamp: new Date('2024-01-15T10:30:00Z'),
    warnings: [],
  };
  
  describe('generateJsonReport', () => {
    it('should produce valid JSON', () => {
      const json = generateJsonReport(mockReport);
      const parsed = JSON.parse(json);
      
      expect(parsed.specPath).toBe('./test.isl');
      expect(parsed.summary.total).toBe(4);
      expect(parsed.behaviors).toHaveLength(1);
    });
  });
  
  describe('generateTerminalReport', () => {
    it('should produce terminal output', () => {
      const output = generateTerminalReport(mockReport, false);
      
      expect(output).toContain('ISL Verification Report');
      expect(output).toContain('TestBehavior');
      expect(output).toContain('happy path');
      expect(output).toContain('error case');
    });
    
    it('should include color codes when enabled', () => {
      const output = generateTerminalReport(mockReport, true);
      
      expect(output).toContain('\x1b['); // ANSI escape codes
    });
  });
  
  describe('generateJUnitReport', () => {
    it('should produce valid JUnit XML', () => {
      const xml = generateJUnitReport(mockReport);
      
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<testsuites');
      expect(xml).toContain('<testsuite');
      expect(xml).toContain('<testcase');
      expect(xml).toContain('</testsuites>');
    });
    
    it('should include failure elements for failed tests', () => {
      const xml = generateJUnitReport(mockReport);
      
      expect(xml).toContain('<failure');
    });
  });
  
  describe('generateMarkdownReport', () => {
    it('should produce Markdown output', () => {
      const md = generateMarkdownReport(mockReport);
      
      expect(md).toContain('## ');
      expect(md).toContain('### ');
      expect(md).toContain('| Metric | Value |');
      expect(md).toContain('TestBehavior');
    });
    
    it('should include status emojis', () => {
      const md = generateMarkdownReport(mockReport);
      
      expect(md).toMatch(/[✅❌]/);
    });
  });
});

// ============================================================================
// INTERPRETER TESTS
// ============================================================================

describe('ISLInterpreter', () => {
  let interpreter: ISLInterpreter;
  
  beforeEach(() => {
    interpreter = new ISLInterpreter();
  });
  
  it('should accept options', () => {
    const customInterpreter = new ISLInterpreter({
      timeout: 10000,
      mode: 'dynamic',
    });
    
    expect(customInterpreter).toBeDefined();
  });
  
  it('should have default options', () => {
    expect(DEFAULT_OPTIONS.timeout).toBe(5000);
    expect(DEFAULT_OPTIONS.mode).toBe('static');
    expect(DEFAULT_OPTIONS.sandbox).toBe(true);
  });
});
