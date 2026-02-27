/**
 * Specless Adapter Tests
 *
 * Validates that each adapter:
 * 1. Registers with the specless registry
 * 2. Produces valid GateEvidence
 * 3. Maps scanner findings to correct check names, results, and confidence
 * 4. Gracefully handles unavailable scanners (returns 'skip')
 * 5. Returns 'pass' evidence when no findings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  registerSpeclessCheck,
  clearSpeclessChecks,
  getSpeclessChecks,
} from '../src/authoritative/index.js';

import type {
  GateEvidence,
  GateContext,
} from '../src/authoritative/index.js';

// ============================================================================
// Top-level mocks — hoisted by Vitest before module resolution
// ============================================================================

// Mock @isl-lang/security-scanner so Vite doesn't try to resolve the real
// package (which may not have a built dist/ directory).
const mockScanSource = vi.fn().mockReturnValue([]);
vi.mock('@isl-lang/security-scanner', () => ({
  scanSource: mockScanSource,
  default: { scanSource: mockScanSource },
}));

// Mock @isl-lang/hallucination-scanner
const mockScanGoFile = vi.fn().mockResolvedValue({ imports: [], findings: [] });
const mockScanRustFile = vi.fn().mockResolvedValue({ uses: [], externalCrates: new Set(), checkResult: undefined });
vi.mock('@isl-lang/hallucination-scanner', () => ({
  scanGoFile: mockScanGoFile,
  scanRustFile: mockScanRustFile,
}));

// Mock @isl-lang/firewall
const mockRunHostScan = vi.fn().mockResolvedValue({
  scanner: 'host', verdict: 'SHIP', score: 100, filesChecked: 0,
  violations: 0, hardBlocks: 0, softBlocks: 0, warnings: 0, results: [],
});
const mockRunRealityGapScan = vi.fn().mockResolvedValue({
  scanner: 'reality-gap', verdict: 'SHIP', score: 100, filesChecked: 0,
  violations: 0, hardBlocks: 0, softBlocks: 0, warnings: 0, results: [],
});
vi.mock('@isl-lang/firewall', () => ({
  runHostScan: mockRunHostScan,
  runRealityGapScan: mockRunRealityGapScan,
}));

// ============================================================================
// Helpers
// ============================================================================

function makeContext(overrides: Partial<GateContext> = {}): GateContext {
  return {
    projectRoot: '/tmp/test-project',
    implementation: 'const x = 1;',
    specOptional: true,
    ...overrides,
  };
}

/**
 * Validate shape of a GateEvidence object.
 */
function assertValidEvidence(e: GateEvidence): void {
  expect(e).toHaveProperty('source');
  expect(e).toHaveProperty('check');
  expect(e).toHaveProperty('result');
  expect(e).toHaveProperty('confidence');
  expect(e).toHaveProperty('details');
  expect(['isl-spec', 'static-analysis', 'runtime-eval', 'specless-scanner']).toContain(e.source);
  expect(['pass', 'fail', 'warn', 'skip']).toContain(e.result);
  expect(e.confidence).toBeGreaterThanOrEqual(0);
  expect(e.confidence).toBeLessThanOrEqual(1);
  expect(typeof e.check).toBe('string');
  expect(typeof e.details).toBe('string');
}

// ============================================================================
// 1. Hallucination Adapter
// ============================================================================

describe('Hallucination Adapter', () => {
  beforeEach(() => {
    clearSpeclessChecks();
    vi.clearAllMocks();
  });

  it('auto-registers with the specless registry on import', async () => {
    await import('../src/specless/hallucination-adapter.js');
    const checks = getSpeclessChecks();
    expect(checks.some(c => c.name === 'hallucination-detector')).toBe(true);
  });

  it('skips non-Go/Rust files silently', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');
    const result = await hallucinationCheck.run('src/app.ts', makeContext());
    expect(result).toHaveLength(0);
  });

  it('skips .py files silently', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');
    const result = await hallucinationCheck.run('script.py', makeContext());
    expect(result).toHaveLength(0);
  });

  it('produces valid GateEvidence shape for Go findings', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');

    mockScanGoFile.mockResolvedValueOnce({
      imports: [],
      findings: [
        {
          kind: 'missing_module',
          message: 'Module github.com/nonexistent/pkg not found in go.mod',
          importPath: 'github.com/nonexistent/pkg',
          location: { file: 'main.go', line: 5, column: 1 },
        },
        {
          kind: 'fake_package',
          message: 'Package github.com/fake/lib does not exist',
          importPath: 'github.com/fake/lib',
          location: { file: 'main.go', line: 8, column: 1 },
          suggestion: 'Did you mean github.com/real/lib?',
        },
      ],
    });

    const result = await hallucinationCheck.run('main.go', makeContext({
      implementation: 'package main\nimport "github.com/nonexistent/pkg"',
    }));

    expect(result).toHaveLength(2);
    for (const e of result) {
      assertValidEvidence(e);
      expect(e.source).toBe('specless-scanner');
    }
  });

  it('produces valid GateEvidence shape for Rust findings', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');

    mockScanRustFile.mockResolvedValueOnce({
      uses: [],
      externalCrates: new Set(['serde']),
      checkResult: {
        findings: [
          {
            kind: 'missing_crate',
            message: 'Crate "nonexistent" not found in Cargo.toml',
            crate: 'nonexistent',
            location: { file: 'src/main.rs', line: 3, column: 5 },
          },
        ],
      },
    });

    const result = await hallucinationCheck.run('src/main.rs', makeContext({
      implementation: 'use nonexistent::something;',
    }));

    expect(result).toHaveLength(1);
    for (const e of result) {
      assertValidEvidence(e);
      expect(e.source).toBe('specless-scanner');
    }
  });

  it('returns pass evidence when no Go findings', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');

    mockScanGoFile.mockResolvedValueOnce({ imports: [], findings: [] });

    const result = await hallucinationCheck.run('main.go', makeContext());
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].result).toBe('pass');
    assertValidEvidence(result[0]);
  });

  it('maps fake_package to fake_feature_detected check name with fail result', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');

    mockScanGoFile.mockResolvedValueOnce({
      imports: [],
      findings: [{
        kind: 'fake_package',
        message: 'Package does not exist',
        importPath: 'github.com/fake/pkg',
        location: { file: 'main.go', line: 3, column: 1 },
      }],
    });

    const result = await hallucinationCheck.run('main.go', makeContext());
    expect(result[0].check).toContain('fake_feature_detected');
    expect(result[0].result).toBe('fail');
  });

  it('maps fake_module in Rust to fake_feature_detected check name', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');

    mockScanRustFile.mockResolvedValueOnce({
      uses: [],
      externalCrates: new Set(),
      checkResult: {
        findings: [{
          kind: 'fake_module',
          message: 'Module does not exist',
          path: 'nonexistent',
          location: { file: 'src/main.rs', line: 1, column: 1 },
        }],
      },
    });

    const result = await hallucinationCheck.run('src/main.rs', makeContext());
    expect(result[0].check).toContain('fake_feature_detected');
    expect(result[0].result).toBe('fail');
  });

  it('confidence is 0.90 for all hallucination findings', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');

    mockScanGoFile.mockResolvedValueOnce({
      imports: [],
      findings: [{
        kind: 'missing_module',
        message: 'Missing',
        importPath: 'github.com/missing/pkg',
        location: { file: 'main.go', line: 1, column: 1 },
      }],
    });

    const result = await hallucinationCheck.run('main.go', makeContext());
    expect(result[0].confidence).toBe(0.90);
  });
});

// ============================================================================
// 2. Security Adapter
// ============================================================================

describe('Security Adapter', () => {
  beforeEach(() => {
    clearSpeclessChecks();
    vi.clearAllMocks();
  });

  it('auto-registers with the specless registry on import', async () => {
    await import('../src/specless/security-adapter.js');
    const checks = getSpeclessChecks();
    expect(checks.some(c => c.name === 'security-vulnerability-scanner')).toBe(true);
  });

  it('skips unsupported file types silently', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');
    const result = await securityCheck.run('data.json', makeContext());
    expect(result).toHaveLength(0);
  });

  it('skips .go files (handled by hallucination adapter)', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');
    const result = await securityCheck.run('main.go', makeContext());
    expect(result).toHaveLength(0);
  });

  it('produces valid GateEvidence for security findings', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');

    mockScanSource.mockReturnValueOnce([
      {
        id: 'SEC009',
        title: 'Hardcoded Secrets',
        severity: 'critical',
        category: 'secrets',
        description: 'Hardcoded API key detected',
        recommendation: 'Use environment variables',
        location: { file: 'app.ts', startLine: 10 },
      },
      {
        id: 'SEC003',
        title: 'Sensitive Data in Logs',
        severity: 'medium',
        category: 'logging',
        description: 'PII logged to console',
        recommendation: 'Redact sensitive fields',
        location: { file: 'app.ts', startLine: 25 },
      },
    ]);

    const result = await securityCheck.run('app.ts', makeContext({
      implementation: 'const apiKey = "sk-1234"; console.log(user.email);',
    }));

    expect(result).toHaveLength(2);
    for (const e of result) {
      assertValidEvidence(e);
      expect(e.source).toBe('specless-scanner');
    }
  });

  it('maps critical severity to security_violation check name with fail result', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');

    mockScanSource.mockReturnValueOnce([{
      id: 'SEC009',
      title: 'Hardcoded Secrets',
      severity: 'critical',
      category: 'secrets',
      description: 'Hardcoded key',
      recommendation: 'Use env vars',
      location: { file: 'app.ts', startLine: 1 },
    }]);

    const result = await securityCheck.run('app.ts', makeContext());
    expect(result[0].check).toContain('security_violation');
    expect(result[0].result).toBe('fail');
    expect(result[0].confidence).toBe(0.95);
  });

  it('maps high severity to fail result', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');

    mockScanSource.mockReturnValueOnce([{
      id: 'SEC001',
      title: 'Missing Authentication',
      severity: 'high',
      category: 'authentication',
      description: 'No auth',
      recommendation: 'Add auth',
      location: { file: 'app.ts', startLine: 5 },
    }]);

    const result = await securityCheck.run('app.ts', makeContext());
    expect(result[0].result).toBe('fail');
    expect(result[0].confidence).toBe(0.85);
  });

  it('maps medium severity to warn result', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');

    mockScanSource.mockReturnValueOnce([{
      id: 'SEC005',
      title: 'Weak Constraints',
      severity: 'medium',
      category: 'input-validation',
      description: 'Missing input validation',
      recommendation: 'Add validation',
      location: { file: 'app.ts', startLine: 5 },
    }]);

    const result = await securityCheck.run('app.ts', makeContext());
    expect(result[0].result).toBe('warn');
    expect(result[0].confidence).toBe(0.70);
  });

  it('returns pass evidence when no security findings', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');

    mockScanSource.mockReturnValueOnce([]);

    const result = await securityCheck.run('clean.ts', makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe('pass');
    assertValidEvidence(result[0]);
  });

  it('detects TS, JS, and Python files', async () => {
    const { securityCheck } = await import('../src/specless/security-adapter.js');

    for (const ext of ['app.ts', 'app.tsx', 'app.js', 'app.jsx', 'app.mjs', 'script.py']) {
      mockScanSource.mockReturnValueOnce([]);
      const result = await securityCheck.run(ext, makeContext());
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].result).not.toBe('skip');
    }
  });
});

// ============================================================================
// 3. Firewall Host Adapter
// ============================================================================

describe('Firewall Host Adapter', () => {
  beforeEach(() => {
    clearSpeclessChecks();
    vi.clearAllMocks();
  });

  it('auto-registers with the specless registry on import', async () => {
    await import('../src/specless/firewall-adapter.js');
    const checks = getSpeclessChecks();
    expect(checks.some(c => c.name === 'firewall-host-scanner')).toBe(true);
    expect(checks.some(c => c.name === 'firewall-reality-gap-scanner')).toBe(true);
  });

  it('produces valid GateEvidence for host violations', async () => {
    const { firewallHostCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunHostScan.mockResolvedValueOnce({
      scanner: 'host',
      verdict: 'NO_SHIP',
      score: 50,
      filesChecked: 1,
      violations: 2,
      hardBlocks: 1,
      softBlocks: 1,
      warnings: 0,
      results: [{
        file: 'app.ts',
        verdict: 'NO_SHIP',
        violations: [
          {
            rule: 'ghost-route',
            message: 'Route /api/nonexistent referenced but not in truthpack',
            severity: 'critical',
            tier: 'hard_block',
            suggestion: 'Remove the ghost route or add it to your API',
          },
          {
            rule: 'ghost-env',
            message: 'Env var FAKE_API_KEY used but not declared',
            severity: 'medium',
            tier: 'soft_block',
            suggestion: 'Add to .env or remove reference',
          },
        ],
      }],
    });

    const result = await firewallHostCheck.run('app.ts', makeContext());
    expect(result).toHaveLength(2);
    for (const e of result) {
      assertValidEvidence(e);
      expect(e.source).toBe('specless-scanner');
    }
  });

  it('maps hard_block to security_violation and fail', async () => {
    const { firewallHostCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunHostScan.mockResolvedValueOnce({
      scanner: 'host',
      verdict: 'NO_SHIP',
      score: 75,
      filesChecked: 1,
      violations: 1,
      hardBlocks: 1,
      softBlocks: 0,
      warnings: 0,
      results: [{
        file: 'app.ts',
        verdict: 'NO_SHIP',
        violations: [{
          rule: 'ghost-import',
          message: 'Import of nonexistent module',
          severity: 'critical',
          tier: 'hard_block',
        }],
      }],
    });

    const result = await firewallHostCheck.run('app.ts', makeContext());
    expect(result[0].check).toContain('security_violation');
    expect(result[0].result).toBe('fail');
    expect(result[0].confidence).toBe(0.95);
  });

  it('maps soft_block to warn result', async () => {
    const { firewallHostCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunHostScan.mockResolvedValueOnce({
      scanner: 'host',
      verdict: 'SHIP',
      score: 90,
      filesChecked: 1,
      violations: 1,
      hardBlocks: 0,
      softBlocks: 1,
      warnings: 0,
      results: [{
        file: 'app.ts',
        verdict: 'SHIP',
        violations: [{
          rule: 'ghost-env',
          message: 'Unused env var reference',
          severity: 'medium',
          tier: 'soft_block',
        }],
      }],
    });

    const result = await firewallHostCheck.run('app.ts', makeContext());
    expect(result[0].result).toBe('warn');
    expect(result[0].confidence).toBe(0.80);
  });

  it('returns pass evidence when no host violations', async () => {
    const { firewallHostCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunHostScan.mockResolvedValueOnce({
      scanner: 'host',
      verdict: 'SHIP',
      score: 100,
      filesChecked: 1,
      violations: 0,
      hardBlocks: 0,
      softBlocks: 0,
      warnings: 0,
      results: [{
        file: 'app.ts',
        verdict: 'SHIP',
        violations: [],
      }],
    });

    const result = await firewallHostCheck.run('app.ts', makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe('pass');
    assertValidEvidence(result[0]);
  });
});

// ============================================================================
// 4. Firewall Reality-Gap Adapter
// ============================================================================

describe('Firewall Reality-Gap Adapter', () => {
  beforeEach(() => {
    clearSpeclessChecks();
    vi.clearAllMocks();
  });

  it('produces valid GateEvidence for reality-gap violations', async () => {
    const { firewallRealityGapCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunRealityGapScan.mockResolvedValueOnce({
      scanner: 'reality-gap',
      verdict: 'NO_SHIP',
      score: 60,
      filesChecked: 1,
      violations: 1,
      hardBlocks: 0,
      softBlocks: 1,
      warnings: 0,
      results: [{
        file: 'api/handler.ts',
        verdict: 'SHIP',
        violations: [{
          rule: 'auth-check-missing',
          message: 'Handler lacks authentication check',
          severity: 'high',
          tier: 'soft_block',
          suggestion: 'Add auth middleware',
        }],
      }],
    });

    const result = await firewallRealityGapCheck.run('api/handler.ts', makeContext());
    expect(result).toHaveLength(1);
    assertValidEvidence(result[0]);
    expect(result[0].result).toBe('warn');
    expect(result[0].confidence).toBe(0.80);
  });

  it('maps hard_block to security_violation', async () => {
    const { firewallRealityGapCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunRealityGapScan.mockResolvedValueOnce({
      scanner: 'reality-gap',
      verdict: 'NO_SHIP',
      score: 0,
      filesChecked: 1,
      violations: 1,
      hardBlocks: 1,
      softBlocks: 0,
      warnings: 0,
      results: [{
        file: 'api/handler.ts',
        verdict: 'NO_SHIP',
        violations: [{
          rule: 'auth-bypass',
          message: 'Authentication completely bypassed',
          severity: 'critical',
          tier: 'hard_block',
        }],
      }],
    });

    const result = await firewallRealityGapCheck.run('api/handler.ts', makeContext());
    expect(result[0].check).toContain('security_violation');
    expect(result[0].result).toBe('fail');
  });

  it('returns pass evidence when no reality-gap violations', async () => {
    const { firewallRealityGapCheck } = await import('../src/specless/firewall-adapter.js');

    mockRunRealityGapScan.mockResolvedValueOnce({
      scanner: 'reality-gap',
      verdict: 'SHIP',
      score: 100,
      filesChecked: 1,
      violations: 0,
      hardBlocks: 0,
      softBlocks: 0,
      warnings: 0,
      results: [{
        file: 'api/handler.ts',
        verdict: 'SHIP',
        violations: [],
      }],
    });

    const result = await firewallRealityGapCheck.run('api/handler.ts', makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe('pass');
    assertValidEvidence(result[0]);
  });
});

// ============================================================================
// 5. Barrel Registration
// ============================================================================

describe('Specless Barrel', () => {
  it('all four check objects have valid name and run function', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');
    const { securityCheck } = await import('../src/specless/security-adapter.js');
    const { firewallHostCheck, firewallRealityGapCheck } = await import('../src/specless/firewall-adapter.js');

    const checks = [hallucinationCheck, securityCheck, firewallHostCheck, firewallRealityGapCheck];
    const names = checks.map(c => c.name);

    expect(names).toContain('hallucination-detector');
    expect(names).toContain('security-vulnerability-scanner');
    expect(names).toContain('firewall-host-scanner');
    expect(names).toContain('firewall-reality-gap-scanner');

    for (const check of checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.run).toBe('function');
    }
  });

  it('registers all four when manually registered after clear', () => {
    clearSpeclessChecks();

    // Import already cached — just re-register
    const checks = [
      { name: 'hallucination-detector', run: async () => [] },
      { name: 'security-vulnerability-scanner', run: async () => [] },
      { name: 'firewall-host-scanner', run: async () => [] },
      { name: 'firewall-reality-gap-scanner', run: async () => [] },
    ];

    for (const check of checks) {
      registerSpeclessCheck(check);
    }

    const registered = getSpeclessChecks();
    expect(registered).toHaveLength(4);
  });
});

// ============================================================================
// 6. Evidence Structure Validation (cross-adapter)
// ============================================================================

describe('GateEvidence structure compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('all evidence from adapters uses specless-scanner source', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');
    const { securityCheck } = await import('../src/specless/security-adapter.js');
    const { firewallHostCheck, firewallRealityGapCheck } = await import('../src/specless/firewall-adapter.js');

    // Set up mocks to return findings
    mockScanGoFile.mockResolvedValueOnce({
      imports: [],
      findings: [{
        kind: 'missing_module',
        message: 'Missing module',
        importPath: 'test/pkg',
        location: { file: 'main.go', line: 1, column: 1 },
      }],
    });
    mockScanSource.mockReturnValueOnce([{
      id: 'SEC001',
      title: 'Test',
      severity: 'low',
      category: 'authentication',
      description: 'Test finding',
      recommendation: 'Fix it',
      location: { file: 'app.ts', startLine: 1 },
    }]);
    mockRunHostScan.mockResolvedValueOnce({
      scanner: 'host', verdict: 'SHIP', score: 100, filesChecked: 1,
      violations: 0, results: [{ file: 'app.ts', verdict: 'SHIP', violations: [] }],
    });
    mockRunRealityGapScan.mockResolvedValueOnce({
      scanner: 'reality-gap', verdict: 'SHIP', score: 100, filesChecked: 1,
      violations: 0, results: [{ file: 'app.ts', verdict: 'SHIP', violations: [] }],
    });

    const ctx = makeContext();
    const results = await Promise.all([
      hallucinationCheck.run('main.go', ctx),
      securityCheck.run('app.ts', ctx),
      firewallHostCheck.run('app.ts', ctx),
      firewallRealityGapCheck.run('app.ts', ctx),
    ]);

    for (const evidenceList of results) {
      for (const e of evidenceList) {
        assertValidEvidence(e);
        expect(e.source).toBe('specless-scanner');
      }
    }
  });

  it('critical findings use check names that trigger critical failure detection', async () => {
    const { hallucinationCheck } = await import('../src/specless/hallucination-adapter.js');
    const { securityCheck } = await import('../src/specless/security-adapter.js');
    const { firewallHostCheck } = await import('../src/specless/firewall-adapter.js');

    // Fake package → fake_feature_detected
    mockScanGoFile.mockResolvedValueOnce({
      imports: [],
      findings: [{
        kind: 'fake_package',
        message: 'Fake',
        importPath: 'fake/pkg',
        location: { file: 'main.go', line: 1, column: 1 },
      }],
    });

    // Critical security → security_violation
    mockScanSource.mockReturnValueOnce([{
      id: 'SEC009',
      title: 'Hardcoded Secrets',
      severity: 'critical',
      category: 'secrets',
      description: 'Hardcoded',
      recommendation: 'Fix',
      location: { file: 'app.ts', startLine: 1 },
    }]);

    // Hard block → security_violation
    mockRunHostScan.mockResolvedValueOnce({
      scanner: 'host', verdict: 'NO_SHIP', score: 0, filesChecked: 1,
      violations: 1, hardBlocks: 1, softBlocks: 0, warnings: 0,
      results: [{
        file: 'app.ts', verdict: 'NO_SHIP',
        violations: [{ rule: 'ghost-route', message: 'Ghost', severity: 'critical', tier: 'hard_block' }],
      }],
    });

    const ctx = makeContext();
    const [hallEvidence, secEvidence, fwEvidence] = await Promise.all([
      hallucinationCheck.run('main.go', ctx),
      securityCheck.run('app.ts', ctx),
      firewallHostCheck.run('app.ts', ctx),
    ]);

    // Verify critical failure check names
    expect(hallEvidence[0].check).toContain('fake_feature_detected');
    expect(secEvidence[0].check).toContain('security_violation');
    expect(fwEvidence[0].check).toContain('security_violation');

    // All should be 'fail' result
    expect(hallEvidence[0].result).toBe('fail');
    expect(secEvidence[0].result).toBe('fail');
    expect(fwEvidence[0].result).toBe('fail');
  });
});
