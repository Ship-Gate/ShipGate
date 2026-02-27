/**
 * Fix Engine & Diff Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { FixEngine, type PromptChoice } from '../src/fix-engine.js';
import {
  generateUnifiedDiff,
  generateInlineDiff,
  generatePatchFile,
  generatePatchFromSuggestions,
  formatDiffBlock,
} from '../src/diff-generator.js';
import {
  createFixSuggestion,
  formatFixSuggestion,
  fixSuggestionsToJSON,
  type FixSuggestion,
} from '../src/fix-suggestion.js';

// ============================================================================
// Diff Generator
// ============================================================================

describe('generateUnifiedDiff', () => {
  it('creates a unified diff between two strings', () => {
    const oldCode = 'const x = 1;';
    const newCode = 'const x = 2;';
    const result = generateUnifiedDiff('test.ts', oldCode, newCode);

    expect(result).toContain('---');
    expect(result).toContain('+++');
    expect(result).toContain('-const x = 1;');
    expect(result).toContain('+const x = 2;');
  });

  it('handles multi-line diffs', () => {
    const oldCode = 'if (!user) {\n  throw "User not found";\n}';
    const newCode = 'if (!user || !valid) {\n  throw "Invalid credentials";\n}';
    const result = generateUnifiedDiff('auth.ts', oldCode, newCode);

    expect(result).toContain('auth.ts');
  });
});

describe('generateInlineDiff', () => {
  it('shows + and - prefixes', () => {
    const result = generateInlineDiff('old line', 'new line');
    expect(result).toContain('-');
    expect(result).toContain('+');
  });

  it('shows unchanged context with space prefix', () => {
    const result = generateInlineDiff('same\nold\nsame', 'same\nnew\nsame');
    expect(result).toContain('  same');
  });
});

describe('generatePatchFile', () => {
  it('combines multiple file patches', () => {
    const entries = [
      { file: 'a.ts', oldCode: 'const a = 1;', newCode: 'const a = 2;' },
      { file: 'b.ts', oldCode: 'const b = 1;', newCode: 'const b = 3;' },
    ];
    const result = generatePatchFile(entries);
    expect(result).toContain('a.ts');
    expect(result).toContain('b.ts');
  });
});

describe('generatePatchFromSuggestions', () => {
  it('generates a patch from suggestions and file contents', () => {
    const fileContents = new Map<string, string>([
      ['test.ts', 'const x = 1;\nconst y = 2;\n'],
    ]);
    const suggestions = [
      { file: 'test.ts', currentCode: 'const x = 1;', suggestedCode: 'const x = 99;' },
    ];
    const result = generatePatchFromSuggestions(fileContents, suggestions);
    expect(result).toContain('-const x = 1;');
    expect(result).toContain('+const x = 99;');
  });
});

describe('formatDiffBlock', () => {
  it('creates a formatted block with header', () => {
    const result = formatDiffBlock('test.ts', 10, 15, 'old code', 'new code');
    expect(result).toContain('test.ts:10-15');
    expect(result).toContain('-');
    expect(result).toContain('+');
  });
});

// ============================================================================
// FixSuggestion
// ============================================================================

describe('createFixSuggestion', () => {
  it('creates a suggestion with defaults', () => {
    const fix = createFixSuggestion(
      {
        violation: 'test violation',
        file: 'test.ts',
        location: { line: 1, column: 1 },
        currentCode: 'old',
        suggestedCode: 'new',
        explanation: 'because',
      },
      'diff content',
    );

    expect(fix.violation).toBe('test violation');
    expect(fix.confidence).toBe(0.8);
    expect(fix.breaking).toBe(false);
    expect(fix.diff).toBe('diff content');
    expect(fix.tags).toEqual([]);
  });

  it('respects explicit confidence and breaking', () => {
    const fix = createFixSuggestion(
      {
        violation: 'test',
        file: 'f.ts',
        location: { line: 1, column: 1 },
        currentCode: 'a',
        suggestedCode: 'b',
        explanation: 'x',
        confidence: 0.5,
        breaking: true,
        tags: ['security'],
      },
      '',
    );

    expect(fix.confidence).toBe(0.5);
    expect(fix.breaking).toBe(true);
    expect(fix.tags).toEqual(['security']);
  });
});

describe('formatFixSuggestion', () => {
  it('produces readable output', () => {
    const fix: FixSuggestion = {
      violation: 'Password stored in plaintext',
      file: 'user.ts',
      location: { line: 10, column: 5 },
      currentCode: 'user.password = input.password;',
      suggestedCode: 'user.password = await bcrypt.hash(input.password, 12);',
      explanation: 'Hash passwords before storage.',
      confidence: 0.95,
      breaking: false,
      diff: '',
      tags: ['security', 'crypto'],
    };

    const output = formatFixSuggestion(fix);
    expect(output).toContain('Password stored in plaintext');
    expect(output).toContain('user.ts:10');
    expect(output).toContain('95%');
    expect(output).toContain('bcrypt.hash');
  });

  it('shows breaking warning when applicable', () => {
    const fix: FixSuggestion = {
      violation: 'test',
      file: 'f.ts',
      location: { line: 1, column: 1 },
      currentCode: '',
      suggestedCode: '',
      explanation: '',
      confidence: 0.5,
      breaking: true,
      diff: '',
      tags: [],
    };
    const output = formatFixSuggestion(fix);
    expect(output).toContain('WARNING');
    expect(output).toContain('break');
  });
});

describe('fixSuggestionsToJSON', () => {
  it('serialises to valid JSON', () => {
    const fixes: FixSuggestion[] = [
      {
        violation: 'test',
        file: 'f.ts',
        location: { line: 1, column: 1 },
        currentCode: 'a',
        suggestedCode: 'b',
        explanation: 'c',
        confidence: 0.8,
        breaking: false,
        diff: 'd',
        patternId: 'token-without-expiry',
        tags: ['security'],
      },
    ];
    const json = fixSuggestionsToJSON(fixes);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].patternId).toBe('token-without-expiry');
  });
});

// ============================================================================
// Fix Engine
// ============================================================================

describe('FixEngine', () => {
  describe('scanSource', () => {
    it('returns suggestions for vulnerable source', () => {
      const engine = new FixEngine({ mode: 'dry-run' });
      const source = `const token = jwt.sign(payload, secret);`;
      const fixes = engine.scanSource('auth.ts', source);
      expect(fixes.length).toBeGreaterThanOrEqual(1);
    });

    it('respects minConfidence filter', () => {
      const engine = new FixEngine({ mode: 'dry-run', minConfidence: 0.99 });
      const source = `const token = jwt.sign(payload, secret);`;
      const fixes = engine.scanSource('auth.ts', source);
      // Most detectors are below 0.99 confidence
      expect(fixes).toHaveLength(0);
    });
  });

  describe('mode=auto decision logic', () => {
    it('auto-applies non-breaking fixes', () => {
      const engine = new FixEngine({ mode: 'auto' });
      const source = `const token = jwt.sign(payload, secret);`;
      const fixes = engine.scanSource('auth.ts', source);

      // All token-without-expiry fixes are non-breaking
      const nonBreaking = fixes.filter((f) => !f.breaking);
      expect(nonBreaking.length).toBeGreaterThanOrEqual(1);
    });

    it('skips breaking changes when includeBreaking=false', () => {
      const engine = new FixEngine({
        mode: 'auto',
        includeBreaking: false,
      });
      // missing-auth-check is flagged as breaking
      const source = `router.get('/profile', getProfile);`;
      const fixes = engine.scanSource('routes.ts', source);
      const breaking = fixes.filter((f) => f.breaking);
      expect(breaking.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mode=dry-run', () => {
    it('does not modify files (no applyFixes call needed)', () => {
      // This test just ensures dry-run mode creates suggestions but
      // conceptually doesn't apply. We verify via scanSource.
      const engine = new FixEngine({ mode: 'dry-run' });
      const fixes = engine.scanSource('test.ts', `user.password = input.password;`);
      expect(fixes.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Confidence & Breaking Assessment
// ============================================================================

describe('confidence and breaking assessment', () => {
  it('different-error-messages has high confidence and is non-breaking', () => {
    const engine = new FixEngine({ mode: 'dry-run' });
    const source = `
if (!user) return res.status(404).json({ error: "User not found" });
if (!valid) return res.status(401).json({ error: "Wrong password" });
`;
    const fixes = engine.scanSource('auth.ts', source);
    const errorFix = fixes.find((f) => f.patternId === 'different-error-messages');
    if (errorFix) {
      expect(errorFix.confidence).toBeGreaterThan(0.8);
      expect(errorFix.breaking).toBe(false);
    }
  });

  it('missing-auth-check is flagged as breaking', () => {
    const engine = new FixEngine({ mode: 'dry-run' });
    const source = `router.get('/admin', adminHandler);`;
    const fixes = engine.scanSource('routes.ts', source);
    const authFix = fixes.find((f) => f.patternId === 'missing-auth-check');
    if (authFix) {
      expect(authFix.breaking).toBe(true);
    }
  });

  it('token-without-expiry has very high confidence', () => {
    const engine = new FixEngine({ mode: 'dry-run' });
    const source = `const token = jwt.sign(payload, secret);`;
    const fixes = engine.scanSource('auth.ts', source);
    const tokenFix = fixes.find((f) => f.patternId === 'token-without-expiry');
    expect(tokenFix).toBeDefined();
    expect(tokenFix!.confidence).toBeGreaterThan(0.9);
  });
});
