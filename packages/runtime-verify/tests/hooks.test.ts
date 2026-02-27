import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerHook,
  unregisterHook,
  hasHooks,
  getHookNames,
  emitEvent,
  enableBuffering,
  disableBuffering,
  flushEvents,
  getBufferedEvents,
  clearBuffer,
  clearHooks,
  resetHooks,
  createConsoleHook,
  createJsonHook,
  createMetricsHook,
  createFilterHook,
} from '../src/hooks';
import type { VerificationEvent, VerificationEventType } from '../src/types';
import { HookError } from '../src/errors';

describe('Event Hooks', () => {
  beforeEach(() => {
    resetHooks();
  });

  describe('registerHook', () => {
    it('should register a hook', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      expect(hasHooks()).toBe(true);
      expect(getHookNames()).toContain('test');
    });

    it('should return unregister function', () => {
      const handler = vi.fn();
      const unregister = registerHook('test', handler);
      
      expect(hasHooks()).toBe(true);
      
      unregister();
      
      expect(hasHooks()).toBe(false);
    });

    it('should throw when registering duplicate hook name', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      expect(() => registerHook('test', handler)).toThrow(HookError);
    });
  });

  describe('unregisterHook', () => {
    it('should unregister existing hook', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      const result = unregisterHook('test');
      
      expect(result).toBe(true);
      expect(hasHooks()).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      const result = unregisterHook('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('emitEvent', () => {
    it('should call registered hooks with event', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      const event: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test_check',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event);
      
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should call multiple hooks', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      registerHook('test1', handler1);
      registerHook('test2', handler2);
      
      const event: VerificationEvent = {
        type: 'precondition:pass',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should throw HookError when handler throws', () => {
      const handler = vi.fn(() => {
        throw new Error('Handler error');
      });
      registerHook('test', handler);
      
      const event: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      expect(() => emitEvent(event)).toThrow(HookError);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by type', () => {
      const handler = vi.fn();
      registerHook('test', handler, { filter: ['precondition:fail'] });
      
      const passEvent: VerificationEvent = {
        type: 'precondition:pass',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      const failEvent: VerificationEvent = {
        type: 'precondition:fail',
        timestamp: Date.now(),
        eventId: 'evt_2',
        label: 'test',
        expression: 'y > 0',
        passed: false,
        context: {},
      };
      
      emitEvent(passEvent);
      expect(handler).not.toHaveBeenCalled();
      
      emitEvent(failEvent);
      expect(handler).toHaveBeenCalledWith(failEvent);
    });

    it('should filter to failures only', () => {
      const handler = vi.fn();
      registerHook('test', handler, { failuresOnly: true });
      
      const passEvent: VerificationEvent = {
        type: 'precondition:pass',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      const failEvent: VerificationEvent = {
        type: 'precondition:fail',
        timestamp: Date.now(),
        eventId: 'evt_2',
        label: 'test',
        expression: 'y > 0',
        passed: false,
        context: {},
      };
      
      emitEvent(passEvent);
      expect(handler).not.toHaveBeenCalled();
      
      emitEvent(failEvent);
      expect(handler).toHaveBeenCalledWith(failEvent);
    });
  });

  describe('Event Buffering', () => {
    it('should buffer events when enabled', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      enableBuffering();
      
      const event: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event);
      
      // Handler not called while buffering
      expect(handler).not.toHaveBeenCalled();
      
      // Events are buffered
      const buffered = getBufferedEvents();
      expect(buffered).toHaveLength(1);
      expect(buffered[0]).toEqual(event);
    });

    it('should flush events to handlers', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      enableBuffering();
      
      const event1: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      const event2: VerificationEvent = {
        type: 'postcondition:check',
        timestamp: Date.now(),
        eventId: 'evt_2',
        label: 'test2',
        expression: 'y > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event1);
      emitEvent(event2);
      
      flushEvents();
      
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).toHaveBeenCalledWith(event2);
      
      // Buffer is cleared after flush
      expect(getBufferedEvents()).toHaveLength(0);
    });

    it('should clear buffer without dispatching', () => {
      enableBuffering();
      
      const event: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event);
      expect(getBufferedEvents()).toHaveLength(1);
      
      clearBuffer();
      expect(getBufferedEvents()).toHaveLength(0);
    });

    it('should disable buffering and flush', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      enableBuffering();
      
      const event: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event);
      
      disableBuffering();
      
      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('Built-in Hook Factories', () => {
    describe('createConsoleHook', () => {
      it('should create a hook handler', () => {
        const handler = createConsoleHook();
        expect(typeof handler).toBe('function');
      });

      it('should accept options', () => {
        const handler = createConsoleHook({ verbose: true, prefix: '[test]' });
        expect(typeof handler).toBe('function');
      });
    });

    describe('createJsonHook', () => {
      it('should create a hook that outputs JSON', () => {
        const lines: string[] = [];
        const handler = createJsonHook((json) => lines.push(json));
        
        const event: VerificationEvent = {
          type: 'precondition:pass',
          timestamp: Date.now(),
          eventId: 'evt_1',
          label: 'test',
          expression: 'x > 0',
          passed: true,
          context: {},
        };
        
        handler(event);
        
        expect(lines).toHaveLength(1);
        const parsed = JSON.parse(lines[0]!);
        expect(parsed.type).toBe('precondition:pass');
        expect(parsed.label).toBe('test');
      });
    });

    describe('createMetricsHook', () => {
      it('should collect metrics from events', () => {
        const { handler, getMetrics, reset } = createMetricsHook();
        
        const passEvent: VerificationEvent = {
          type: 'precondition:pass',
          timestamp: Date.now(),
          eventId: 'evt_1',
          label: 'test',
          expression: 'x > 0',
          passed: true,
          context: {},
          duration: 5,
        };
        
        const failEvent: VerificationEvent = {
          type: 'postcondition:fail',
          timestamp: Date.now(),
          eventId: 'evt_2',
          label: 'test2',
          expression: 'y > 0',
          passed: false,
          context: {},
          duration: 10,
        };
        
        handler(passEvent);
        handler(failEvent);
        
        const metrics = getMetrics();
        
        expect(metrics.total).toBe(2);
        expect(metrics.passed).toBe(1);
        expect(metrics.failed).toBe(1);
        expect(metrics.byType.precondition).toEqual({ passed: 1, failed: 0 });
        expect(metrics.byType.postcondition).toEqual({ passed: 0, failed: 1 });
        expect(metrics.avgDuration).toBe(7.5);
      });

      it('should reset metrics', () => {
        const { handler, getMetrics, reset } = createMetricsHook();
        
        const event: VerificationEvent = {
          type: 'precondition:pass',
          timestamp: Date.now(),
          eventId: 'evt_1',
          label: 'test',
          expression: 'x > 0',
          passed: true,
          context: {},
        };
        
        handler(event);
        expect(getMetrics().total).toBe(1);
        
        reset();
        expect(getMetrics().total).toBe(0);
      });
    });

    describe('createFilterHook', () => {
      it('should forward only matching events', () => {
        const nextHandler = vi.fn();
        const filterTypes: VerificationEventType[] = ['invariant:fail'];
        const handler = createFilterHook(filterTypes, nextHandler);
        
        const passEvent: VerificationEvent = {
          type: 'precondition:pass',
          timestamp: Date.now(),
          eventId: 'evt_1',
          label: 'test',
          expression: 'x > 0',
          passed: true,
          context: {},
        };
        
        const failEvent: VerificationEvent = {
          type: 'invariant:fail',
          timestamp: Date.now(),
          eventId: 'evt_2',
          label: 'test2',
          expression: 'balance >= 0',
          passed: false,
          context: {},
        };
        
        handler(passEvent);
        expect(nextHandler).not.toHaveBeenCalled();
        
        handler(failEvent);
        expect(nextHandler).toHaveBeenCalledWith(failEvent);
      });
    });
  });

  describe('clearHooks', () => {
    it('should remove all registered hooks', () => {
      registerHook('test1', vi.fn());
      registerHook('test2', vi.fn());
      
      expect(getHookNames()).toHaveLength(2);
      
      clearHooks();
      
      expect(getHookNames()).toHaveLength(0);
      expect(hasHooks()).toBe(false);
    });
  });

  describe('resetHooks', () => {
    it('should reset hooks and buffering state', () => {
      registerHook('test', vi.fn());
      enableBuffering();
      
      const event: VerificationEvent = {
        type: 'precondition:check',
        timestamp: Date.now(),
        eventId: 'evt_1',
        label: 'test',
        expression: 'x > 0',
        passed: true,
        context: {},
      };
      
      emitEvent(event);
      
      expect(hasHooks()).toBe(true);
      expect(getBufferedEvents()).toHaveLength(1);
      
      resetHooks();
      
      expect(hasHooks()).toBe(false);
      expect(getBufferedEvents()).toHaveLength(0);
    });
  });
});
