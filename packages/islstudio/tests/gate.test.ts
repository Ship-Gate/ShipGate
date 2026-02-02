import { describe, it, expect } from 'vitest';
import { runGate, type GateConfig } from '../src/gate.js';
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
