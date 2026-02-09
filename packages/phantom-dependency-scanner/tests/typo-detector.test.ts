import { describe, it, expect } from 'vitest';
import { findTypoCandidates } from '../src/typo-detector.js';

describe('Typo Detector', () => {
  it('should find typo candidates', () => {
    const candidates = ['lodash', 'express', 'react', 'typescript'];
    const results = findTypoCandidates('lodahs', candidates, 5, 0.6);

    expect(results.length).toBeGreaterThan(0);
    expect(results).toContain('lodash');
  });

  it('should return empty array for no matches', () => {
    const candidates = ['lodash', 'express', 'react'];
    const results = findTypoCandidates('completelydifferent', candidates, 5, 0.6);

    expect(results.length).toBe(0);
  });

  it('should respect similarity threshold', () => {
    const candidates = ['lodash', 'express', 'react'];
    const results = findTypoCandidates('lodahs', candidates, 5, 0.9); // High threshold

    // Should still find lodash (very similar)
    expect(results.length).toBeGreaterThan(0);
  });
});
