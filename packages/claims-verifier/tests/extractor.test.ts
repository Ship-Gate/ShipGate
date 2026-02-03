// ============================================================================
// Claim Extractor Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  ClaimExtractor,
  extractClaimsFromLine,
  extractClaimsFromContent,
} from '../src/extractor.js';

describe('ClaimExtractor', () => {
  describe('extractClaimsFromLine', () => {
    it('extracts percentage claims', () => {
      const claims = extractClaimsFromLine(
        'Our trust score averages 94% across all tests.',
        1,
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].value).toBe(94);
      expect(claims[0].unit).toBe('%');
    });
    
    it('extracts count claims', () => {
      const claims = extractClaimsFromLine(
        'ISL includes 25 built-in rules for security.',
        1,
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
      const ruleClaim = claims.find(c => c.unit?.includes('rule'));
      expect(ruleClaim).toBeDefined();
      expect(ruleClaim?.value).toBe(25);
    });
    
    it('extracts trust score claims', () => {
      const claims = extractClaimsFromLine(
        'Trust Score: 87%',
        1,
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.value === 87)).toBe(true);
    });
    
    it('extracts money claims', () => {
      const claims = extractClaimsFromLine(
        'Team tier costs $29/user/month.',
        1,
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.value === 29)).toBe(true);
    });
    
    it('extracts time claims', () => {
      const claims = extractClaimsFromLine(
        'Response time under 100ms guaranteed.',
        1,
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.value === 100 && c.unit === 'ms')).toBe(true);
    });
    
    it('extracts multiplier claims', () => {
      const claims = extractClaimsFromLine(
        'ISL is 3x faster than manual testing.',
        1,
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.value === 3)).toBe(true);
    });
    
    it('skips hedged claims by default', () => {
      const claims = extractClaimsFromLine(
        'Approximately 94% of tests pass.',
        1,
        'test.md',
        { includeHedged: false }
      );
      
      expect(claims.length).toBe(0);
    });
    
    it('includes hedged claims when requested', () => {
      const claims = extractClaimsFromLine(
        'Approximately 94% of tests pass.',
        1,
        'test.md',
        { includeHedged: true }
      );
      
      expect(claims.length).toBeGreaterThan(0);
    });
    
    it('skips contextual claims by default', () => {
      const claims = extractClaimsFromLine(
        'In this example, the score is 94%.',
        1,
        'test.md',
        { includeContextual: false }
      );
      
      expect(claims.length).toBe(0);
    });
  });
  
  describe('extractClaimsFromContent', () => {
    it('extracts claims from multiple lines', () => {
      const content = `
# ISL Features

ISL includes 25 built-in rules.
Our trust score averages 94%.
Team tier costs $29/user/month.
      `;
      
      const claims = extractClaimsFromContent(content, 'README.md');
      
      expect(claims.length).toBeGreaterThanOrEqual(3);
      expect(claims.some(c => c.value === 25)).toBe(true);
      expect(claims.some(c => c.value === 94)).toBe(true);
      expect(claims.some(c => c.value === 29)).toBe(true);
    });
    
    it('tracks correct line numbers', () => {
      const content = `Line 1
Line 2 with 50% claim
Line 3
Line 4 with 100 rules`;
      
      const claims = extractClaimsFromContent(content, 'test.md');
      
      const percentClaim = claims.find(c => c.value === 50);
      expect(percentClaim?.location.line).toBe(2);
      
      const rulesClaim = claims.find(c => c.value === 100);
      expect(rulesClaim?.location.line).toBe(4);
    });
  });
  
  describe('ClaimExtractor class', () => {
    it('maintains configuration across extractions', () => {
      const extractor = new ClaimExtractor({ includeHedged: true });
      
      const claims = extractor.extract(
        'Approximately 85% success rate.',
        'test.md'
      );
      
      expect(claims.length).toBeGreaterThan(0);
    });
    
    it('extracts from multiple files', () => {
      const extractor = new ClaimExtractor();
      
      const files = new Map([
        ['a.md', '50% success'],
        ['b.md', '25 rules'],
      ]);
      
      const results = extractor.extractFromFiles(files);
      
      expect(results.size).toBe(2);
      expect(results.get('a.md')?.length).toBeGreaterThan(0);
      expect(results.get('b.md')?.length).toBeGreaterThan(0);
    });
  });
});
