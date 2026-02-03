// ============================================================================
// Auto-Softener Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { AutoSoftener, softenContent } from '../src/softener.js';
import { ClaimsLinter } from '../src/linter.js';
import type { KnownFact } from '../src/types.js';

describe('AutoSoftener', () => {
  describe('softenClaim', () => {
    const softener = new AutoSoftener({ style: 'moderate' });
    
    it('softens percentage claims', () => {
      const result = softener.softenClaim({
        id: 'test',
        text: '94%',
        value: 94,
        unit: '%',
        location: { file: 'test.md', line: 1 },
        verificationMethod: 'manual_check',
        status: 'unverifiable',
        confidence: 0,
      });
      
      expect(result).toContain('94');
      expect(result.toLowerCase()).toMatch(/around|approximately|up to/);
    });
    
    it('softens trust score claims', () => {
      const result = softener.softenClaim({
        id: 'test',
        text: 'Trust Score 94%',
        value: 94,
        unit: '%',
        location: { file: 'test.md', line: 1 },
        verificationMethod: 'command_output',
        status: 'unverifiable',
        confidence: 0,
      });
      
      expect(result.toLowerCase()).toContain('trust score');
      expect(result).toMatch(/can reach|typically/);
    });
    
    it('softens count claims', () => {
      const result = softener.softenClaim({
        id: 'test',
        text: '25 rules',
        value: 25,
        unit: 'rules',
        location: { file: 'test.md', line: 1 },
        verificationMethod: 'count_files',
        status: 'unverifiable',
        confidence: 0,
      });
      
      expect(result.toLowerCase()).toContain('rule');
    });
  });
  
  describe('soften', () => {
    const knownFacts: KnownFact[] = [];
    
    it('softens unverifiable claims in content', () => {
      const linter = new ClaimsLinter({ knownFacts });
      const softener = new AutoSoftener();
      
      const content = 'Our platform achieves 94% accuracy on all tasks.';
      const lintResult = linter.lint(content, 'test.md');
      
      expect(lintResult.issues.length).toBeGreaterThan(0);
      
      const result = softener.soften(content, lintResult);
      
      expect(result.claimsSoftened).toBeGreaterThan(0);
      expect(result.softened).not.toBe(content);
      expect(result.softened.toLowerCase()).toMatch(/approximately|around|up to/);
    });
    
    it('preserves verified claims', () => {
      const facts: KnownFact[] = [{
        id: 'accuracy',
        description: 'Verified accuracy',
        value: 94,
        unit: '%',
        source: { type: 'command_output', command: 'test' },
      }];
      
      const linter = new ClaimsLinter({ knownFacts: facts });
      const softener = new AutoSoftener();
      
      const content = 'Our platform achieves 94% accuracy.';
      const lintResult = linter.lint(content, 'test.md');
      
      const result = softener.soften(content, lintResult);
      
      // Verified claims should not be softened
      expect(result.claimsSoftened).toBe(0);
      expect(result.softened).toBe(content);
    });
    
    it('tracks all changes made', () => {
      const linter = new ClaimsLinter({ knownFacts: [] });
      const softener = new AutoSoftener();
      
      const content = `Line 1 with 90% claim
Line 2 with 85% claim`;
      
      const lintResult = linter.lint(content, 'test.md');
      const result = softener.soften(content, lintResult);
      
      expect(result.changes.length).toBe(result.claimsSoftened);
      
      for (const change of result.changes) {
        expect(change.originalText).toBeDefined();
        expect(change.softenedText).toBeDefined();
        expect(change.line).toBeGreaterThan(0);
      }
    });
  });
  
  describe('style options', () => {
    it('conservative style uses weaker softening', () => {
      const softener = new AutoSoftener({ style: 'conservative' });
      
      const result = softener.softenClaim({
        id: 'test',
        text: '94%',
        value: 94,
        unit: '%',
        location: { file: 'test.md', line: 1 },
        verificationMethod: 'manual_check',
        status: 'unverifiable',
        confidence: 0,
      });
      
      expect(result.toLowerCase()).toContain('approximately');
    });
    
    it('aggressive style uses stronger softening', () => {
      const softener = new AutoSoftener({ style: 'aggressive' });
      
      const result = softener.softenClaim({
        id: 'test',
        text: '94%',
        value: 94,
        unit: '%',
        location: { file: 'test.md', line: 1 },
        verificationMethod: 'manual_check',
        status: 'unverifiable',
        confidence: 0,
      });
      
      expect(result.toLowerCase()).toContain('up to');
    });
  });
  
  describe('softenContent utility', () => {
    it('provides a quick way to soften content', () => {
      const linter = new ClaimsLinter({ knownFacts: [] });
      const content = 'We achieve 95% customer satisfaction.';
      const lintResult = linter.lint(content, 'test.md');
      
      const result = softenContent(content, lintResult);
      
      expect(result.claimsSoftened).toBeGreaterThan(0);
      expect(result.softened).not.toBe(content);
    });
  });
});

describe('Real Landing.tsx Fix', () => {
  it('transforms hardcoded trust score to hedged version', () => {
    const linter = new ClaimsLinter({ knownFacts: [] });
    const softener = new AutoSoftener({ style: 'moderate' });
    
    // Original Landing.tsx content
    const original = `
<p className="text-sm text-gray-500 mb-2">Average Trust Score</p>
<div className="text-6xl font-bold">
  94%
</div>
<p className="text-sm text-gray-500 mt-2">Across all verified contracts</p>
    `;
    
    const lintResult = linter.lint(original, 'Landing.tsx');
    const result = softener.soften(original, lintResult);
    
    expect(result.claimsSoftened).toBeGreaterThan(0);
    
    // The softened version should not have the hardcoded "94%"
    // Instead it should say something like "up to 94%" or "typically around 94%"
    expect(result.softened).not.toBe(original);
  });
});
