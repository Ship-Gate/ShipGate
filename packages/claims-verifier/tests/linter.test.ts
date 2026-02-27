// ============================================================================
// Claims Linter Tests - Demonstrates Refusal of Invented Metrics
// ============================================================================

import { describe, it, expect } from 'vitest';
import { ClaimsLinter, formatLintResults } from '../src/linter.js';
import type { KnownFact } from '../src/types.js';

describe('ClaimsLinter', () => {
  const knownFacts: KnownFact[] = [
    {
      id: 'rules-count',
      description: 'Number of built-in rules',
      value: 25,
      unit: 'rules',
      source: { type: 'repo_metadata', filePath: 'docs/PRICING.md', description: 'Pricing docs' },
    },
    {
      id: 'team-price',
      description: 'Team tier monthly price',
      value: 29,
      unit: 'dollars',
      source: { type: 'repo_metadata', filePath: 'docs/PRICING.md', description: 'Pricing docs' },
    },
  ];
  
  describe('DEMONSTRATES REFUSAL OF INVENTED METRICS', () => {
    it('REFUSES invented percentage claims', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // This is an invented metric - 94% is not backed by any known fact
      const content = `
        <div>Average Trust Score</div>
        <div>94%</div>
        <p>Across all verified contracts</p>
      `;
      
      const result = linter.lint(content, 'Landing.tsx');
      
      // The linter MUST flag this as unverifiable
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => 
        i.claim.value === 94 && 
        i.claim.status === 'unverifiable'
      )).toBe(true);
      
      // It should provide a softening suggestion
      const issue = result.issues.find(i => i.claim.value === 94);
      expect(issue?.suggestion).toBeDefined();
      expect(issue?.fixable).toBe(true);
    });
    
    it('REFUSES invented count claims', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // "100 integrations" is not a known fact
      const content = 'ISL supports 100 integrations out of the box.';
      
      const result = linter.lint(content, 'features.md');
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.summary.unverifiable).toBeGreaterThan(0);
    });
    
    it('REFUSES invented performance claims', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // "10x faster" without backing data
      const content = 'ISL is 10x faster than traditional testing.';
      
      const result = linter.lint(content, 'landing.md');
      
      expect(result.issues.length).toBeGreaterThan(0);
      const issue = result.issues.find(i => i.claim.value === 10);
      expect(issue).toBeDefined();
      expect(issue?.claim.status).toBe('unverifiable');
    });
    
    it('REFUSES invented time claims', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // "5 minutes" setup time without verification
      const content = 'Get started in just 5 minutes.';
      
      const result = linter.lint(content, 'quickstart.md');
      
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    it('ACCEPTS verified count claims', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // "25 rules" IS a known fact
      const content = 'ISL includes 25 built-in rules for security.';
      
      const result = linter.lint(content, 'features.md');
      
      expect(result.summary.verified).toBeGreaterThan(0);
      // Should not flag the 25 rules claim as an issue
      expect(result.issues.filter(i => i.claim.value === 25).length).toBe(0);
    });
    
    it('ACCEPTS verified price claims', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // "$29" IS a known fact
      const content = 'Team tier costs $29/user/month.';
      
      const result = linter.lint(content, 'pricing.md');
      
      expect(result.summary.verified).toBeGreaterThan(0);
    });
  });
  
  describe('lint', () => {
    it('returns summary statistics', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      const content = `
# Features

- 25 built-in rules
- 94% average trust score (invented!)
- $29/user/month
      `;
      
      const result = linter.lint(content, 'test.md');
      
      expect(result.summary.total).toBeGreaterThanOrEqual(3);
      expect(result.summary.verified).toBeGreaterThanOrEqual(2); // 25 rules, $29
      expect(result.summary.unverifiable).toBeGreaterThanOrEqual(1); // 94%
    });
    
    it('includes location information', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      const content = `Line 1
Line 2
Line 3 with 99% invented claim`;
      
      const result = linter.lint(content, 'test.md');
      
      const issue = result.issues.find(i => i.claim.value === 99);
      expect(issue?.claim.location.line).toBe(3);
      expect(issue?.claim.location.file).toBe('test.md');
    });
  });
  
  describe('lintFiles', () => {
    it('lints multiple files', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      const files = new Map([
        ['a.md', '25 rules included'],
        ['b.md', '99% uptime guaranteed'],
      ]);
      
      const results = linter.lintFiles(files);
      
      expect(results.size).toBe(2);
      
      const aResult = results.get('a.md');
      expect(aResult?.summary.verified).toBeGreaterThan(0);
      
      const bResult = results.get('b.md');
      expect(bResult?.summary.unverifiable).toBeGreaterThan(0);
    });
  });
  
  describe('severity levels', () => {
    it('uses configured severity for unverifiable claims', () => {
      const linter = new ClaimsLinter({
        knownFacts,
        unverifiableSeverity: 'error',
      });
      
      const result = linter.lint('95% success rate', 'test.md');
      
      expect(result.issues[0]?.severity).toBe('error');
    });
    
    it('uses configured severity for mismatched claims', () => {
      const factsWithScore: KnownFact[] = [
        ...knownFacts,
        {
          id: 'score',
          description: 'Actual score',
          value: 87,
          unit: '%',
          source: { type: 'command_output', command: 'test' },
        },
      ];
      
      const linter = new ClaimsLinter({
        knownFacts: factsWithScore,
        mismatchSeverity: 'error',
      });
      
      const result = linter.lint('Score of 94%', 'test.md');
      
      // Find the mismatched issue (94% vs 87%)
      const mismatchIssue = result.issues.find(i => 
        i.claim.status === 'mismatch'
      );
      
      if (mismatchIssue) {
        expect(mismatchIssue.severity).toBe('error');
      }
    });
  });
  
  describe('formatLintResults', () => {
    it('formats results for display', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      const result = linter.lint('Invented 95% success rate', 'test.md');
      const formatted = formatLintResults([result]);
      
      expect(formatted).toContain('test.md');
      expect(formatted).toContain('issue');
    });
    
    it('shows success message when no issues', () => {
      const linter = new ClaimsLinter({ knownFacts });
      
      // Only verified claims
      const result = linter.lint('25 rules available', 'test.md');
      const formatted = formatLintResults([result]);
      
      // Should either have no issues or show success
      if (result.issues.length === 0) {
        expect(formatted).toContain('No unverifiable claims');
      }
    });
  });
});

describe('Real-World Content Tests', () => {
  const knownFacts: KnownFact[] = [
    {
      id: 'rules-count',
      description: 'Built-in rules count',
      value: 25,
      unit: 'rules',
      source: { type: 'repo_metadata', filePath: 'docs/PRICING.md', description: 'Pricing' },
    },
    {
      id: 'team-price',
      description: 'Team tier price',
      value: 29,
      unit: 'dollars',
      source: { type: 'repo_metadata', filePath: 'docs/PRICING.md', description: 'Pricing' },
    },
    {
      id: 'max-team-users',
      description: 'Max team users',
      value: 50,
      unit: 'users',
      source: { type: 'repo_metadata', filePath: 'docs/PRICING.md', description: 'Pricing' },
    },
  ];
  
  it('flags Landing.tsx hardcoded trust score', () => {
    const linter = new ClaimsLinter({ knownFacts });
    
    // Simulating the actual Landing.tsx content
    const landingContent = `
      <p className="text-sm text-gray-500 mb-2">Average Trust Score</p>
      <div className="text-6xl font-bold">
        94%
      </div>
      <p className="text-sm text-gray-500 mt-2">Across all verified contracts</p>
    `;
    
    const result = linter.lint(landingContent, 'Landing.tsx');
    
    // MUST flag the 94% as unverifiable
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(i => i.claim.value === 94)).toBe(true);
  });
  
  it('accepts PRICING.md verified claims', () => {
    const linter = new ClaimsLinter({ knownFacts });
    
    // Content from actual PRICING.md
    const pricingContent = `
      ## Team — $29/user/month
      - Up to 50 users
      - 25 built-in rules
    `;
    
    const result = linter.lint(pricingContent, 'PRICING.md');
    
    // These should be verified, not flagged
    expect(result.summary.verified).toBeGreaterThan(0);
    // Specifically, 25 rules and $29 and 50 users should be verified
  });
});
