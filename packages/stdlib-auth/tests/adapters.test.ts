// ============================================================================
// Adapter Tests
// Tests for Fastify and Express adapters
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthService,
  InMemoryUserRepository,
  InMemorySessionRepository,
  UserStatus,
} from '../implementations/typescript/index.js';
import { 
  authenticate as fastifyAuthenticate,
  requireRole as fastifyRequireRole
} from '../adapters/fastify/index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { 
  authenticate as expressAuthenticate,
  requireRole as expressRequireRole
} from '../adapters/express/index.js';
import type { Request, Response, NextFunction } from 'express';

describe('Fastify Adapter', () => {
  let authService: AuthService;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    const sessionRepo = new InMemorySessionRepository();
    class ActiveUserRepo extends InMemoryUserRepository {
      override async create(
        data: Parameters<InMemoryUserRepository['create']>[0]
      ): Promise<Awaited<ReturnType<InMemoryUserRepository['create']>>> {
        return super.create({ ...data, status: UserStatus.ACTIVE } as Parameters<InMemoryUserRepository['create']>[0]);
      }
    }
    authService = new AuthService({
      userRepository: new ActiveUserRepo(),
      sessionRepository: sessionRepo,
    });

    mockRequest = {
      headers: {},
      ip: '192.168.1.1',
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token', async () => {
      // Register and login user
      const registerResult = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
        ipAddress: '192.168.1.1'
      });

      expect(registerResult.success).toBe(true);

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123',
        ipAddress: '192.168.1.1'
      });

      expect(loginResult.success).toBe(true);
      const token = loginResult.data.token;

      // Test authentication middleware
      mockRequest.headers!['authorization'] = `Bearer ${token}`;

      await fastifyAuthenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        {
          authService,
          jwtSecret: 'test-secret'
        }
      );

      expect(mockReply.code).not.toHaveBeenCalledWith(401);
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).user.email).toBe('test@example.com');
    });

    it('should reject missing authorization header', async () => {
      mockRequest.headers = {};

      await fastifyAuthenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        {
          authService,
          jwtSecret: 'test-secret'
        }
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });

    it('should reject invalid token format', async () => {
      mockRequest.headers!['authorization'] = 'InvalidFormat token';

      await fastifyAuthenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        {
          authService,
          jwtSecret: 'test-secret'
        }
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });
  });
});

describe('Express Adapter', () => {
  let authService: AuthService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    const sessionRepo = new InMemorySessionRepository();
    class ActiveUserRepo extends InMemoryUserRepository {
      override async create(
        data: Parameters<InMemoryUserRepository['create']>[0]
      ): Promise<Awaited<ReturnType<InMemoryUserRepository['create']>>> {
        return super.create({ ...data, status: UserStatus.ACTIVE } as Parameters<InMemoryUserRepository['create']>[0]);
      }
    }
    authService = new AuthService({
      userRepository: new ActiveUserRepo(),
      sessionRepository: sessionRepo,
    });

    mockRequest = {
      headers: {},
      ip: '192.168.1.1',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token', async () => {
      // Register and login user
      const registerResult = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
        ipAddress: '192.168.1.1'
      });

      expect(registerResult.success).toBe(true);

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123',
        ipAddress: '192.168.1.1'
      });

      expect(loginResult.success).toBe(true);
      const token = loginResult.data.token;

      // Test authentication middleware
      mockRequest.headers!['authorization'] = `Bearer ${token}`;

      const middleware = expressAuthenticate({
        authService,
        jwtSecret: 'test-secret'
      });

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).user.email).toBe('test@example.com');
    });

    it('should reject missing authorization header', async () => {
      mockRequest.headers = {};

      const middleware = expressAuthenticate({
        authService,
        jwtSecret: 'test-secret'
      });

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for user with required role', async () => {
      // Setup user with admin role
      const registerResult = await authService.register({
        email: 'admin@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
        ipAddress: '192.168.1.1'
      });

      // Note: In real implementation, you'd assign roles via authService
      // For now, we'll mock the user object
      (mockRequest as any).user = {
        id: 'user-id',
        email: 'admin@example.com',
        roles: ['admin']
      };

      const middleware = expressRequireRole('admin');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user without required role', async () => {
      (mockRequest as any).user = {
        id: 'user-id',
        email: 'user@example.com',
        roles: ['user']
      };

      const middleware = expressRequireRole('admin');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
