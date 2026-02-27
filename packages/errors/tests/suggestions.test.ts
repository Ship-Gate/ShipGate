// ============================================================================
// Tests for Error Suggestions
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  damerauLevenshteinDistance,
  findSimilar,
  suggestKeyword,
  suggestType,
  suggestField,
  formatDidYouMean,
  formatDidYouMeanMultiple,
  getContextualHelp,
} from '../src/index.js';

describe('Levenshtein Distance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns correct distance for simple edits', () => {
    expect(levenshteinDistance('cat', 'car')).toBe(1);    // substitution
    expect(levenshteinDistance('cat', 'cats')).toBe(1);   // insertion
    expect(levenshteinDistance('cats', 'cat')).toBe(1);   // deletion
  });

  it('handles empty strings', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', '')).toBe(0);
  });
});

describe('Damerau-Levenshtein Distance', () => {
  it('detects transpositions', () => {
    // 'teh' -> 'the' is 1 transposition
    expect(damerauLevenshteinDistance('teh', 'the')).toBe(1);
    expect(damerauLevenshteinDistance('entiy', 'entity')).toBeLessThanOrEqual(2);
  });
});

describe('findSimilar', () => {
  it('finds close matches', () => {
    const candidates = ['entity', 'behavior', 'domain', 'type'];
    const results = findSimilar('entiy', candidates);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.value).toBe('entity');
  });

  it('respects maxDistance', () => {
    const candidates = ['entity', 'behavior'];
    const results = findSimilar('xyz', candidates, { maxDistance: 1 });
    expect(results).toHaveLength(0);
  });

  it('returns empty for exact match', () => {
    const results = findSimilar('entity', ['entity'], { maxDistance: 3 });
    // Exact matches have distance 0, which is filtered out (distance > 0)
    expect(results).toHaveLength(0);
  });

  it('sorts by distance', () => {
    const candidates = ['String', 'Strong', 'Streaming'];
    const results = findSimilar('Strng', candidates);
    expect(results[0]!.value).toBe('String');
  });
});

describe('ISL Keyword Suggestions', () => {
  it('suggests "behavior" for "behaviour"', () => {
    const suggestions = suggestKeyword('behaviour');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('behavior');
  });

  it('suggests "entity" for "entiy"', () => {
    const suggestions = suggestKeyword('entiy');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('entity');
  });

  it('suggests "postconditions" for "postcondtion"', () => {
    const suggestions = suggestKeyword('postcondtion');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('postconditions');
  });

  it('suggests "domain" for "doamin"', () => {
    const suggestions = suggestKeyword('doamin');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('domain');
  });
});

describe('ISL Type Suggestions', () => {
  it('suggests "UUID" for "UUI"', () => {
    // suggestType uses caseInsensitive: false, so case-only changes
    // have high distance. Test with a real typo instead.
    const suggestions = suggestType('UUI');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('UUID');
  });

  it('suggests "String" for "Strng"', () => {
    const suggestions = suggestType('Strng');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('String');
  });

  it('suggests "Email" for "Emal"', () => {
    const suggestions = suggestType('Emal');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('Email');
  });

  it('includes custom types in suggestions', () => {
    const suggestions = suggestType('UserRol', ['UserRole', 'AdminRole']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('UserRole');
  });
});

describe('Field Suggestions', () => {
  it('suggests "balance" for "balace"', () => {
    const suggestions = suggestField('balace', ['balance', 'name', 'email']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('balance');
  });

  it('suggests "email" for "emial"', () => {
    const suggestions = suggestField('emial', ['id', 'email', 'name', 'age']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.value).toBe('email');
  });
});

describe('formatDidYouMean', () => {
  it('formats single suggestion', () => {
    expect(formatDidYouMean('entiy', 'entity')).toBe("Did you mean 'entity'?");
  });
});

describe('formatDidYouMeanMultiple', () => {
  it('formats single suggestion', () => {
    expect(formatDidYouMeanMultiple('foo', ['bar'])).toBe("Did you mean 'bar'?");
  });

  it('formats multiple suggestions', () => {
    const result = formatDidYouMeanMultiple('foo', ['bar', 'baz', 'bat']);
    expect(result).toContain('bar');
    expect(result).toContain('bat');
  });

  it('returns empty for no suggestions', () => {
    expect(formatDidYouMeanMultiple('foo', [])).toBe('');
  });
});

describe('Contextual Help', () => {
  it('provides help for missing colon error', () => {
    // The pattern matches message.includes("expected ':'") (lowercase)
    const helps = getContextualHelp('E0101', "expected ':'", {});
    expect(helps.length).toBeGreaterThan(0);
    expect(helps[0]).toContain('colon');
  });

  it('provides help for unclosed block', () => {
    const helps = getContextualHelp('E0105', "Missing }", {});
    expect(helps.length).toBeGreaterThan(0);
  });

  it('provides help for old() in precondition', () => {
    const helps = getContextualHelp('E0304', "old() invalid", {});
    expect(helps.length).toBeGreaterThan(0);
    expect(helps[0]).toContain('postcondition');
  });
});
