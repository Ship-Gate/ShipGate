/**
 * Comprehensive test suite for the rate limiting library
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  RateLimiter,
  createRateLimiter,
  createMemoryStore,
  RateLimitAction,
  IdentifierType,
  TokenBucketAlgorithm,
  SlidingWindowAlgorithm,
  FixedWindowAlgorithm,
  LeakyBucketAlgorithm,
  DefaultClock,
  createPolicyEngine,
  createPolicy,
  createTieredPolicy,
  createStandardTieredPolicy,
  IpKeyExtractor,
  UserIdKeyExtractor,
  ApiKeyExtractor,
  createHttpRateLimitMiddleware,
} from '../src';

describe('Rate Limiter', () => {
  let rateLimiter: RateLimiter;
  let clock: DefaultClock;
  
  beforeEach(() => {
    clock = new DefaultClock();
    rateLimiter = createRateLimiter([
      {
        name: 'default',
        limit: 10,
        windowMs: 60000,
        algorithm: 'TOKEN_BUCKET',
      },
      {
        name: 'strict',
        limit: 5,
        windowMs: 60000,
        algorithm: 'SLIDING_WINDOW',
      },
    ]);
  });
  
  afterEach(async () => {
    await rateLimiter.close();
  });
  
  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.check({
          key: 'user1',
          identifierType: IdentifierType.USER_ID,
          configName: 'default',
        });
        
        expect(result.allowed).toBe(true);
        expect(result.action).toBe(RateLimitAction.ALLOW);
        expect(result.remaining).toBe(9 - i);
        expect(result.limit).toBe(10);
      }
    });
    
    it('should deny requests exceeding limit', async () => {
      // Use up all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.check({
          key: 'user2',
          identifierType: IdentifierType.USER_ID,
          configName: 'default',
        });
      }
      
      // Next request should be denied
      const result = await rateLimiter.check({
        key: 'user2',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      
      expect(result.allowed).toBe(false);
      expect(result.action).toBe(RateLimitAction.DENY);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
    
    it('should handle different keys independently', async () => {
      // Exhaust limit for user1
      for (let i = 0; i < 10; i++) {
        await rateLimiter.check({
          key: 'user1',
          identifierType: IdentifierType.USER_ID,
          configName: 'default',
        });
      }
      
      // user1 should be denied
      const result1 = await rateLimiter.check({
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      expect(result1.allowed).toBe(false);
      
      // user2 should still be allowed
      const result2 = await rateLimiter.check({
        key: 'user2',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      expect(result2.allowed).toBe(true);
    });
  });
  
  describe('Token Bucket Algorithm', () => {
    it('should refill tokens over time', async () => {
      const testClock = new DefaultClock();
      const algorithm = new TokenBucketAlgorithm(
        {
          name: 'test',
          limit: 10,
          windowMs: 1000,
          burstLimit: 10,
        },
        testClock
      );
      
      // Initialize state
      const state = algorithm.initializeState({
        key: 'test',
        weight: 1,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 10,
          windowMs: 1000,
        },
      });
      
      // Use all tokens (weight=10 from bucket of 10 is allowed, leaving 0)
      let result = algorithm.check({
        key: 'test',
        weight: 10,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 10,
          windowMs: 1000,
        },
        currentState: state,
      });
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      
      // Next request should be denied (no tokens left)
      const denied = algorithm.check({
        key: 'test',
        weight: 1,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 10,
          windowMs: 1000,
        },
        currentState: result.newState,
      });
      
      expect(denied.allowed).toBe(false);
      
      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should have tokens again
      result = algorithm.check({
        key: 'test',
        weight: 5,
        timestamp: new Date(Date.now() + 1100),
        config: {
          name: 'test',
          limit: 10,
          windowMs: 1000,
        },
        currentState: denied.newState,
      });
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle burst capacity', async () => {
      const algorithm = new TokenBucketAlgorithm(
        {
          name: 'test',
          limit: 5,
          windowMs: 1000,
          burstLimit: 10,
        },
        clock
      );
      
      // Should allow burst up to bucket size
      const result = algorithm.check({
        key: 'test',
        weight: 8,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
          burstLimit: 10,
        },
      });
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Sliding Window Algorithm', () => {
    it('should count requests within sliding window', async () => {
      const algorithm = new SlidingWindowAlgorithm(
        {
          name: 'test',
          limit: 5,
          windowMs: 1000,
        },
        clock
      );
      
      let state: any = undefined;
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = algorithm.check({
          key: 'test',
          weight: 1,
          timestamp: new Date(),
          config: {
            name: 'test',
            limit: 5,
            windowMs: 1000,
          },
          currentState: state,
        });
        
        expect(result.allowed).toBe(true);
        state = result.newState;
      }
      
      // 6th request should be denied
      const result = algorithm.check({
        key: 'test',
        weight: 1,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
        },
        currentState: state,
      });
      
      expect(result.allowed).toBe(false);
      
      // Wait for window to slide
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      const result2 = algorithm.check({
        key: 'test',
        weight: 1,
        timestamp: new Date(Date.now() + 1100),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
        },
        currentState: result.newState,
      });
      
      expect(result2.allowed).toBe(true);
    });
  });
  
  describe('Fixed Window Algorithm', () => {
    it('should reset count at window boundaries', async () => {
      const algorithm = new FixedWindowAlgorithm(
        {
          name: 'test',
          limit: 5,
          windowMs: 1000,
        },
        clock
      );
      
      let state: any = undefined;
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = algorithm.check({
          key: 'test',
          weight: 1,
          timestamp: new Date(),
          config: {
            name: 'test',
            limit: 5,
            windowMs: 1000,
          },
          currentState: state,
        });
        
        expect(result.allowed).toBe(true);
        state = result.newState;
      }
      
      // 6th request should be denied
      const result = algorithm.check({
        key: 'test',
        weight: 1,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
        },
        currentState: state,
      });
      
      expect(result.allowed).toBe(false);
      
      // Wait for next window
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed in new window
      const result2 = algorithm.check({
        key: 'test',
        weight: 1,
        timestamp: new Date(Date.now() + 1100),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
        },
        currentState: result.newState,
      });
      
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(4);
    });
  });
  
  describe('Leaky Bucket Algorithm', () => {
    it('should leak requests at constant rate', async () => {
      const algorithm = new LeakyBucketAlgorithm(
        {
          name: 'test',
          limit: 5,
          windowMs: 1000,
          burstLimit: 10,
        },
        clock
      );
      
      let state: any = undefined;
      
      // Fill bucket
      const result1 = algorithm.check({
        key: 'test',
        weight: 8,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
          burstLimit: 10,
        },
        currentState: state,
      });
      
      expect(result1.allowed).toBe(true);
      state = result1.newState;
      
      // Next request should be denied (bucket is full)
      const result2 = algorithm.check({
        key: 'test',
        weight: 3,
        timestamp: new Date(),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
          burstLimit: 10,
        },
        currentState: state,
      });
      
      expect(result2.allowed).toBe(false);
      
      // Wait for leak
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      // Should be allowed after leak
      const result3 = algorithm.check({
        key: 'test',
        weight: 3,
        timestamp: new Date(Date.now() + 2100),
        config: {
          name: 'test',
          limit: 5,
          windowMs: 1000,
          burstLimit: 10,
        },
        currentState: result2.newState,
      });
      
      expect(result3.allowed).toBe(true);
    });
  });
  
  describe('Memory Store', () => {
    it('should store and retrieve buckets', async () => {
      const store = createMemoryStore();
      await store.initialize();
      
      const bucket = {
        id: 'test-bucket',
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
        currentCount: 5,
        totalRequests: 10,
        windowStart: new Date(),
        windowSizeMs: 60000,
        limit: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await store.setBucket(bucket);
      const retrieved = await store.getBucket('test-bucket');
      
      expect(retrieved).toEqual(bucket);
      
      await store.close();
    });
    
    it('should cleanup expired entries', async () => {
      const store = createMemoryStore({ cleanupIntervalMs: 100 });
      await store.initialize();
      
      // Create an old bucket
      const oldBucket = {
        id: 'old-bucket',
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
        currentCount: 5,
        totalRequests: 10,
        windowStart: new Date(Date.now() - 7200000), // 2 hours ago
        windowSizeMs: 60000,
        limit: 10,
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 7200000),
      };
      
      await store.setBucket(oldBucket);
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const retrieved = await store.getBucket('old-bucket');
      expect(retrieved).toBeNull();
      
      await store.close();
    });
  });
  
  describe('Policy Engine', () => {
    it('should evaluate policies in priority order', async () => {
      const engine = createPolicyEngine();
      
      // Add policies
      engine.addPolicy(createPolicy({
        name: 'low-priority',
        priority: 10,
        conditions: [
          {
            type: 'metadata',
            field: 'metadata.plan',
            operator: 'eq',
            value: 'vip',
          },
        ],
        action: {
          type: RateLimitAction.ALLOW,
          config: {
            name: 'vip-config',
            limit: 1000,
            windowMs: 60000,
          },
        },
      }));
      
      engine.addPolicy(createPolicy({
        name: 'high-priority',
        priority: 100,
        conditions: [
          {
            type: 'key',
            field: 'key',
            operator: 'eq',
            value: 'blocked-user',
          },
        ],
        action: {
          type: RateLimitAction.DENY,
        },
      }));
      
      // Test blocked user (high priority should match)
      const result1 = await engine.evaluate({
        key: 'blocked-user',
        identifierType: IdentifierType.USER_ID,
        requestCount: 1,
        windowStart: new Date(),
      });
      
      expect(result1.action).toBe(RateLimitAction.DENY);
      expect(result1.reason).toContain('high-priority');
      
      // Test VIP user
      const result2 = await engine.evaluate({
        key: 'vip-user',
        identifierType: IdentifierType.USER_ID,
        requestCount: 1,
        windowStart: new Date(),
        metadata: { plan: 'vip' },
      });
      
      expect(result2.action).toBe(RateLimitAction.ALLOW);
      if (result2.config) {
        expect(result2.config.limit).toBe(1000);
      } else {
        // If config is not passed through, check the reason
        expect(result2.reason).toContain('ALLOW');
      }
    });
    
    it('should handle tiered policies', async () => {
      const tieredPolicy = createStandardTieredPolicy('app-tiers', {
        defaultTier: 'free',
        customConfigs: {
          premium: { limit: 5000, windowMs: 60000 },
        },
      });
      
      const result1 = await tieredPolicy.evaluate({
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        requestCount: 1,
        windowStart: new Date(),
        metadata: { plan: 'premium' },
      });
      
      expect(result1.action).toBe(RateLimitAction.ALLOW);
      expect(result1.config?.limit).toBe(5000);
      expect(result1.metadata?.tier).toBe('premium');
      
      const result2 = await tieredPolicy.evaluate({
        key: 'user2',
        identifierType: IdentifierType.USER_ID,
        requestCount: 1,
        windowStart: new Date(),
        metadata: { plan: 'free' },
      });
      
      expect(result2.action).toBe(RateLimitAction.ALLOW);
      expect(result2.config?.limit).toBe(100);
      expect(result2.metadata?.tier).toBe('free');
    });
  });
  
  describe('Key Extractors', () => {
    it('should extract IP address', async () => {
      const extractor = new IpKeyExtractor();
      
      const context = {
        request: {
          url: '/api/test',
          method: 'GET',
          headers: {},
          ip: '192.168.1.1',
        },
      };
      
      const key = await extractor.extract(context);
      expect(key).toBe('192.168.1.1');
      expect(extractor.getType()).toBe(IdentifierType.IP);
    });
    
    it('should extract user ID from header', async () => {
      const extractor = new UserIdKeyExtractor({
        headerName: 'x-user-id',
      });
      
      const context = {
        request: {
          url: '/api/test',
          method: 'GET',
          headers: {
            'x-user-id': 'user123',
          },
        },
      };
      
      const key = await extractor.extract(context);
      expect(key).toBe('user123');
      expect(extractor.getType()).toBe(IdentifierType.USER_ID);
    });
    
    it('should extract API key from header', async () => {
      const extractor = new ApiKeyExtractor();
      
      const context = {
        request: {
          url: '/api/test',
          method: 'GET',
          headers: {
            'x-api-key': 'api-key-123',
          },
        },
      };
      
      const key = await extractor.extract(context);
      expect(key).toBe('api-key-123');
      expect(extractor.getType()).toBe(IdentifierType.API_KEY);
    });
  });
  
  describe('HTTP Middleware', () => {
    it('should create middleware with rate limiter', async () => {
      const middleware = createHttpRateLimitMiddleware(async (key, type, config, weight) => {
        return {
          action: RateLimitAction.ALLOW,
          allowed: true,
          remaining: 9,
          limit: 10,
          resetAt: new Date(Date.now() + 60000),
          bucketKey: 'test-bucket',
          configName: 'default',
        };
      });
      
      expect(middleware.name).toBe('http-rate-limit');
      expect(middleware.priority).toBe(100);
    });
    
    it('should skip rate limiting for configured paths', async () => {
      const middleware = createHttpRateLimitMiddleware(
        async () => ({
          action: RateLimitAction.ALLOW,
          allowed: true,
          remaining: 9,
          limit: 10,
          resetAt: new Date(Date.now() + 60000),
          bucketKey: 'test-bucket',
          configName: 'default',
        }),
        {
          skipPaths: ['/health', '/metrics'],
        }
      );
      
      const context = {
        request: {
          url: '/health',
          method: 'GET',
          headers: {},
        },
      };
      
      let nextCalled = false;
      const result = await middleware.execute(context, async () => {
        nextCalled = true;
        return { allowed: true, action: RateLimitAction.ALLOW };
      });
      
      expect(nextCalled).toBe(true);
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('Rate Limiter Operations', () => {
    it('should add and remove configurations', () => {
      const newConfig = {
        name: 'new-config',
        limit: 20,
        windowMs: 30000,
      };
      
      rateLimiter.addConfig(newConfig);
      expect(rateLimiter.getConfig('new-config')).toEqual(newConfig);
      
      const removed = rateLimiter.removeConfig('new-config');
      expect(removed).toBe(true);
      
      expect(() => rateLimiter.getConfig('new-config')).toThrow();
    });
    
    it('should reset bucket', async () => {
      // Use up limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.check({
          key: 'user1',
          identifierType: IdentifierType.USER_ID,
          configName: 'default',
        });
      }
      
      // Should be denied
      const result1 = await rateLimiter.check({
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      expect(result1.allowed).toBe(false);
      
      // Reset bucket
      await rateLimiter.resetBucket('user1', 'default');
      
      // Should be allowed again
      const result2 = await rateLimiter.check({
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      expect(result2.allowed).toBe(true);
    });
    
    it('should perform health check', async () => {
      const healthy = await rateLimiter.healthCheck();
      expect(healthy).toBe(true);
    });
  });
});
