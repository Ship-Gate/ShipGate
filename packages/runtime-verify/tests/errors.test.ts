import { describe, it, expect, beforeEach } from 'vitest';
import {
  VerifyError,
  PreconditionError,
  PostconditionError,
  InvariantError,
  HookError,
  EvaluationError,
  ErrorCode,
  isVerifyError,
  isPreconditionError,
  isPostconditionError,
  isInvariantError,
  formatVerifyError,
} from '../src/errors';

describe('Error Types', () => {
  describe('VerifyError', () => {
    it('should create error with code and message', () => {
      const error = new VerifyError(ErrorCode.ASSERTION_ERROR, 'Test error');
      
      expect(error.code).toBe(ErrorCode.ASSERTION_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('VerifyError');
      expect(error.retriable).toBe(false);
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it('should accept context and expression', () => {
      const context = { input: { amount: 100 } };
      const error = new VerifyError(ErrorCode.ASSERTION_ERROR, 'Test', {
        context,
        expression: 'amount > 0',
      });
      
      expect(error.context).toEqual(context);
      expect(error.expression).toBe('amount > 0');
    });

    it('should serialize to JSON', () => {
      const error = new VerifyError(ErrorCode.ASSERTION_ERROR, 'Test', {
        context: { input: { x: 1 } },
        expression: 'x > 0',
      });
      
      const json = error.toJSON();
      
      expect(json.name).toBe('VerifyError');
      expect(json.code).toBe(ErrorCode.ASSERTION_ERROR);
      expect(json.message).toBe('Test');
      expect(json.context).toEqual({ input: { x: 1 } });
      expect(json.expression).toBe('x > 0');
      expect(json.timestamp).toBeGreaterThan(0);
    });

    it('should capture stack trace', () => {
      const error = new VerifyError(ErrorCode.ASSERTION_ERROR, 'Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('VerifyError');
    });
  });

  describe('PreconditionError', () => {
    it('should create with default code', () => {
      const error = new PreconditionError('Input required');
      
      expect(error.code).toBe(ErrorCode.PRECONDITION_FAILED);
      expect(error.name).toBe('PreconditionError');
      expect(error.message).toBe('Input required');
    });

    it('should accept custom code', () => {
      const error = new PreconditionError('Null value', {
        code: ErrorCode.PRECONDITION_NULL_ERROR,
      });
      
      expect(error.code).toBe(ErrorCode.PRECONDITION_NULL_ERROR);
    });

    it('should extend VerifyError', () => {
      const error = new PreconditionError('Test');
      expect(error).toBeInstanceOf(VerifyError);
    });
  });

  describe('PostconditionError', () => {
    it('should create with default code', () => {
      const error = new PostconditionError('Result invalid');
      
      expect(error.code).toBe(ErrorCode.POSTCONDITION_FAILED);
      expect(error.name).toBe('PostconditionError');
    });

    it('should accept result context', () => {
      const error = new PostconditionError('Invalid result', {
        context: { result: { id: null } },
      });
      
      expect(error.context?.result).toEqual({ id: null });
    });
  });

  describe('InvariantError', () => {
    it('should create with default code', () => {
      const error = new InvariantError('State violated');
      
      expect(error.code).toBe(ErrorCode.INVARIANT_FAILED);
      expect(error.name).toBe('InvariantError');
    });

    it('should accept state context', () => {
      const error = new InvariantError('Balance negative', {
        context: {
          oldState: { balance: 100 },
          state: { balance: -50 },
        },
      });
      
      expect(error.context?.oldState).toEqual({ balance: 100 });
      expect(error.context?.state).toEqual({ balance: -50 });
    });
  });

  describe('HookError', () => {
    it('should create with hook error code', () => {
      const error = new HookError('Hook failed');
      
      expect(error.code).toBe(ErrorCode.HOOK_ERROR);
      expect(error.name).toBe('HookError');
      expect(error.retriable).toBe(false);
    });

    it('should accept cause error', () => {
      const cause = new Error('Original error');
      const error = new HookError('Hook failed', { cause });
      
      expect(error.cause).toBe(cause);
    });
  });

  describe('EvaluationError', () => {
    it('should create with evaluation error code', () => {
      const error = new EvaluationError('Expression failed');
      
      expect(error.code).toBe(ErrorCode.EVALUATION_ERROR);
      expect(error.name).toBe('EvaluationError');
    });

    it('should store expression', () => {
      const error = new EvaluationError('Failed', {
        expression: 'a.b.c > 0',
      });
      
      expect(error.expression).toBe('a.b.c > 0');
    });
  });

  describe('Type Guards', () => {
    it('isVerifyError should identify VerifyError instances', () => {
      expect(isVerifyError(new VerifyError(ErrorCode.ASSERTION_ERROR, 'test'))).toBe(true);
      expect(isVerifyError(new PreconditionError('test'))).toBe(true);
      expect(isVerifyError(new PostconditionError('test'))).toBe(true);
      expect(isVerifyError(new InvariantError('test'))).toBe(true);
      expect(isVerifyError(new Error('test'))).toBe(false);
      expect(isVerifyError(null)).toBe(false);
      expect(isVerifyError('error')).toBe(false);
    });

    it('isPreconditionError should identify PreconditionError', () => {
      expect(isPreconditionError(new PreconditionError('test'))).toBe(true);
      expect(isPreconditionError(new PostconditionError('test'))).toBe(false);
      expect(isPreconditionError(new VerifyError(ErrorCode.ASSERTION_ERROR, 'test'))).toBe(false);
    });

    it('isPostconditionError should identify PostconditionError', () => {
      expect(isPostconditionError(new PostconditionError('test'))).toBe(true);
      expect(isPostconditionError(new PreconditionError('test'))).toBe(false);
    });

    it('isInvariantError should identify InvariantError', () => {
      expect(isInvariantError(new InvariantError('test'))).toBe(true);
      expect(isInvariantError(new PreconditionError('test'))).toBe(false);
    });
  });

  describe('formatVerifyError', () => {
    it('should format basic error', () => {
      const error = new PreconditionError('Amount must be positive');
      const formatted = formatVerifyError(error);
      
      expect(formatted).toContain('PreconditionError');
      expect(formatted).toContain(ErrorCode.PRECONDITION_FAILED);
      expect(formatted).toContain('Amount must be positive');
    });

    it('should include expression when present', () => {
      const error = new PreconditionError('Failed', {
        expression: 'amount > 0',
      });
      const formatted = formatVerifyError(error);
      
      expect(formatted).toContain('Expression: amount > 0');
    });

    it('should include context when present', () => {
      const error = new PostconditionError('Invalid result', {
        context: {
          input: { amount: 100 },
          result: { id: 'abc' },
          state: { balance: 200 },
        },
      });
      const formatted = formatVerifyError(error);
      
      expect(formatted).toContain('Input:');
      expect(formatted).toContain('Result:');
      expect(formatted).toContain('State:');
    });
  });

  describe('ErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCode.PRECONDITION_FAILED).toBe('PRECONDITION_FAILED');
      expect(ErrorCode.PRECONDITION_TYPE_ERROR).toBe('PRECONDITION_TYPE_ERROR');
      expect(ErrorCode.PRECONDITION_RANGE_ERROR).toBe('PRECONDITION_RANGE_ERROR');
      expect(ErrorCode.PRECONDITION_NULL_ERROR).toBe('PRECONDITION_NULL_ERROR');
      expect(ErrorCode.POSTCONDITION_FAILED).toBe('POSTCONDITION_FAILED');
      expect(ErrorCode.POSTCONDITION_TYPE_ERROR).toBe('POSTCONDITION_TYPE_ERROR');
      expect(ErrorCode.POSTCONDITION_RESULT_ERROR).toBe('POSTCONDITION_RESULT_ERROR');
      expect(ErrorCode.INVARIANT_FAILED).toBe('INVARIANT_FAILED');
      expect(ErrorCode.INVARIANT_STATE_ERROR).toBe('INVARIANT_STATE_ERROR');
      expect(ErrorCode.INVARIANT_CONSISTENCY_ERROR).toBe('INVARIANT_CONSISTENCY_ERROR');
      expect(ErrorCode.ASSERTION_ERROR).toBe('ASSERTION_ERROR');
      expect(ErrorCode.EVALUATION_ERROR).toBe('EVALUATION_ERROR');
      expect(ErrorCode.HOOK_ERROR).toBe('HOOK_ERROR');
    });
  });
});
