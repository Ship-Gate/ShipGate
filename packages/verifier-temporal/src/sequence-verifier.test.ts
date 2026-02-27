/**
 * Tests for Sequence-Based Temporal Verifier
 * 
 * @module @isl-lang/verifier-temporal/sequence-verifier.test
 */

import { describe, it, expect } from 'vitest';
import {
  verifySequenceRule,
  verifySequenceRules,
  type BeforeRule,
  type CooldownRule,
  type RetryRule,
  type TimeWindowRule,
} from './sequence-verifier.js';
import {
  createLoginTrace,
  createLoginTraceViolation,
  createRateLimitTrace,
  createRateLimitTraceRespected,
  createRetryTrace,
  createRetryTraceViolation,
  createTimeWindowTrace,
  createTimeWindowTraceViolation,
} from './test-traces.js';

describe('Sequence Verifier', () => {
  describe('Before Rule', () => {
    it('should verify that authenticate happens before authorize', () => {
      const rule: BeforeRule = {
        type: 'before',
        id: 'auth-before-authz',
        description: 'Authenticate must happen before authorize',
        firstEvent: { kind: 'handler_call', handler: 'authenticate' },
        secondEvent: { kind: 'handler_call', handler: 'authorize' },
      };
      
      const trace = createLoginTrace();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });
    
    it('should detect violation when authorize happens before authenticate', () => {
      const rule: BeforeRule = {
        type: 'before',
        id: 'auth-before-authz',
        description: 'Authenticate must happen before authorize',
        firstEvent: { kind: 'handler_call', handler: 'authenticate' },
        secondEvent: { kind: 'handler_call', handler: 'authorize' },
      };
      
      const trace = createLoginTraceViolation();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe('before_violation');
    });
  });
  
  describe('Cooldown Rule', () => {
    it('should detect cooldown violation when requests are too frequent', () => {
      const rule: CooldownRule = {
        type: 'cooldown',
        id: 'api-cooldown',
        description: 'API requests must have 1s cooldown',
        event: { kind: 'handler_call', handler: 'api_request' },
        duration: { value: 1, unit: 's' },
      };
      
      const trace = createRateLimitTrace();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violation?.type).toBe('cooldown_violation');
    });
    
    it('should verify cooldown when requests are spaced correctly', () => {
      const rule: CooldownRule = {
        type: 'cooldown',
        id: 'api-cooldown',
        description: 'API requests must have 1s cooldown',
        event: { kind: 'handler_call', handler: 'api_request' },
        duration: { value: 1, unit: 's' },
      };
      
      const trace = createRateLimitTraceRespected();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });
  });
  
  describe('Retry Rule', () => {
    it('should verify retry when failure is followed by success', () => {
      const rule: RetryRule = {
        type: 'retry',
        id: 'payment-retry',
        description: 'Payment must retry within 500ms after failure',
        event: { kind: 'handler_call', handler: 'process_payment' },
        retryWindow: { value: 500, unit: 'ms' },
      };
      
      const trace = createRetryTrace();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });
    
    it('should detect retry violation when no retry occurs', () => {
      const rule: RetryRule = {
        type: 'retry',
        id: 'payment-retry',
        description: 'Payment must retry within 500ms after failure',
        event: { kind: 'handler_call', handler: 'process_payment' },
        retryWindow: { value: 500, unit: 'ms' },
      };
      
      const trace = createRetryTraceViolation();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violation?.type).toBe('retry_violation');
    });
  });
  
  describe('Time Window Rule', () => {
    it('should verify event occurs within time window', () => {
      const rule: TimeWindowRule = {
        type: 'time_window',
        id: 'scheduled-task-window',
        description: 'Scheduled task must run within first second',
        event: { kind: 'handler_call', handler: 'scheduled_task' },
        windowStart: { value: 0, unit: 'ms' },
        windowEnd: { value: 1, unit: 's' },
      };
      
      const trace = createTimeWindowTrace();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });
    
    it('should detect violation when event occurs outside window', () => {
      const rule: TimeWindowRule = {
        type: 'time_window',
        id: 'scheduled-task-window',
        description: 'Scheduled task must run within first second',
        event: { kind: 'handler_call', handler: 'scheduled_task' },
        windowStart: { value: 0, unit: 'ms' },
        windowEnd: { value: 1, unit: 's' },
      };
      
      const trace = createTimeWindowTraceViolation();
      const result = verifySequenceRule(rule, trace);
      
      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violation?.type).toBe('time_window_violation');
    });
  });
  
  describe('Multiple Rules', () => {
    it('should verify multiple rules against traces', () => {
      const rules = [
        {
          type: 'before' as const,
          id: 'auth-before-authz',
          description: 'Authenticate before authorize',
          firstEvent: { kind: 'handler_call' as const, handler: 'authenticate' },
          secondEvent: { kind: 'handler_call' as const, handler: 'authorize' },
        },
        {
          type: 'cooldown' as const,
          id: 'api-cooldown',
          description: 'API cooldown',
          event: { kind: 'handler_call' as const, handler: 'api_request' },
          duration: { value: 1, unit: 's' as const },
        },
      ];
      
      const traces = [
        createLoginTrace(),
        createRateLimitTraceRespected(),
      ];
      
      const results = verifySequenceRules(rules, traces);
      
      expect(results).toHaveLength(2);
      expect(results[0]?.satisfied).toBe(true);
      expect(results[1]?.satisfied).toBe(true);
    });
  });
});
