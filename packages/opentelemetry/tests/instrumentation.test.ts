import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  islExpressMiddleware,
  createISLRequestHeaders,
  extractISLContextFromMetadata,
  injectISLContextToMetadata,
  ISL_HEADERS,
} from '../src';

describe('Express Instrumentation', () => {
  describe('islExpressMiddleware', () => {
    it('should create middleware function', () => {
      const middleware = islExpressMiddleware({
        defaultDomain: 'TestDomain',
      });

      expect(typeof middleware).toBe('function');
    });

    it('should skip ignored requests', () => {
      const middleware = islExpressMiddleware({
        ignoreFilter: (req) => req.path === '/health',
      });

      const mockReq = {
        path: '/health',
        method: 'GET',
        headers: {},
      } as any;

      const mockRes = {} as any;
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('createISLRequestHeaders', () => {
    it('should return empty object when no context', () => {
      const mockReq = {} as any;
      const headers = createISLRequestHeaders(mockReq);
      expect(headers).toEqual({});
    });
  });
});

describe('gRPC Instrumentation', () => {
  describe('extractISLContextFromMetadata', () => {
    it('should extract ISL context from metadata', () => {
      const mockMetadata = {
        get: (key: string) => {
          const values: Record<string, string[]> = {
            [ISL_HEADERS.DOMAIN]: ['Auth'],
            [ISL_HEADERS.BEHAVIOR]: ['Login'],
            [ISL_HEADERS.VERIFICATION_ID]: ['ver-123'],
            [ISL_HEADERS.ACTOR]: ['User'],
          };
          return values[key] ?? [];
        },
      } as any;

      const context = extractISLContextFromMetadata(mockMetadata);

      expect(context?.domain).toBe('Auth');
      expect(context?.behavior).toBe('Login');
      expect(context?.verificationId).toBe('ver-123');
      expect(context?.actor).toBe('User');
    });

    it('should return undefined when no domain', () => {
      const mockMetadata = {
        get: () => [],
      } as any;

      const context = extractISLContextFromMetadata(mockMetadata);
      expect(context).toBeUndefined();
    });
  });

  describe('injectISLContextToMetadata', () => {
    it('should inject ISL context into metadata', () => {
      const mockMetadata = {
        set: vi.fn(),
      } as any;

      injectISLContextToMetadata(mockMetadata, {
        domain: 'Payments',
        behavior: 'ProcessPayment',
        verificationId: 'ver-456',
        trustScore: 0.95,
      });

      expect(mockMetadata.set).toHaveBeenCalledWith(ISL_HEADERS.DOMAIN, 'Payments');
      expect(mockMetadata.set).toHaveBeenCalledWith(
        ISL_HEADERS.BEHAVIOR,
        'ProcessPayment'
      );
      expect(mockMetadata.set).toHaveBeenCalledWith(
        ISL_HEADERS.VERIFICATION_ID,
        'ver-456'
      );
      expect(mockMetadata.set).toHaveBeenCalledWith(ISL_HEADERS.TRUST_SCORE, '0.95');
    });
  });
});
