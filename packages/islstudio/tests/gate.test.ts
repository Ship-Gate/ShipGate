import { describe, it, expect } from 'vitest';
import { runGate, type GateConfig, type GateResult } from '../src/gate.js';
import { loadConfig, PRESETS } from '../src/config.js';
import { formatTerminalOutput, formatJsonOutput } from '../src/formatters.js';
import { generateHtmlReport } from '../src/report.js';

describe('ISL Studio Gate', () => {
  const defaultConfig: GateConfig = PRESETS['startup-default'];

  it('should SHIP clean code', async () => {
    const files = [
      { path: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' }
    ];

    const result = await runGate(files, defaultConfig);

    expect(result.verdict).toBe('SHIP');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.summary.blockers).toBe(0);
  });

  it('should NO_SHIP auth bypass', async () => {
    const files = [
      { 
        path: 'src/auth.ts', 
        content: `
          const skipAuth = req.query.debug === 'true';
          if (skipAuth) return res.json({ token: 'bypass' });
        ` 
      }
    ];

    const result = await runGate(files, defaultConfig);

    expect(result.verdict).toBe('NO_SHIP');
    expect(result.violations.some(v => v.ruleId === 'auth/bypass-detected')).toBe(true);
  });

  it('should NO_SHIP PII in logs', async () => {
    const files = [
      { 
        path: 'src/users.ts', 
        content: `console.log('User email:', user.email);` 
      }
    ];

    const result = await runGate(files, defaultConfig);

    expect(result.verdict).toBe('NO_SHIP');
    expect(result.violations.some(v => v.ruleId.startsWith('pii/'))).toBe(true);
  });

  it('should generate consistent fingerprint', async () => {
    const files = [
      { path: 'test.ts', content: 'const x = 1;' }
    ];

    const result1 = await runGate(files, defaultConfig);
    const result2 = await runGate(files, defaultConfig);

    expect(result1.fingerprint).toBe(result2.fingerprint);
  });
});

// ============================================================================
// JSON Output Stability Tests (for Healer Ingestion)
// ============================================================================

describe('ISL Studio JSON Output Stability', () => {
  const defaultConfig: GateConfig = PRESETS['startup-default'];

  /**
   * Helper to normalize result for snapshot comparison.
   * Removes non-deterministic fields (timestamp).
   */
  function normalizeForSnapshot(result: GateResult): Omit<GateResult, 'timestamp'> & { timestamp: string } {
    return {
      ...result,
      timestamp: '[TIMESTAMP]', // Normalize timestamp for stable snapshots
    };
  }

  it('should include all healer-required fields in JSON output', async () => {
    const files = [
      { path: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' }
    ];

    const result = await runGate(files, defaultConfig);

    // Verify all required fields are present
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('fingerprint');
    expect(result).toHaveProperty('policyBundleVersion');
    expect(result).toHaveProperty('rulepackVersions');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('timestamp');

    // Verify types
    expect(typeof result.verdict).toBe('string');
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(typeof result.fingerprint).toBe('string');
    expect(typeof result.policyBundleVersion).toBe('string');
    expect(Array.isArray(result.rulepackVersions)).toBe(true);
    expect(typeof result.summary).toBe('object');
    expect(typeof result.timestamp).toBe('string');

    // Verify fingerprint is 16 hex chars
    expect(result.fingerprint).toMatch(/^[a-f0-9]{16}$/);

    // Verify rulepack versions structure
    for (const pack of result.rulepackVersions) {
      expect(pack).toHaveProperty('id');
      expect(pack).toHaveProperty('version');
      expect(pack).toHaveProperty('rulesCount');
    }
  });

  it('should produce stable fingerprint for same violations', async () => {
    const filesWithViolation = [
      { 
        path: 'src/auth.ts', 
        content: `const skipAuth = req.query.debug === 'true';` 
      }
    ];

    const result1 = await runGate(filesWithViolation, defaultConfig);
    const result2 = await runGate(filesWithViolation, defaultConfig);

    // Same violations should produce same fingerprint
    expect(result1.fingerprint).toBe(result2.fingerprint);
    expect(result1.violations.length).toBe(result2.violations.length);
  });

  it('should produce different fingerprint for different violations', async () => {
    const files1 = [
      { path: 'src/auth.ts', content: `const skipAuth = req.query.debug === 'true';` }
    ];
    const files2 = [
      { path: 'src/users.ts', content: `console.log('User email:', user.email);` }
    ];

    const result1 = await runGate(files1, defaultConfig);
    const result2 = await runGate(files2, defaultConfig);

    // Different violations should produce different fingerprint
    expect(result1.fingerprint).not.toBe(result2.fingerprint);
  });

  it('should produce same fingerprint regardless of file content changes (violations same)', async () => {
    // Two different files that trigger the same violation at the same location
    const files1 = [
      { path: 'src/auth.ts', content: `const skipAuth = req.query.debug === 'true'; // v1` }
    ];
    const files2 = [
      { path: 'src/auth.ts', content: `const skipAuth = req.query.debug === 'true'; // v2 with more comments` }
    ];

    const result1 = await runGate(files1, defaultConfig);
    const result2 = await runGate(files2, defaultConfig);

    // Same violation type/location should produce same fingerprint
    // (fingerprint is based on violations, not file content)
    expect(result1.violations.length).toBe(result2.violations.length);
    if (result1.violations.length > 0 && result2.violations.length > 0) {
      expect(result1.violations[0].ruleId).toBe(result2.violations[0].ruleId);
      expect(result1.fingerprint).toBe(result2.fingerprint);
    }
  });

  it('JSON output should match snapshot structure for clean code', async () => {
    const files = [
      { path: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' }
    ];

    const result = await runGate(files, defaultConfig);
    const normalized = normalizeForSnapshot(result);
    const jsonOutput = JSON.parse(formatJsonOutput(result));

    // Snapshot test for structure (timestamp normalized)
    expect(normalized).toMatchSnapshot('clean-code-gate-result');
  });

  it('JSON output should match snapshot structure for violations', async () => {
    const files = [
      { 
        path: 'src/auth.ts', 
        content: `const skipAuth = req.query.debug === 'true';` 
      }
    ];

    const result = await runGate(files, defaultConfig);
    const normalized = normalizeForSnapshot(result);

    // Snapshot test for structure (timestamp normalized)
    expect(normalized).toMatchSnapshot('violation-gate-result');
  });

  it('should output valid JSON that can be parsed', async () => {
    const files = [
      { path: 'src/auth.ts', content: `const skipAuth = req.query.debug === 'true';` }
    ];

    const result = await runGate(files, defaultConfig);
    const jsonString = formatJsonOutput(result);

    // Must be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();

    // Parse and verify structure
    const parsed = JSON.parse(jsonString);
    expect(parsed.verdict).toBe('NO_SHIP');
    expect(parsed.fingerprint).toBe(result.fingerprint);
    expect(parsed.policyBundleVersion).toBe(result.policyBundleVersion);
  });

  it('violations should be sorted deterministically', async () => {
    // Multiple files with violations - should always come out in same order
    const files = [
      { path: 'src/z-file.ts', content: `const skipAuth = req.query.debug === 'true';` },
      { path: 'src/a-file.ts', content: `console.log('User email:', user.email);` },
    ];

    const result1 = await runGate(files, defaultConfig);
    const result2 = await runGate(files, defaultConfig);

    // Violations should be in same order
    expect(result1.violations.map(v => v.filePath)).toEqual(
      result2.violations.map(v => v.filePath)
    );
    expect(result1.violations.map(v => v.ruleId)).toEqual(
      result2.violations.map(v => v.ruleId)
    );
  });
});

describe('ISL Studio Config', () => {
  it('should have all presets defined', () => {
    expect(PRESETS['startup-default']).toBeDefined();
    expect(PRESETS['strict-security']).toBeDefined();
    expect(PRESETS['payments-heavy']).toBeDefined();
    expect(PRESETS['privacy-heavy']).toBeDefined();
    expect(PRESETS['agent-mode']).toBeDefined();
  });

  it('should disable payments in startup-default', () => {
    const config = PRESETS['startup-default'];
    expect(config.packs?.payments?.enabled).toBe(false);
  });
});

describe('ISL Studio Formatters', () => {
  const mockResult = {
    verdict: 'NO_SHIP' as const,
    score: 50,
    violations: [
      { 
        ruleId: 'auth/bypass-detected', 
        message: 'Auth bypass found', 
        tier: 'hard_block' as const,
        filePath: 'src/auth.ts'
      }
    ],
    fingerprint: 'abc123',
    summary: { filesChecked: 1, blockers: 1, warnings: 0 }
  };

  it('should format terminal output', () => {
    const output = formatTerminalOutput(mockResult);
    
    expect(output).toContain('NO_SHIP');
    expect(output).toContain('auth/bypass-detected');
    expect(output).toContain('abc123');
  });

  it('should format JSON output', () => {
    const output = formatJsonOutput(mockResult);
    const parsed = JSON.parse(output);
    
    expect(parsed.verdict).toBe('NO_SHIP');
    expect(parsed.violations).toHaveLength(1);
  });

  it('should generate HTML report', () => {
    const html = generateHtmlReport(mockResult, 'Test Project');
    
    expect(html).toContain('NO_SHIP');
    expect(html).toContain('auth/bypass-detected');
    expect(html).toContain('Test Project');
    expect(html).toContain('abc123');
  });
});
