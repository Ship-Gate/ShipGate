/**
 * Basic tests for the rate limiting library
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  RateLimiter,
  createRateLimiter,
  createMemoryStore,
  RateLimitAction,
  IdentifierType,
  DefaultClock,
} from '../src';

describe('Rate Limiter - Basic Tests', () => {
  let rateLimiter: RateLimiter;
  
  beforeEach(() => {
    rateLimiter = createRateLimiter([
      {
        name: 'default',
        limit: 10,
        windowMs: 60000,
        algorithm: 'TOKEN_BUCKET',
      },
    ]);
  });
  
  afterEach(async () => {
    await rateLimiter.close();
  });
  
  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const result = await rateLimiter.check({
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      
      expect(result.allowed).toBe(true);
      expect(result.action).toBe(RateLimitAction.ALLOW);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      // The limit comes from the config, not the result
      expect(result.configName).toBe('default');
    });
    
    it('should handle different keys independently', async () => {
      const result1 = await rateLimiter.check({
        key: 'user1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      
      const result2 = await rateLimiter.check({
        key: 'user2',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });
      
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
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
    
    it('should perform health check', async () => {
      const healthy = await rateLimiter.healthCheck();
      expect(healthy).toBe(true);
    });
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
});
