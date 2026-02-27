import { describe, it, expect } from 'vitest';
import {
  createEvaluatorAdapter,
  createCompilerAdapter,
  createTypeCheckAdapter,
  defaultEvaluatorAdapter,
  defaultCompilerAdapter,
  defaultTypeCheckAdapter,
} from '../src/adapter.js';

describe('Adapters', () => {
  describe('EvaluatorAdapter', () => {
    it('should create adapter with default version', () => {
      const adapter = createEvaluatorAdapter();
      expect(adapter.version).toBe('1.0.0');
    });

    it('should create adapter with specified version', () => {
      const adapter = createEvaluatorAdapter({ version: '1.0.0' });
      expect(adapter.version).toBe('1.0.0');
    });

    it('should throw for unsupported version', () => {
      expect(() => createEvaluatorAdapter({ version: '99.0.0' })).toThrow();
    });

    describe('evaluateBinary', () => {
      const adapter = createEvaluatorAdapter();

      it('should evaluate equality', () => {
        expect(adapter.evaluateBinary('==', 1, 1)).toBe(true);
        expect(adapter.evaluateBinary('==', 1, 2)).toBe(false);
      });

      it('should evaluate arithmetic', () => {
        expect(adapter.evaluateBinary('+', 1, 2)).toBe(3);
        expect(adapter.evaluateBinary('*', 3, 4)).toBe(12);
      });

      it('should evaluate logical operators', () => {
        expect(adapter.evaluateBinary('and', true, true)).toBe(true);
        expect(adapter.evaluateBinary('or', false, true)).toBe(true);
        expect(adapter.evaluateBinary('implies', false, false)).toBe(true);
      });

      it('should throw on unknown operator in strict mode', () => {
        expect(() => adapter.evaluateBinary('unknown' as any, 1, 2)).toThrow();
      });

      it('should return undefined on unknown operator in non-strict mode', () => {
        const nonStrict = createEvaluatorAdapter({ strict: false });
        expect(nonStrict.evaluateBinary('unknown' as any, 1, 2)).toBeUndefined();
      });
    });

    describe('evaluateUnary', () => {
      const adapter = createEvaluatorAdapter();

      it('should evaluate not', () => {
        expect(adapter.evaluateUnary('not', true)).toBe(false);
        expect(adapter.evaluateUnary('not', false)).toBe(true);
      });

      it('should evaluate unary minus', () => {
        expect(adapter.evaluateUnary('-', 5)).toBe(-5);
      });
    });

    describe('evaluateQuantifier', () => {
      const adapter = createEvaluatorAdapter();

      it('should evaluate all', () => {
        expect(adapter.evaluateQuantifier('all', [1, 2, 3], (x) => (x as number) > 0)).toBe(true);
        expect(adapter.evaluateQuantifier('all', [1, -2, 3], (x) => (x as number) > 0)).toBe(false);
      });

      it('should evaluate any', () => {
        expect(adapter.evaluateQuantifier('any', [1, 2, 3], (x) => (x as number) > 2)).toBe(true);
        expect(adapter.evaluateQuantifier('any', [1, 2, 3], (x) => (x as number) > 10)).toBe(false);
      });

      it('should evaluate count', () => {
        expect(adapter.evaluateQuantifier('count', [1, 2, 3, 4, 5], (x) => (x as number) > 2)).toBe(3);
      });
    });

    describe('utility methods', () => {
      const adapter = createEvaluatorAdapter();

      it('isShortCircuit should return correct values', () => {
        expect(adapter.isShortCircuit('and')).toBe(true);
        expect(adapter.isShortCircuit('or')).toBe(true);
        expect(adapter.isShortCircuit('+')).toBe(false);
      });

      it('getPrecedence should return valid values', () => {
        expect(adapter.getPrecedence('*')).toBeGreaterThan(adapter.getPrecedence('+'));
        expect(adapter.getPrecedence('+')).toBeGreaterThan(adapter.getPrecedence('and'));
      });

      it('getSemantics should return full semantics object', () => {
        const semantics = adapter.getSemantics();
        expect(semantics.binaryOperators).toBeDefined();
        expect(semantics.unaryOperators).toBeDefined();
        expect(semantics.quantifiers).toBeDefined();
      });
    });
  });

  describe('CompilerAdapter', () => {
    const adapter = createCompilerAdapter();

    it('should create adapter with default version', () => {
      expect(adapter.version).toBe('1.0.0');
    });

    describe('getBinaryOperatorInfo', () => {
      it('should return operator info', () => {
        const info = adapter.getBinaryOperatorInfo('+');
        expect(info).toBeDefined();
        expect(info!.operator).toBe('+');
        expect(info!.precedence).toBeGreaterThan(0);
      });

      it('should return undefined for unknown operator', () => {
        expect(adapter.getBinaryOperatorInfo('unknown' as any)).toBeUndefined();
      });
    });

    describe('getUnaryOperatorInfo', () => {
      it('should return operator info', () => {
        const info = adapter.getUnaryOperatorInfo('not');
        expect(info).toBeDefined();
        expect(info!.resultType).toBe('boolean');
      });
    });

    describe('getQuantifierInfo', () => {
      it('should return quantifier info', () => {
        const info = adapter.getQuantifierInfo('all');
        expect(info).toBeDefined();
        expect(info!.resultType).toBe('boolean');
      });
    });

    describe('getTemporalOperatorInfo', () => {
      it('should return temporal operator info', () => {
        const info = adapter.getTemporalOperatorInfo('eventually');
        expect(info).toBeDefined();
        expect(info!.requiresDuration).toBe(true);
      });
    });

    describe('getAllX methods', () => {
      it('should return all binary operators', () => {
        const ops = adapter.getAllBinaryOperators();
        expect(ops).toContain('==');
        expect(ops).toContain('+');
        expect(ops).toContain('and');
      });

      it('should return all unary operators', () => {
        const ops = adapter.getAllUnaryOperators();
        expect(ops).toContain('not');
        expect(ops).toContain('-');
      });

      it('should return all quantifiers', () => {
        const qs = adapter.getAllQuantifiers();
        expect(qs).toContain('all');
        expect(qs).toContain('any');
        expect(qs).toContain('count');
      });

      it('should return all temporal operators', () => {
        const ops = adapter.getAllTemporalOperators();
        expect(ops).toContain('eventually');
        expect(ops).toContain('always');
      });
    });
  });

  describe('TypeCheckAdapter', () => {
    const adapter = createTypeCheckAdapter();

    describe('checkBinaryOperandTypes', () => {
      it('should validate numeric operators', () => {
        const result = adapter.checkBinaryOperandTypes('+', 'number', 'number');
        expect(result.valid).toBe(true);
      });

      it('should allow string concatenation', () => {
        const result = adapter.checkBinaryOperandTypes('+', 'string', 'string');
        expect(result.valid).toBe(true);
      });
    });

    describe('checkUnaryOperandType', () => {
      it('should validate not operator', () => {
        const result = adapter.checkUnaryOperandType('not', 'boolean');
        expect(result.valid).toBe(true);
      });

      it('should validate unary minus', () => {
        const result = adapter.checkUnaryOperandType('-', 'number');
        expect(result.valid).toBe(true);
      });
    });

    describe('getXResultType', () => {
      it('should return binary result types', () => {
        expect(adapter.getBinaryResultType('==')).toBe('boolean');
        expect(adapter.getBinaryResultType('+')).toBe('any');
      });

      it('should return unary result types', () => {
        expect(adapter.getUnaryResultType('not')).toBe('boolean');
        expect(adapter.getUnaryResultType('-')).toBe('number');
      });

      it('should return quantifier result types', () => {
        expect(adapter.getQuantifierResultType('all')).toBe('boolean');
        expect(adapter.getQuantifierResultType('count')).toBe('number');
        expect(adapter.getQuantifierResultType('filter')).toBe('array');
      });
    });
  });

  describe('Default adapters', () => {
    it('should provide working default evaluator adapter', () => {
      expect(defaultEvaluatorAdapter.evaluateBinary('==', 1, 1)).toBe(true);
    });

    it('should provide working default compiler adapter', () => {
      expect(defaultCompilerAdapter.getAllBinaryOperators().length).toBeGreaterThan(0);
    });

    it('should provide working default type check adapter', () => {
      expect(defaultTypeCheckAdapter.getBinaryResultType('==')).toBe('boolean');
    });
  });
});
