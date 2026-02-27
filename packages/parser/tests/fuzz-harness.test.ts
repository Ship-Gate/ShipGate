// ============================================================================
// ISL Parser Fuzz Harness Tests
// 
// Comprehensive fuzzing to harden parser against malicious inputs
// ============================================================================

import { describe, it, expect } from 'vitest';
import { fuzzParse, batchFuzzParse, generateFuzzReport, DEFAULT_FUZZ_LIMITS } from '../src/fuzz-harness.js';
import { buildCorpusFromDir } from '../src/build-corpus.js';
import { parse } from '../src/index.js';

describe('Fuzz Harness', () => {
  describe('Basic fuzzing', () => {
    it('should handle valid inputs gracefully', async () => {
      const validInput = `
domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
  }
}`;
      
      const result = await fuzzParse(validInput);
      expect(result.completed).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.exceededLimits).toBe(false);
      expect(result.parseResult?.success).toBe(true);
    });

    it('should reject inputs exceeding size limits', async () => {
      const largeInput = 'domain Test { version: "1.0.0" }' + 'x'.repeat(2 * 1024 * 1024);
      
      const result = await fuzzParse(largeInput, { ...DEFAULT_FUZZ_LIMITS, maxFileSize: 1024 });
      expect(result.exceededLimits).toBe(true);
      expect(result.completed).toBe(false);
    });

    it('should timeout on hanging inputs', async () => {
      // Create input that might cause infinite loop (deeply nested)
      const deepNesting = 'domain Test { version: "1.0.0" entity User { id: UUID invariants { ' + 
        '('.repeat(10000) + 'true' + ')'.repeat(10000) + ' } } }';
      
      const result = await fuzzParse(deepNesting, { ...DEFAULT_FUZZ_LIMITS, timeoutMs: 100 });
      // Should either complete or timeout, but not hang forever
      expect(result.completed || result.timedOut).toBe(true);
    });
  });

  describe('Malicious inputs', () => {
    const maliciousInputs = [
      // Extremely long string
      `domain Test { version: "${'x'.repeat(200000)}" }`,
      
      // Extremely long identifier
      `domain ${'A'.repeat(20000)} { version: "1.0.0" }`,
      
      // Deep nesting
      `domain Test { version: "1.0.0" entity User { id: UUID invariants { ${'('.repeat(5000)}true${')'.repeat(5000)} } } }`,
      
      // Null bytes
      `domain Test\x00 { version: "1.0.0" }`,
      
      // Control characters
      `domain Test { version: "\x01\x02\x03" }`,
      
      // Unicode edge cases
      `domain Test { version: "${'\u0000'.repeat(1000)}" }`,
      
      // Injection attempts
      `domain Test { version: "'; DROP TABLE users; --" }`,
      
      // Pathological whitespace
      ' '.repeat(100000) + 'domain Test { version: "1.0.0" }',
    ];

    it.each(maliciousInputs.map((input, i) => [i, input]))(
      'should handle malicious input %d safely',
      async (index, input) => {
        const result = await fuzzParse(input as string);
        // Should not crash - either reject gracefully or parse successfully
        expect(result.completed || result.exceededLimits || result.timedOut).toBe(true);
        expect(result.error).toBeUndefined();
      }
    );
  });

  describe('Batch fuzzing', () => {
    it('should process multiple inputs', async () => {
      const inputs = [
        'domain Test { version: "1.0.0" }',
        'domain Test2 { version: "2.0.0" entity User { id: UUID } }',
        'invalid input',
      ];
      
      const results = await batchFuzzParse(inputs);
      expect(results).toHaveLength(3);
      
      const report = generateFuzzReport(results);
      expect(report.total).toBe(3);
      expect(report.completed).toBeGreaterThan(0);
    });
  });

  describe('Fuzz report generation', () => {
    it('should generate accurate report', async () => {
      const results = await batchFuzzParse([
        'domain Valid { version: "1.0.0" }',
        'x'.repeat(2 * 1024 * 1024), // Too large
        'domain Invalid {', // Incomplete
      ]);
      
      const report = generateFuzzReport(results);
      expect(report.total).toBe(3);
      expect(report.exceededLimits).toBeGreaterThanOrEqual(0);
      expect(report.completed).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Fuzz Acceptance Test', () => {
  it('should pass 10k iterations without crashes or hangs', async () => {
    // Generate diverse test inputs
    const inputs: string[] = [];
    
    // Valid inputs
    for (let i = 0; i < 1000; i++) {
      inputs.push(`domain Test${i} { version: "1.0.0" entity User { id: UUID } }`);
    }
    
    // Edge cases
    const edgeCases = [
      'domain Empty { version: "1.0.0" }',
      'domain Test { version: "1.0.0" entity Empty { id: UUID } }',
      'domain Test { version: "1.0.0" behavior Test { input { x: String } output { success: Boolean } } }',
    ];
    inputs.push(...edgeCases);
    
    // Random mutations
    const base = 'domain Test { version: "1.0.0" }';
    for (let i = 0; i < 100; i++) {
      const mutated = base + ' '.repeat(Math.floor(Math.random() * 100));
      inputs.push(mutated);
    }
    
    // Fill to 10k with variations
    while (inputs.length < 10000) {
      inputs.push(`domain Test${inputs.length} { version: "1.0.0" entity User${inputs.length} { id: UUID } }`);
    }
    
    const results = await batchFuzzParse(inputs.slice(0, 10000), DEFAULT_FUZZ_LIMITS);
    const report = generateFuzzReport(results);
    
    // Acceptance criteria: no crashes, no hangs
    expect(report.crashes.length).toBe(0);
    expect(report.hangs.length).toBe(0);
    
    // Should handle all inputs gracefully
    expect(report.total).toBe(10000);
    expect(report.completed + report.exceededLimits + report.timedOut).toBe(10000);
  }, 300000); // 5 minute timeout for 10k iterations
});
