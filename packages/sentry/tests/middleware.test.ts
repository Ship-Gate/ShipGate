import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn().mockReturnValue('event-id-123'),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn(), setAttribute: vi.fn() })),
  withScope: vi.fn((fn) => fn({ setTag: vi.fn(), setContext: vi.fn(), setLevel: vi.fn() })),
}));

vi.mock('@sentry/profiling-node', () => ({
  ProfilingIntegration: vi.fn().mockImplementation(() => ({
    name: 'ProfilingIntegration',
    setupOnce: vi.fn(),
  })),
}));

import {
  sentryISLMiddleware,
  sentryISLErrorHandler,
  createISLMiddleware,
} from '../src/middleware';
import { PreconditionError, PostconditionError, InvariantError } from '../src';

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sentryISLMiddleware', () => {
    it('should set ISL tags from headers', () => {
      const middleware = sentryISLMiddleware();

      const req = {
        headers: {
          'x-isl-domain': 'UserDomain',
          'x-isl-behavior': 'createUser',
        },
        method: 'POST',
        url: '/api/users',
      };

      const res = {
        statusCode: 200,
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
      };

      const next = vi.fn();

      middleware(req, res, next);

      expect(Sentry.setTags).toHaveBeenCalledWith({
        'isl.domain': 'UserDomain',
        'isl.behavior': 'createUser',
      });
    });

    it('should call next without ISL headers', () => {
      const middleware = sentryISLMiddleware();

      const req = {
        headers: {},
        method: 'GET',
        url: '/health',
      };

      const res = {
        statusCode: 200,
        on: vi.fn(),
      };

      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(Sentry.setTags).not.toHaveBeenCalled();
    });
  });

  describe('sentryISLErrorHandler', () => {
    it('should handle PreconditionError', () => {
      const errorHandler = sentryISLErrorHandler();

      const error = new PreconditionError(
        'Precondition failed',
        'UserDomain',
        'createUser',
        'validEmail'
      );

      const req = {
        headers: {
          'x-isl-domain': 'UserDomain',
          'x-isl-behavior': 'createUser',
        },
      };

      const res = {
        statusCode: 400,
        on: vi.fn(),
      };

      const next = vi.fn();

      errorHandler(error, req, res, next);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle PostconditionError', () => {
      const errorHandler = sentryISLErrorHandler();

      const error = new PostconditionError(
        'Postcondition failed',
        'UserDomain',
        'createUser',
        'hasId'
      );

      const req = {
        headers: {},
      };

      const res = {
        statusCode: 500,
        on: vi.fn(),
      };

      const next = vi.fn();

      errorHandler(error, req, res, next);

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle InvariantError', () => {
      const errorHandler = sentryISLErrorHandler();

      const error = new InvariantError(
        'Invariant violated',
        'AccountDomain',
        'balanceNonNegative'
      );

      const req = {
        headers: {},
      };

      const res = {
        statusCode: 500,
        on: vi.fn(),
      };

      const next = vi.fn();

      errorHandler(error, req, res, next);

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createISLMiddleware', () => {
    it('should ignore specified routes', () => {
      const middleware = createISLMiddleware({
        ignoreRoutes: ['/health', '/metrics'],
      });

      const req = {
        headers: {
          'x-isl-domain': 'UserDomain',
          'x-isl-behavior': 'createUser',
        },
        path: '/health',
      };

      const res = {
        statusCode: 200,
        on: vi.fn(),
      };

      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(Sentry.setTags).not.toHaveBeenCalled();
    });

    it('should track all requests when option enabled', () => {
      const middleware = createISLMiddleware({
        trackAllRequests: true,
      });

      const req = {
        headers: {},
        path: '/api/data',
        method: 'GET',
        url: '/api/data',
      };

      const res = {
        statusCode: 200,
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
      };

      const next = vi.fn();

      middleware(req, res, next);

      // Should process even without ISL headers
      expect(next).toHaveBeenCalled();
    });
  });
});
