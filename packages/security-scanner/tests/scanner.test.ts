// ============================================================================
// Security Scanner Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  scan,
  fullScan,
  quickScan,
  scanSource,
  runCI,
  assertSecure,
  SecurityScanner,
  Domain,
  Finding,
  ScanResult,
  ALL_RULES,
  RULE_REGISTRY,
  getRule,
  getRulesByCategory,
  getRulesBySeverity,
  scanTypeScript,
  scanPython,
  detectLanguage,
  generateSarif,
  generateJsonReport,
  generateMarkdownReport,
  generateMarkdownSummary,
} from '../src';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    kind: 'Domain',
    name: { name: 'TestDomain' },
    version: { value: '1.0.0' },
    location: { file: 'test.isl', startLine: 1, startColumn: 1, endLine: 100, endColumn: 1 },
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    ...overrides,
  };
}

function createMockBehavior(name: string, options: {
  hasSensitiveInput?: boolean;
  hasAuthentication?: boolean;
  hasRateLimiting?: boolean;
  isPublic?: boolean;
} = {}) {
  const {
    hasSensitiveInput = false,
    hasAuthentication = false,
    hasRateLimiting = false,
    isPublic = true,
  } = options;

  return {
    kind: 'Behavior' as const,
    name: { name },
    location: { file: 'test.isl', startLine: 10, startColumn: 1, endLine: 50, endColumn: 1 },
    actors: isPublic ? [
      { kind: 'ActorSpec' as const, name: { name: 'Anonymous' }, constraints: [], location: { file: 'test.isl', startLine: 11, startColumn: 1, endLine: 11, endColumn: 1 } }
    ] : [
      { kind: 'ActorSpec' as const, name: { name: 'User' }, constraints: [], location: { file: 'test.isl', startLine: 11, startColumn: 1, endLine: 11, endColumn: 1 } }
    ],
    input: {
      kind: 'InputSpec' as const,
      fields: hasSensitiveInput ? [
        {
          kind: 'Field' as const,
          name: { name: 'password' },
          type: { kind: 'PrimitiveType', name: 'String' },
          optional: false,
          annotations: [{ kind: 'Annotation' as const, name: { name: 'sensitive' }, location: { file: 'test.isl', startLine: 15, startColumn: 1, endLine: 15, endColumn: 1 } }],
          location: { file: 'test.isl', startLine: 15, startColumn: 1, endLine: 15, endColumn: 1 },
        }
      ] : [],
      location: { file: 'test.isl', startLine: 14, startColumn: 1, endLine: 20, endColumn: 1 },
    },
    output: {
      kind: 'OutputSpec' as const,
      success: { kind: 'PrimitiveType', name: 'Boolean' },
      errors: [],
      location: { file: 'test.isl', startLine: 22, startColumn: 1, endLine: 30, endColumn: 1 },
    },
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [],
    security: [
      ...(hasAuthentication ? [{ kind: 'SecuritySpec' as const, type: 'requires' as const, details: { name: 'authentication' }, location: { file: 'test.isl', startLine: 35, startColumn: 1, endLine: 35, endColumn: 1 } }] : []),
      ...(hasRateLimiting ? [{ kind: 'SecuritySpec' as const, type: 'rate_limit' as const, details: { count: 100, per: 'hour' }, location: { file: 'test.isl', startLine: 36, startColumn: 1, endLine: 36, endColumn: 1 } }] : []),
    ],
    compliance: [],
  };
}

function createMockEntity(name: string, fields: Array<{
  name: string;
  annotations?: string[];
}> = []) {
  return {
    kind: 'Entity' as const,
    name: { name },
    location: { file: 'test.isl', startLine: 60, startColumn: 1, endLine: 80, endColumn: 1 },
    fields: fields.map((f, i) => ({
      kind: 'Field' as const,
      name: { name: f.name },
      type: { kind: 'PrimitiveType', name: 'String' },
      optional: false,
      annotations: (f.annotations || []).map(a => ({
        kind: 'Annotation' as const,
        name: { name: a },
        location: { file: 'test.isl', startLine: 65 + i, startColumn: 1, endLine: 65 + i, endColumn: 1 },
      })),
      location: { file: 'test.isl', startLine: 65 + i, startColumn: 1, endLine: 65 + i, endColumn: 1 },
    })),
    invariants: [],
  };
}

// ============================================================================
// Rule Registry Tests
// ============================================================================

describe('Rule Registry', () => {
  it('should have all expected rules', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it('should get rule by ID', () => {
    const rule = getRule('SEC001');
    expect(rule).toBeDefined();
    expect(rule?.id).toBe('SEC001');
    expect(rule?.title).toBe('Missing Authentication');
  });

  it('should get rules by category', () => {
    const authRules = getRulesByCategory('authentication');
    expect(authRules.length).toBeGreaterThan(0);
    expect(authRules.every(r => r.category === 'authentication')).toBe(true);
  });

  it('should get rules by severity', () => {
    const criticalRules = getRulesBySeverity('critical');
    expect(criticalRules.length).toBeGreaterThan(0);
    expect(criticalRules.every(r => r.severity === 'critical')).toBe(true);
  });

  it('should have RULE_REGISTRY populated', () => {
    expect(RULE_REGISTRY.size).toBe(ALL_RULES.length);
  });
});

// ============================================================================
// ISL Spec Scanning Tests
// ============================================================================

describe('ISL Spec Scanning', () => {
  describe('SEC001: Missing Authentication', () => {
    it('should detect missing authentication for sensitive data', async () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('GetPassword', {
            hasSensitiveInput: true,
            hasAuthentication: false,
            isPublic: true,
          }),
        ],
      });

      const result = await scan(domain);

      expect(result.findings.some(f => f.id === 'SEC001')).toBe(true);
    });

    it('should not flag when authentication is present', async () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('GetPassword', {
            hasSensitiveInput: true,
            hasAuthentication: true,
            isPublic: false,
          }),
        ],
      });

      const result = await scan(domain);

      expect(result.findings.filter(f => f.id === 'SEC001').length).toBe(0);
    });
  });

  describe('SEC002: Missing Rate Limiting', () => {
    it('should detect missing rate limiting for public endpoints', async () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('PublicAPI', {
            isPublic: true,
            hasRateLimiting: false,
          }),
        ],
      });

      const result = await scan(domain);

      expect(result.findings.some(f => f.id === 'SEC002')).toBe(true);
    });

    it('should not flag when rate limiting is present', async () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('PublicAPI', {
            isPublic: true,
            hasRateLimiting: true,
          }),
        ],
      });

      const result = await scan(domain);

      expect(result.findings.filter(f => f.id === 'SEC002').length).toBe(0);
    });
  });

  describe('SEC004: Missing Encryption', () => {
    it('should detect PII fields without encryption', async () => {
      const domain = createMockDomain({
        entities: [
          createMockEntity('User', [
            { name: 'email', annotations: ['pii'] },
          ]),
        ],
      });

      const result = await scan(domain);

      expect(result.findings.some(f => f.id === 'SEC004')).toBe(true);
    });

    it('should not flag fields with encryption annotation', async () => {
      const domain = createMockDomain({
        entities: [
          createMockEntity('User', [
            { name: 'email', annotations: ['pii', 'encrypted'] },
          ]),
        ],
      });

      const result = await scan(domain);

      expect(result.findings.filter(f => f.id === 'SEC004').length).toBe(0);
    });
  });
});

// ============================================================================
// TypeScript Implementation Scanning Tests
// ============================================================================

describe('TypeScript Implementation Scanning', () => {
  it('should detect SQL injection via string concatenation', () => {
    const source = `
      const userId = req.params.id;
      db.query("SELECT * FROM users WHERE id = " + userId);
    `;

    const result = scanTypeScript(source);

    expect(result.findings.some(f => 
      f.category === 'injection' && f.description.includes('SQL')
    )).toBe(true);
  });

  it('should detect eval usage', () => {
    const source = `
      const code = req.body.code;
      eval(code);
    `;

    const result = scanTypeScript(source);

    expect(result.findings.some(f => 
      f.description.toLowerCase().includes('eval')
    )).toBe(true);
  });

  it('should detect Math.random for security', () => {
    const source = `
      const token = Math.random().toString(36);
    `;

    const result = scanTypeScript(source);

    expect(result.findings.some(f => 
      f.id === 'TS006' || f.description.includes('Math.random')
    )).toBe(true);
  });

  it('should detect hardcoded passwords', () => {
    const source = `
      const password = "supersecret123";
    `;

    const result = scanTypeScript(source);

    expect(result.findings.some(f => 
      f.category === 'secrets'
    )).toBe(true);
  });

  it('should detect weak hash algorithms', () => {
    const source = `
      const hash = crypto.createHash('md5').update(data).digest('hex');
    `;

    const result = scanTypeScript(source);

    expect(result.findings.some(f => 
      f.description.includes('MD5')
    )).toBe(true);
  });
});

// ============================================================================
// Python Implementation Scanning Tests
// ============================================================================

describe('Python Implementation Scanning', () => {
  it('should detect SQL injection via f-string', () => {
    const source = `
      user_id = request.args.get('id')
      cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    `;

    const result = scanPython(source);

    expect(result.findings.some(f => 
      f.category === 'injection'
    )).toBe(true);
  });

  it('should detect os.system with user input', () => {
    const source = `
      import os
      cmd = request.form['cmd']
      os.system(f"ls {cmd}")
    `;

    const result = scanPython(source);

    expect(result.findings.some(f => 
      f.description.includes('os.system')
    )).toBe(true);
  });

  it('should detect pickle.loads', () => {
    const source = `
      import pickle
      data = pickle.loads(user_data)
    `;

    const result = scanPython(source);

    expect(result.findings.some(f => 
      f.description.toLowerCase().includes('pickle')
    )).toBe(true);
  });

  it('should detect unsafe yaml.load', () => {
    const source = `
      import yaml
      data = yaml.load(yaml_string)
    `;

    const result = scanPython(source);

    expect(result.findings.some(f => 
      f.description.includes('yaml')
    )).toBe(true);
  });
});

// ============================================================================
// Language Detection Tests
// ============================================================================

describe('Language Detection', () => {
  it('should detect TypeScript from file extension', () => {
    expect(detectLanguage('', 'file.ts')).toBe('typescript');
    expect(detectLanguage('', 'file.tsx')).toBe('typescript');
  });

  it('should detect JavaScript from file extension', () => {
    expect(detectLanguage('', 'file.js')).toBe('javascript');
    expect(detectLanguage('', 'file.jsx')).toBe('javascript');
  });

  it('should detect Python from file extension', () => {
    expect(detectLanguage('', 'file.py')).toBe('python');
  });

  it('should detect Python from content', () => {
    const pythonCode = `
import os
from typing import List

def hello():
    print("Hello")

if __name__ == "__main__":
    hello()
    `;

    expect(detectLanguage(pythonCode)).toBe('python');
  });

  it('should detect TypeScript from content', () => {
    const tsCode = `
import { Component } from 'react';

interface Props {
  name: string;
}

export function Hello(props: Props): JSX.Element {
  return <div>{props.name}</div>;
}
    `;

    expect(detectLanguage(tsCode)).toBe('typescript');
  });
});

// ============================================================================
// Scanner Class Tests
// ============================================================================

describe('SecurityScanner Class', () => {
  it('should create scanner with default options', () => {
    const scanner = new SecurityScanner();
    expect(scanner.getRules().length).toBe(ALL_RULES.length);
  });

  it('should filter rules by include list', () => {
    const scanner = new SecurityScanner({
      includeRules: ['SEC001', 'SEC002'],
    });

    const rules = scanner.getRules();
    expect(rules.length).toBe(2);
    expect(rules.map(r => r.id)).toContain('SEC001');
    expect(rules.map(r => r.id)).toContain('SEC002');
  });

  it('should filter rules by exclude list', () => {
    const scanner = new SecurityScanner({
      excludeRules: ['SEC001'],
    });

    const rules = scanner.getRules();
    expect(rules.map(r => r.id)).not.toContain('SEC001');
  });

  it('should add custom rules', () => {
    const customRule = {
      id: 'CUSTOM001',
      title: 'Custom Rule',
      description: 'A custom rule',
      severity: 'high' as const,
      category: 'authentication' as const,
      check: () => [],
    };

    const scanner = new SecurityScanner({
      customRules: [customRule],
    });

    expect(scanner.getRules().map(r => r.id)).toContain('CUSTOM001');
  });

  it('should check pass/fail based on severity', async () => {
    const scanner = new SecurityScanner({
      failOnSeverity: 'high',
    });

    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('GetPassword', {
          hasSensitiveInput: true,
          hasAuthentication: false,
        }),
      ],
    });

    const result = await scanner.scan(domain);
    expect(scanner.checkPassed(result)).toBe(false);
  });
});

// ============================================================================
// Reporter Tests
// ============================================================================

describe('Reporters', () => {
  let mockResult: ScanResult;

  beforeEach(() => {
    mockResult = {
      summary: { critical: 1, high: 2, medium: 3, low: 4, total: 10 },
      findings: [
        {
          id: 'SEC001',
          title: 'Missing Authentication',
          severity: 'high',
          category: 'authentication',
          location: { file: 'test.isl', startLine: 10 },
          description: 'Test finding',
          recommendation: 'Fix it',
          cwe: 'CWE-306',
          owasp: 'A01:2021',
        },
      ],
      scannedAt: new Date(),
      duration: 100,
      filesScanned: 1,
      rulesApplied: 10,
    };
  });

  describe('SARIF Reporter', () => {
    it('should generate valid SARIF structure', () => {
      const sarif = generateSarif(mockResult);

      expect(sarif.$schema).toContain('sarif');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);
      expect(sarif.runs[0].tool.driver.name).toBe('ISL Security Scanner');
    });

    it('should include results', () => {
      const sarif = generateSarif(mockResult);

      expect(sarif.runs[0].results).toHaveLength(1);
      expect(sarif.runs[0].results[0].ruleId).toBe('SEC001');
    });

    it('should include rules', () => {
      const sarif = generateSarif(mockResult, { includeRules: true });

      expect(sarif.runs[0].tool.driver.rules?.length).toBeGreaterThan(0);
    });
  });

  describe('JSON Reporter', () => {
    it('should generate valid JSON report', () => {
      const report = generateJsonReport(mockResult);

      expect(report.metadata).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.findings).toBeDefined();
      expect(report.statistics).toBeDefined();
    });

    it('should calculate security score', () => {
      const report = generateJsonReport(mockResult);

      expect(report.summary.score).toBeGreaterThanOrEqual(0);
      expect(report.summary.score).toBeLessThanOrEqual(100);
    });

    it('should include CWE/OWASP links', () => {
      const report = generateJsonReport(mockResult);

      expect(report.findings[0].cweUrl).toContain('cwe.mitre.org');
      expect(report.findings[0].owaspUrl).toContain('owasp.org');
    });
  });

  describe('Markdown Reporter', () => {
    it('should generate markdown report', () => {
      const markdown = generateMarkdownReport(mockResult);

      expect(markdown).toContain('# 🔒 Security Scan Report');
      expect(markdown).toContain('## 📊 Summary');
      expect(markdown).toContain('SEC001');
    });

    it('should generate summary for PR comments', () => {
      const summary = generateMarkdownSummary(mockResult);

      expect(summary).toContain('Security Scan Results');
      expect(summary).toContain('Critical');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  it('should perform full scan with ISL and implementation', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('Login', {
          hasSensitiveInput: true,
          hasAuthentication: false,
        }),
      ],
    });

    const implementation = `
      const password = "hardcoded123";
      db.query("SELECT * FROM users WHERE id = " + userId);
    `;

    const result = await fullScan(domain, implementation, 'typescript');

    // Should find issues in both ISL and implementation
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.filesScanned).toBe(2);
  });

  it('should run quick scan (high+ only)', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('PublicAPI', {
          isPublic: true,
          hasRateLimiting: false, // Medium severity
        }),
      ],
    });

    const result = await quickScan(domain);

    // Medium severity findings should be filtered out
    expect(result.findings.every(f => 
      f.severity === 'critical' || f.severity === 'high'
    )).toBe(true);
  });

  it('should run CI check', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('Safe', {
          hasAuthentication: true,
          hasRateLimiting: true,
        }),
      ],
    });

    const ciResult = await runCI(domain);

    expect(ciResult.passed).toBe(true);
    expect(ciResult.exitCode).toBe(0);
    expect(ciResult.summary).toContain('PASSED');
  });

  it('should fail CI on high severity', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('Unsafe', {
          hasSensitiveInput: true,
          hasAuthentication: false,
        }),
      ],
    });

    const ciResult = await runCI(domain);

    expect(ciResult.passed).toBe(false);
    expect(ciResult.exitCode).toBe(1);
  });

  it('should throw on assertSecure with vulnerabilities', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('Vulnerable', {
          hasSensitiveInput: true,
          hasAuthentication: false,
        }),
      ],
    });

    await expect(assertSecure(domain)).rejects.toThrow('Security scan failed');
  });

  it('should pass assertSecure when secure', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('Secure', {
          hasAuthentication: true,
          hasRateLimiting: true,
        }),
      ],
    });

    await expect(assertSecure(domain)).resolves.toBeUndefined();
  });
});

// ============================================================================
// Scan Summary Tests
// ============================================================================

describe('Scan Summary', () => {
  it('should calculate correct summary', async () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('API1', { hasSensitiveInput: true, hasAuthentication: false }),
        createMockBehavior('API2', { isPublic: true, hasRateLimiting: false }),
      ],
    });

    const result = await scan(domain);

    expect(result.summary.total).toBe(result.findings.length);
    expect(
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low
    ).toBe(result.summary.total);
  });

  it('should record scan metadata', async () => {
    const domain = createMockDomain();

    const result = await scan(domain);

    expect(result.scannedAt).toBeInstanceOf(Date);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.rulesApplied).toBeGreaterThan(0);
  });
});
