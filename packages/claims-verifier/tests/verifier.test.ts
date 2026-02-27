// ============================================================================
// Claim Verifier Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaimVerifier, createDefaultFacts } from '../src/verifier.js';
import type { Claim, KnownFact } from '../src/types.js';

describe('ClaimVerifier', () => {
  let verifier: ClaimVerifier;
  
  const testFacts: KnownFact[] = [
    {
      id: 'rules-count',
      description: 'Number of built-in rules',
      value: 25,
      unit: 'rules',
      source: {
        type: 'repo_metadata',
        filePath: 'docs/PRICING.md',
        description: 'Pricing documentation',
      },
    },
    {
      id: 'team-price',
      description: 'Team tier price per user',
      value: 29,
      unit: 'dollars',
      source: {
        type: 'repo_metadata',
        filePath: 'docs/PRICING.md',
        description: 'Pricing documentation',
      },
    },
    {
      id: 'max-users',
      description: 'Maximum users on team tier',
      value: 50,
      unit: 'users',
      source: {
        type: 'repo_metadata',
        filePath: 'docs/PRICING.md',
        description: 'Pricing documentation',
      },
    },
  ];
  
  beforeEach(() => {
    verifier = new ClaimVerifier({
      knownFacts: testFacts,
      tolerance: 0.05,
    });
  });
  
  describe('verify', () => {
    it('verifies a claim that matches a known fact', () => {
      const claim: Claim = {
        id: 'test-1',
        text: '25 rules',
        value: 25,
        unit: 'rules',
        location: { file: 'test.md', line: 1, context: 'ISL includes 25 built-in rules' },
        verificationMethod: 'count_files',
        status: 'unverifiable',
        confidence: 0,
      };
      
      const result = verifier.verify(claim);
      
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified');
      expect(result.matchedFact?.id).toBe('rules-count');
    });
    
    it('flags a claim that does not match any known fact', () => {
      const claim: Claim = {
        id: 'test-2',
        text: '94%',
        value: 94,
        unit: '%',
        location: { file: 'test.md', line: 1, context: 'Average Trust Score 94%' },
        verificationMethod: 'command_output',
        status: 'unverifiable',
        confidence: 0,
      };
      
      const result = verifier.verify(claim);
      
      expect(result.verified).toBe(false);
      expect(result.status).toBe('unverifiable');
      expect(result.explanation).toContain('No known fact');
    });
    
    it('detects mismatched values', () => {
      // Add a trust score fact
      verifier.addFact({
        id: 'trust-score',
        description: 'Average trust score from tests',
        value: 87,
        unit: '%',
        source: {
          type: 'command_output',
          command: 'npm test',
          outputPath: 'score',
        },
      });
      
      const claim: Claim = {
        id: 'test-3',
        text: '94%',
        value: 94,
        unit: '%',
        location: { file: 'test.md', line: 1, context: 'Average trust score 94%' },
        verificationMethod: 'command_output',
        status: 'unverifiable',
        confidence: 0,
      };
      
      const result = verifier.verify(claim);
      
      expect(result.verified).toBe(false);
      expect(result.status).toBe('mismatch');
      expect(result.actualValue).toBe(87);
    });
    
    it('allows values within tolerance', () => {
      verifier.addFact({
        id: 'score',
        description: 'Test score',
        value: 95,
        unit: '%',
        source: { type: 'command_output', command: 'test' },
      });
      
      const claim: Claim = {
        id: 'test-4',
        text: '94%',
        value: 94, // Within 5% tolerance of 95
        unit: '%',
        location: { file: 'test.md', line: 1, context: 'Score 94%' },
        verificationMethod: 'command_output',
        status: 'unverifiable',
        confidence: 0,
      };
      
      const result = verifier.verify(claim);
      
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified');
    });
  });
  
  describe('verifyAll', () => {
    it('verifies multiple claims', () => {
      const claims: Claim[] = [
        {
          id: 'c1',
          text: '25 rules',
          value: 25,
          unit: 'rules',
          location: { file: 'test.md', line: 1, context: '25 rules' },
          verificationMethod: 'count_files',
          status: 'unverifiable',
          confidence: 0,
        },
        {
          id: 'c2',
          text: '$29',
          value: 29,
          unit: 'dollars',
          location: { file: 'test.md', line: 2, context: 'costs $29' },
          verificationMethod: 'json_field',
          status: 'unverifiable',
          confidence: 0,
        },
        {
          id: 'c3',
          text: '99%',
          value: 99,
          unit: '%',
          location: { file: 'test.md', line: 3, context: 'invented 99%' },
          verificationMethod: 'command_output',
          status: 'unverifiable',
          confidence: 0,
        },
      ];
      
      const results = verifier.verifyAll(claims);
      
      expect(results.length).toBe(3);
      expect(results.filter(r => r.verified).length).toBe(2); // 25 rules and $29
      expect(results.filter(r => !r.verified).length).toBe(1); // 99%
    });
  });
  
  describe('fact management', () => {
    it('allows adding facts', () => {
      verifier.addFact({
        id: 'new-fact',
        description: 'New metric',
        value: 100,
        unit: 'things',
        source: { type: 'user_provided', providedBy: 'test', providedAt: new Date() },
      });
      
      expect(verifier.getFacts().length).toBe(testFacts.length + 1);
    });
    
    it('allows removing facts', () => {
      verifier.removeFact('rules-count');
      expect(verifier.getFacts().length).toBe(testFacts.length - 1);
    });
  });
  
  describe('createDefaultFacts', () => {
    it('returns default ISL facts', () => {
      const facts = createDefaultFacts();
      
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.some(f => f.id === 'builtin-rules-count')).toBe(true);
      expect(facts.some(f => f.id === 'team-price')).toBe(true);
    });
  });
});
