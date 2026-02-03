/**
 * Golden Fixture Tests
 * 
 * Tests that verify TypeScript and Python codegen produce semantically
 * equivalent results from the same ISL specification.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { generate, CodeGenerator } from '../src/generator.js';
import { compilePythonExpression, createPythonCompilerContext } from '../src/python-expression-compiler.js';
import { compileExpression, createCompilerContext } from '../../codegen-tests/src/expression-compiler.js';

// Get directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock domain for testing (matches golden-spec.isl structure)
const mockDomain = {
  kind: 'DomainDeclaration' as const,
  name: { kind: 'Identifier' as const, name: 'GoldenTest', span: { start: 0, end: 10, line: 1, column: 1 } },
  version: { kind: 'StringLiteral' as const, value: '1.0.0', span: { start: 0, end: 7, line: 1, column: 1 } },
  uses: [],
  imports: [],
  entities: [
    {
      kind: 'EntityDeclaration' as const,
      name: { kind: 'Identifier' as const, name: 'Account', span: { start: 0, end: 7, line: 1, column: 1 } },
      fields: [
        {
          kind: 'FieldDeclaration' as const,
          name: { kind: 'Identifier' as const, name: 'id', span: { start: 0, end: 2, line: 1, column: 1 } },
          type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'UUID', span: { start: 0, end: 4, line: 1, column: 1 } }, span: { start: 0, end: 4, line: 1, column: 1 } },
          optional: false,
          annotations: [],
          constraints: [],
          span: { start: 0, end: 10, line: 1, column: 1 },
        },
        {
          kind: 'FieldDeclaration' as const,
          name: { kind: 'Identifier' as const, name: 'balance', span: { start: 0, end: 7, line: 1, column: 1 } },
          type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'Decimal', span: { start: 0, end: 7, line: 1, column: 1 } }, span: { start: 0, end: 7, line: 1, column: 1 } },
          optional: false,
          annotations: [],
          constraints: [],
          span: { start: 0, end: 10, line: 1, column: 1 },
        },
        {
          kind: 'FieldDeclaration' as const,
          name: { kind: 'Identifier' as const, name: 'isActive', span: { start: 0, end: 8, line: 1, column: 1 } },
          type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'Boolean', span: { start: 0, end: 7, line: 1, column: 1 } }, span: { start: 0, end: 7, line: 1, column: 1 } },
          optional: false,
          annotations: [],
          constraints: [],
          span: { start: 0, end: 10, line: 1, column: 1 },
        },
      ],
      span: { start: 0, end: 100, line: 1, column: 1 },
    },
    {
      kind: 'EntityDeclaration' as const,
      name: { kind: 'Identifier' as const, name: 'User', span: { start: 0, end: 4, line: 1, column: 1 } },
      fields: [
        {
          kind: 'FieldDeclaration' as const,
          name: { kind: 'Identifier' as const, name: 'id', span: { start: 0, end: 2, line: 1, column: 1 } },
          type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'UUID', span: { start: 0, end: 4, line: 1, column: 1 } }, span: { start: 0, end: 4, line: 1, column: 1 } },
          optional: false,
          annotations: [],
          constraints: [],
          span: { start: 0, end: 10, line: 1, column: 1 },
        },
        {
          kind: 'FieldDeclaration' as const,
          name: { kind: 'Identifier' as const, name: 'email', span: { start: 0, end: 5, line: 1, column: 1 } },
          type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'String', span: { start: 0, end: 6, line: 1, column: 1 } }, span: { start: 0, end: 6, line: 1, column: 1 } },
          optional: false,
          annotations: [],
          constraints: [],
          span: { start: 0, end: 10, line: 1, column: 1 },
        },
      ],
      span: { start: 0, end: 100, line: 1, column: 1 },
    },
  ],
  types: [],
  enums: [
    {
      kind: 'EnumDeclaration' as const,
      name: { kind: 'Identifier' as const, name: 'TransactionType', span: { start: 0, end: 15, line: 1, column: 1 } },
      variants: [
        { kind: 'Identifier' as const, name: 'CREDIT', span: { start: 0, end: 6, line: 1, column: 1 } },
        { kind: 'Identifier' as const, name: 'DEBIT', span: { start: 0, end: 5, line: 1, column: 1 } },
        { kind: 'Identifier' as const, name: 'TRANSFER', span: { start: 0, end: 8, line: 1, column: 1 } },
      ],
      span: { start: 0, end: 100, line: 1, column: 1 },
    },
  ],
  behaviors: [
    {
      kind: 'BehaviorDeclaration' as const,
      name: { kind: 'Identifier' as const, name: 'TransferFunds', span: { start: 0, end: 13, line: 1, column: 1 } },
      description: { kind: 'StringLiteral' as const, value: 'Transfer funds between accounts', span: { start: 0, end: 30, line: 1, column: 1 } },
      input: {
        kind: 'InputBlock' as const,
        fields: [
          {
            kind: 'FieldDeclaration' as const,
            name: { kind: 'Identifier' as const, name: 'senderId', span: { start: 0, end: 8, line: 1, column: 1 } },
            type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'UUID', span: { start: 0, end: 4, line: 1, column: 1 } }, span: { start: 0, end: 4, line: 1, column: 1 } },
            optional: false,
            annotations: [],
            constraints: [],
            span: { start: 0, end: 10, line: 1, column: 1 },
          },
          {
            kind: 'FieldDeclaration' as const,
            name: { kind: 'Identifier' as const, name: 'receiverId', span: { start: 0, end: 10, line: 1, column: 1 } },
            type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'UUID', span: { start: 0, end: 4, line: 1, column: 1 } }, span: { start: 0, end: 4, line: 1, column: 1 } },
            optional: false,
            annotations: [],
            constraints: [],
            span: { start: 0, end: 10, line: 1, column: 1 },
          },
          {
            kind: 'FieldDeclaration' as const,
            name: { kind: 'Identifier' as const, name: 'amount', span: { start: 0, end: 6, line: 1, column: 1 } },
            type: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'Decimal', span: { start: 0, end: 7, line: 1, column: 1 } }, span: { start: 0, end: 7, line: 1, column: 1 } },
            optional: false,
            annotations: [],
            constraints: [],
            span: { start: 0, end: 10, line: 1, column: 1 },
          },
        ],
        span: { start: 0, end: 100, line: 1, column: 1 },
      },
      output: {
        kind: 'OutputBlock' as const,
        success: { kind: 'SimpleType' as const, name: { kind: 'Identifier' as const, name: 'Account', span: { start: 0, end: 7, line: 1, column: 1 } }, span: { start: 0, end: 7, line: 1, column: 1 } },
        errors: [
          {
            kind: 'ErrorDeclaration' as const,
            name: { kind: 'Identifier' as const, name: 'INSUFFICIENT_FUNDS', span: { start: 0, end: 18, line: 1, column: 1 } },
            when: { kind: 'StringLiteral' as const, value: 'sender has insufficient balance', span: { start: 0, end: 30, line: 1, column: 1 } },
            span: { start: 0, end: 50, line: 1, column: 1 },
          },
          {
            kind: 'ErrorDeclaration' as const,
            name: { kind: 'Identifier' as const, name: 'ACCOUNT_NOT_FOUND', span: { start: 0, end: 17, line: 1, column: 1 } },
            when: { kind: 'StringLiteral' as const, value: 'sender or receiver account not found', span: { start: 0, end: 35, line: 1, column: 1 } },
            span: { start: 0, end: 55, line: 1, column: 1 },
          },
        ],
        span: { start: 0, end: 200, line: 1, column: 1 },
      },
      preconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'ComparisonExpression' as const,
                  operator: '>',
                  left: { kind: 'Identifier' as const, name: 'amount', span: { start: 0, end: 6, line: 1, column: 1 } },
                  right: { kind: 'NumberLiteral' as const, value: 0, span: { start: 0, end: 1, line: 1, column: 1 } },
                  span: { start: 0, end: 10, line: 1, column: 1 },
                },
                description: { kind: 'StringLiteral' as const, value: 'Amount must be positive', span: { start: 0, end: 25, line: 1, column: 1 } },
                span: { start: 0, end: 40, line: 1, column: 1 },
              },
            ],
            span: { start: 0, end: 50, line: 1, column: 1 },
          },
        ],
        span: { start: 0, end: 100, line: 1, column: 1 },
      },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success' as const,
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'ComparisonExpression' as const,
                  operator: '>=',
                  left: { kind: 'MemberExpression' as const, object: { kind: 'Identifier' as const, name: 'result', span: { start: 0, end: 6, line: 1, column: 1 } }, property: { kind: 'Identifier' as const, name: 'balance', span: { start: 0, end: 7, line: 1, column: 1 } }, span: { start: 0, end: 14, line: 1, column: 1 } },
                  right: { kind: 'NumberLiteral' as const, value: 0, span: { start: 0, end: 1, line: 1, column: 1 } },
                  span: { start: 0, end: 20, line: 1, column: 1 },
                },
                description: { kind: 'StringLiteral' as const, value: 'Resulting balance must be non-negative', span: { start: 0, end: 40, line: 1, column: 1 } },
                span: { start: 0, end: 50, line: 1, column: 1 },
              },
            ],
            span: { start: 0, end: 100, line: 1, column: 1 },
          },
        ],
        span: { start: 0, end: 200, line: 1, column: 1 },
      },
      span: { start: 0, end: 500, line: 1, column: 1 },
    },
  ],
  invariants: [],
  span: { start: 0, end: 1000, line: 1, column: 1 },
};

describe('Golden Fixture Tests', () => {
  describe('Code Generation', () => {
    it('should generate TypeScript types successfully', () => {
      const result = generate(mockDomain as any, {
        language: 'typescript',
        validation: true,
        contracts: false,
      });

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      
      const typesFile = result.files.find(f => f.path.endsWith('types.ts'));
      expect(typesFile).toBeDefined();
      expect(typesFile?.content).toContain('Account');
      expect(typesFile?.content).toContain('TransferFunds');
    });

    it('should generate Python types successfully', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: true,
        contracts: true,
      });

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      
      const typesFile = result.files.find(f => f.path.endsWith('types.py'));
      expect(typesFile).toBeDefined();
      expect(typesFile?.content).toContain('Account');
      expect(typesFile?.content).toContain('TransferFunds');
    });

    it('should generate Python contracts successfully', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: true,
        contracts: true,
      });

      const contractsFile = result.files.find(f => f.path.endsWith('contracts.py'));
      expect(contractsFile).toBeDefined();
      expect(contractsFile?.content).toContain('PreconditionError');
      expect(contractsFile?.content).toContain('PostconditionError');
      expect(contractsFile?.content).toContain('transfer_funds_contract');
    });
  });

  describe('Expression Compilation Consistency', () => {
    const testExpressions = [
      // Simple comparisons
      {
        expr: { kind: 'ComparisonExpression' as const, operator: '>', left: { kind: 'Identifier' as const, name: 'amount', span: { start: 0, end: 6, line: 1, column: 1 } }, right: { kind: 'NumberLiteral' as const, value: 0, span: { start: 0, end: 1, line: 1, column: 1 } }, span: { start: 0, end: 10, line: 1, column: 1 } },
        name: 'amount > 0',
      },
      // Boolean literals
      {
        expr: { kind: 'BooleanLiteral' as const, value: true, span: { start: 0, end: 4, line: 1, column: 1 } },
        name: 'true',
      },
      // Null literal
      {
        expr: { kind: 'NullLiteral' as const, span: { start: 0, end: 4, line: 1, column: 1 } },
        name: 'null',
      },
      // String literal
      {
        expr: { kind: 'StringLiteral' as const, value: 'test', span: { start: 0, end: 6, line: 1, column: 1 } },
        name: '"test"',
      },
    ];

    for (const { expr, name } of testExpressions) {
      it(`should compile "${name}" consistently across languages`, () => {
        const pyCtx = createPythonCompilerContext(['Account', 'User']);
        const tsCtx = createCompilerContext(['Account', 'User']);

        const pyResult = compilePythonExpression(expr as any, pyCtx);
        const tsResult = compileExpression(expr as any, tsCtx);

        // Both should produce valid, non-empty output
        expect(pyResult).toBeTruthy();
        expect(tsResult).toBeTruthy();

        // Verify language-specific patterns
        if (expr.kind === 'BooleanLiteral') {
          if (expr.value) {
            expect(pyResult).toBe('True');
            expect(tsResult).toBe('true');
          } else {
            expect(pyResult).toBe('False');
            expect(tsResult).toBe('false');
          }
        }

        if (expr.kind === 'NullLiteral') {
          expect(pyResult).toBe('None');
          expect(tsResult).toBe('null');
        }
      });
    }
  });

  describe('Type Mapping Consistency', () => {
    it('should map ISL types to correct Python types', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: false,
        contracts: false,
      });

      const typesFile = result.files.find(f => f.path.endsWith('types.py'));
      expect(typesFile?.content).toContain('UUID');
      expect(typesFile?.content).toContain('Decimal');
      expect(typesFile?.content).toContain('bool');
    });

    it('should map ISL types to correct TypeScript types', () => {
      const result = generate(mockDomain as any, {
        language: 'typescript',
        validation: false,
        contracts: false,
      });

      const typesFile = result.files.find(f => f.path.endsWith('types.ts'));
      expect(typesFile?.content).toContain('string'); // UUID maps to string
      expect(typesFile?.content).toContain('Decimal');
      expect(typesFile?.content).toContain('boolean');
    });
  });

  describe('Contract Generation', () => {
    it('should generate precondition checks in Python', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: true,
        contracts: true,
      });

      const contractsFile = result.files.find(f => f.path.endsWith('contracts.py'));
      expect(contractsFile?.content).toContain('_check_transfer_funds_preconditions');
      expect(contractsFile?.content).toContain('PreconditionError');
    });

    it('should generate postcondition checks in Python', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: true,
        contracts: true,
      });

      const contractsFile = result.files.find(f => f.path.endsWith('contracts.py'));
      expect(contractsFile?.content).toContain('_check_transfer_funds_postconditions');
      expect(contractsFile?.content).toContain('PostconditionError');
    });

    it('should generate contract decorator in Python', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: true,
        contracts: true,
      });

      const contractsFile = result.files.find(f => f.path.endsWith('contracts.py'));
      expect(contractsFile?.content).toContain('def transfer_funds_contract');
      expect(contractsFile?.content).toContain('@functools.wraps');
    });
  });

  describe('File Structure', () => {
    it('should generate correct Python package structure', () => {
      const result = generate(mockDomain as any, {
        language: 'python',
        validation: true,
        contracts: true,
        serdes: true,
      });

      const paths = result.files.map(f => f.path);
      expect(paths).toContain('golden_test/__init__.py');
      expect(paths).toContain('golden_test/types.py');
      expect(paths).toContain('golden_test/validation.py');
      expect(paths).toContain('golden_test/contracts.py');
      expect(paths).toContain('golden_test/serdes.py');
    });

    it('should generate correct TypeScript package structure', () => {
      const result = generate(mockDomain as any, {
        language: 'typescript',
        validation: true,
        serdes: true,
      });

      const paths = result.files.map(f => f.path);
      expect(paths).toContain('goldentest/index.ts');
      expect(paths).toContain('goldentest/types.ts');
      expect(paths).toContain('goldentest/validation.ts');
      expect(paths).toContain('goldentest/serdes.ts');
    });
  });
});

describe('Python Runtime Library', () => {
  it('should include contract exception types', async () => {
    const runtimePath = path.join(__dirname, '../templates/python/isl_runtime.py');
    const content = fs.readFileSync(runtimePath, 'utf-8');

    expect(content).toContain('class ContractError');
    expect(content).toContain('class PreconditionError');
    expect(content).toContain('class PostconditionError');
    expect(content).toContain('class InvariantError');
  });

  it('should include entity store abstraction', async () => {
    const runtimePath = path.join(__dirname, '../templates/python/isl_runtime.py');
    const content = fs.readFileSync(runtimePath, 'utf-8');

    expect(content).toContain('class EntityStore');
    expect(content).toContain('class InMemoryEntityStore');
    expect(content).toContain('def exists');
    expect(content).toContain('def lookup');
  });

  it('should include contract decorators', async () => {
    const runtimePath = path.join(__dirname, '../templates/python/isl_runtime.py');
    const content = fs.readFileSync(runtimePath, 'utf-8');

    expect(content).toContain('def preconditions');
    expect(content).toContain('def postconditions');
    expect(content).toContain('def invariants');
    expect(content).toContain('def contract');
  });

  it('should include old state management', async () => {
    const runtimePath = path.join(__dirname, '../templates/python/isl_runtime.py');
    const content = fs.readFileSync(runtimePath, 'utf-8');

    expect(content).toContain('class OldState');
    expect(content).toContain('def capture_old_state');
  });
});
