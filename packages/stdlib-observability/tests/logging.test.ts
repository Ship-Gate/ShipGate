// ============================================================================
// Observability Standard Library - Logging Tests
// @isl-lang/stdlib-observability
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  LogLevel,
  ConsoleLogExporter,
  InMemoryLogExporter,
  setLogContext,
  clearLogContext,
  getLogContext,
  logLevelToString,
  parseLogLevel,
  getDefaultLogger,
  setDefaultLogger,
  LogEntry,
} from '../implementations/typescript/logging';

describe('Logging', () => {
  let memoryExporter: InMemoryLogExporter;
  let logger: Logger;

  beforeEach(() => {
    memoryExporter = new InMemoryLogExporter();
    logger = new Logger({
      minLevel: LogLevel.TRACE,
      service: 'test-service',
      environment: 'test',
      exporter: memoryExporter,
    });
    clearLogContext();
  });

  afterEach(() => {
    clearLogContext();
  });

  describe('Logger', () => {
    it('should write log entries', async () => {
      await logger.info('Test message', { userId: '123' });

      const logs = memoryExporter.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].attributes?.userId).toBe('123');
      expect(logs[0].service).toBe('test-service');
      expect(logs[0].environment).toBe('test');
    });

    it('should respect minimum log level', async () => {
      const loggerWithMinLevel = new Logger({
        minLevel: LogLevel.WARN,
        service: 'test',
        environment: 'test',
        exporter: memoryExporter,
      });

      await loggerWithMinLevel.debug('Debug message');
      await loggerWithMinLevel.info('Info message');
      await loggerWithMinLevel.warn('Warning message');
      await loggerWithMinLevel.error('Error message');

      const logs = memoryExporter.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    it('should include correlation context', async () => {
      setLogContext({
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await logger.info('Test with context');

      const logs = memoryExporter.getLogs();
      expect(logs[0].traceId).toBe('abcdef1234567890abcdef1234567890');
      expect(logs[0].spanId).toBe('1234567890abcdef');
      expect(logs[0].correlationId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(logs[0].requestId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should serialize errors', async () => {
      const error = new Error('Test error');
      error.name = 'TestError';
      
      await logger.error('Error occurred', { error });

      const logs = memoryExporter.getLogs();
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error?.type).toBe('Error');
      expect(logs[0].error?.message).toBe('Test error');
      expect(logs[0].error?.stackTrace).toBeDefined();
    });

    it('should never throw errors', async () => {
      const faultyExporter = {
        async export(_: LogEntry[]): Promise<void> {
          throw new Error('Exporter failed');
        },
        async shutdown(): Promise<void> {},
      };

      const loggerWithFaultyExporter = new Logger({
        minLevel: LogLevel.INFO,
        service: 'test',
        environment: 'test',
        exporter: faultyExporter,
      });

      // Should not throw
      await expect(logger.info('Test message')).resolves.not.toThrow();
    });
  });

  describe('Log Levels', () => {
    it('should convert log levels to strings', () => {
      expect(logLevelToString(LogLevel.TRACE)).toBe('TRACE');
      expect(logLevelToString(LogLevel.DEBUG)).toBe('DEBUG');
      expect(logLevelToString(LogLevel.INFO)).toBe('INFO');
      expect(logLevelToString(LogLevel.WARN)).toBe('WARN');
      expect(logLevelToString(LogLevel.ERROR)).toBe('ERROR');
      expect(logLevelToString(LogLevel.FATAL)).toBe('FATAL');
    });

    it('should parse log levels from strings', () => {
      expect(parseLogLevel('TRACE')).toBe(LogLevel.TRACE);
      expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
      expect(parseLogLevel('INFO')).toBe(LogLevel.INFO);
      expect(parseLogLevel('WARN')).toBe(LogLevel.WARN);
      expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
      expect(parseLogLevel('FATAL')).toBe(LogLevel.FATAL);
      expect(parseLogLevel('trace')).toBe(LogLevel.TRACE); // Case insensitive
    });
  });

  describe('Context Management', () => {
    it('should manage log context', () => {
      expect(getLogContext()).toEqual({});

      setLogContext({ traceId: 'test-trace-id' });
      expect(getLogContext()).toEqual({ traceId: 'test-trace-id' });

      setLogContext({ spanId: 'test-span-id' });
      expect(getLogContext()).toEqual({ 
        traceId: 'test-trace-id',
        spanId: 'test-span-id' 
      });

      clearLogContext();
      expect(getLogContext()).toEqual({});
    });
  });

  describe('Default Logger', () => {
    it('should manage default logger instance', () => {
      const originalLogger = getDefaultLogger();
      
      const newLogger = new Logger({
        minLevel: LogLevel.DEBUG,
        service: 'new-service',
        environment: 'test',
        exporter: new ConsoleLogExporter(),
      });

      setDefaultLogger(newLogger);
      expect(getDefaultLogger()).toBe(newLogger);

      // Restore original
      setDefaultLogger(originalLogger);
    });
  });

  describe('Exporters', () => {
    it('should store logs in memory exporter', async () => {
      await logger.trace('Trace message');
      await logger.debug('Debug message');
      await logger.info('Info message');

      const logs = memoryExporter.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Trace message');
      expect(logs[1].message).toBe('Debug message');
      expect(logs[2].message).toBe('Info message');

      await memoryExporter.clear();
      expect(memoryExporter.getLogs()).toHaveLength(0);
    });
  });
});
