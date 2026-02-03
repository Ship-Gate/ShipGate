/**
 * SMT Cache Tests
 * 
 * Tests for query caching functionality:
 * - Hash determinism
 * - Cache hit/miss behavior
 * - TTL expiration
 * - LRU eviction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SMTCache, getGlobalCache, resetGlobalCache } from '../src/cache.js';
import { Expr, Sort, Decl } from '@isl-lang/prover';

describe('SMTCache', () => {
  let cache: SMTCache;
  
  beforeEach(() => {
    cache = new SMTCache({ maxEntries: 10, ttlMs: 1000 });
  });
  
  describe('hashQuery', () => {
    it('should produce deterministic hashes', () => {
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100))
      );
      const decls = [Decl.const('x', Sort.Int())];
      
      const hash1 = cache.hashQuery(formula, decls);
      const hash2 = cache.hashQuery(formula, decls);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });
    
    it('should produce different hashes for different formulas', () => {
      const formula1 = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
      const formula2 = Expr.lt(Expr.var('x', Sort.Int()), Expr.int(0));
      
      const hash1 = cache.hashQuery(formula1, []);
      const hash2 = cache.hashQuery(formula2, []);
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should produce same hash regardless of declaration order', () => {
      const formula = Expr.and(
        Expr.var('x', Sort.Int()),
        Expr.var('y', Sort.Int())
      );
      
      const decls1 = [Decl.const('x', Sort.Int()), Decl.const('y', Sort.Int())];
      const decls2 = [Decl.const('y', Sort.Int()), Decl.const('x', Sort.Int())];
      
      const hash1 = cache.hashQuery(formula, decls1);
      const hash2 = cache.hashQuery(formula, decls2);
      
      expect(hash1).toBe(hash2);
    });
  });
  
  describe('get/set', () => {
    it('should cache and retrieve results', () => {
      const hash = 'test-hash-123';
      const result = { status: 'sat' as const, model: { x: 5 } };
      
      cache.set(hash, result);
      const retrieved = cache.get(hash);
      
      expect(retrieved).toEqual(result);
    });
    
    it('should return null for cache miss', () => {
      const result = cache.get('nonexistent-hash');
      expect(result).toBeNull();
    });
    
    it('should not cache error results', () => {
      const hash = 'error-hash';
      const result = { status: 'error' as const, message: 'test error' };
      
      cache.set(hash, result);
      const retrieved = cache.get(hash);
      
      expect(retrieved).toBeNull();
    });
    
    it('should track hit/miss statistics', () => {
      const hash = 'stats-test';
      cache.set(hash, { status: 'sat' as const });
      
      cache.get(hash); // hit
      cache.get(hash); // hit
      cache.get('miss'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3);
    });
  });
  
  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTTLCache = new SMTCache({ ttlMs: 50 });
      const hash = 'ttl-test';
      
      shortTTLCache.set(hash, { status: 'sat' as const });
      expect(shortTTLCache.get(hash)).not.toBeNull();
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(shortTTLCache.get(hash)).toBeNull();
    });
  });
  
  describe('LRU eviction', () => {
    it('should evict oldest entries when full', () => {
      const smallCache = new SMTCache({ maxEntries: 3 });
      
      smallCache.set('hash1', { status: 'sat' as const });
      smallCache.set('hash2', { status: 'sat' as const });
      smallCache.set('hash3', { status: 'sat' as const });
      
      // This should evict hash1
      smallCache.set('hash4', { status: 'sat' as const });
      
      expect(smallCache.get('hash1')).toBeNull();
      expect(smallCache.get('hash2')).not.toBeNull();
      expect(smallCache.get('hash3')).not.toBeNull();
      expect(smallCache.get('hash4')).not.toBeNull();
    });
    
    it('should move accessed entries to front', () => {
      const smallCache = new SMTCache({ maxEntries: 3 });
      
      smallCache.set('hash1', { status: 'sat' as const });
      smallCache.set('hash2', { status: 'sat' as const });
      smallCache.set('hash3', { status: 'sat' as const });
      
      // Access hash1 to move it to front
      smallCache.get('hash1');
      
      // This should evict hash2 (now the oldest)
      smallCache.set('hash4', { status: 'sat' as const });
      
      expect(smallCache.get('hash1')).not.toBeNull();
      expect(smallCache.get('hash2')).toBeNull();
    });
  });
  
  describe('enable/disable', () => {
    it('should skip caching when disabled', () => {
      cache.setEnabled(false);
      
      cache.set('test', { status: 'sat' as const });
      expect(cache.get('test')).toBeNull();
      
      cache.setEnabled(true);
      cache.set('test', { status: 'sat' as const });
      expect(cache.get('test')).not.toBeNull();
    });
  });
});

describe('Global Cache', () => {
  beforeEach(() => {
    resetGlobalCache();
  });
  
  it('should return singleton instance', () => {
    const cache1 = getGlobalCache();
    const cache2 = getGlobalCache();
    expect(cache1).toBe(cache2);
  });
  
  it('should reset on resetGlobalCache', () => {
    const cache = getGlobalCache();
    cache.set('test', { status: 'sat' as const });
    
    resetGlobalCache();
    expect(cache.get('test')).toBeNull();
  });
});
