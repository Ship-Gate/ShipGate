/**
 * Pipeline Generator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generate,
  analyzeDomain,
  requiresSecurityScanning,
  type GeneratorOptions,
} from '../src/generator.js';
import type { DomainDeclaration, BehaviorDeclaration, Identifier } from '@intentos/isl-core';

// Helper to create mock span
const mockSpan = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };

// Helper to create identifier
function id(name: string): Identifier {
  return { kind: 'Identifier', name, span: mockSpan };
}

// Create a basic mock domain
function createMockDomain(overrides: Partial<DomainDeclaration> = {}): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: id('TestDomain'),
    imports: [],
    entities: [],
    types: [],
    enums: [],
    behaviors: [],
    invariants: [],
    span: mockSpan,
    ...overrides,
  };
}

// Create a mock behavior
function createMockBehavior(
  name: string,
  options: {
    hasCompliance?: boolean;
    complianceStandard?: string;
    hasTemporal?: boolean;
    hasSecurity?: boolean;
  } = {}
): BehaviorDeclaration {
  const behavior: BehaviorDeclaration = {
    kind: 'BehaviorDeclaration',
    name: id(name),
    span: mockSpan,
  };

  if (options.hasCompliance && options.complianceStandard) {
    behavior.compliance = {
      kind: 'ComplianceBlock',
      standards: [
        {
          kind: 'ComplianceStandard',
          name: id(options.complianceStandard),
          requirements: [],
          span: mockSpan,
        },
      ],
      span: mockSpan,
    };
  }

  if (options.hasTemporal) {
    behavior.temporal = {
      kind: 'TemporalBlock',
      requirements: [
        {
          kind: 'TemporalRequirement',
          type: 'within',
          duration: { kind: 'DurationLiteral', value: 500, unit: 'ms', span: mockSpan },
          condition: id('completion'),
          span: mockSpan,
        },
      ],
      span: mockSpan,
    };
  }

  if (options.hasSecurity) {
    behavior.security = {
      kind: 'SecurityBlock',
      requirements: [
        {
          kind: 'SecurityRequirement',
          type: 'requires',
          expression: id('authentication'),
          span: mockSpan,
        },
      ],
      span: mockSpan,
    };
  }

  return behavior;
}

describe('analyzeDomain', () => {
  it('should extract basic domain info', () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('CreateUser'),
        createMockBehavior('Login'),
      ],
    });

    const analysis = analyzeDomain(domain);

    expect(analysis.name).toBe('TestDomain');
    expect(analysis.behaviors).toEqual(['CreateUser', 'Login']);
    expect(analysis.behaviorCount).toBe(2);
  });

  it('should detect compliance requirements', () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('ProcessPayment', {
          hasCompliance: true,
          complianceStandard: 'PCI_DSS',
        }),
      ],
    });

    const analysis = analyzeDomain(domain);

    expect(analysis.hasCompliance).toBe(true);
    expect(analysis.complianceStandards).toContain('PCI_DSS');
  });

  it('should detect temporal requirements', () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('FastOperation', { hasTemporal: true }),
      ],
    });

    const analysis = analyzeDomain(domain);

    expect(analysis.hasTemporalRequirements).toBe(true);
  });

  it('should detect security requirements', () => {
    const domain = createMockDomain({
      behaviors: [
        createMockBehavior('SecureOperation', { hasSecurity: true }),
      ],
    });

    const analysis = analyzeDomain(domain);

    expect(analysis.hasSecurityRequirements).toBe(true);
  });
});

describe('requiresSecurityScanning', () => {
  it('should return true for PCI-DSS', () => {
    expect(requiresSecurityScanning(['PCI_DSS'])).toBe(true);
    expect(requiresSecurityScanning(['PCI-DSS'])).toBe(true);
  });

  it('should return true for SOC2', () => {
    expect(requiresSecurityScanning(['SOC2'])).toBe(true);
  });

  it('should return true for HIPAA', () => {
    expect(requiresSecurityScanning(['HIPAA'])).toBe(true);
  });

  it('should return false for non-security standards', () => {
    expect(requiresSecurityScanning(['GDPR'])).toBe(false);
    expect(requiresSecurityScanning([])).toBe(false);
  });
});

describe('generate', () => {
  describe('GitHub Actions', () => {
    it('should generate basic pipeline', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('CreateUser'),
          createMockBehavior('Login'),
        ],
      });

      const options: GeneratorOptions = {
        platform: 'github',
      };

      const files = generate(domain, options);

      expect(files).toHaveLength(1);
      expect(files[0]!.path).toBe('.github/workflows/isl-pipeline.yml');
      
      const content = files[0]!.content;
      expect(content).toContain('name: ISL Pipeline');
      expect(content).toContain('check:');
      expect(content).toContain('test:');
      expect(content).toContain('verify:');
      expect(content).toContain('CreateUser');
      expect(content).toContain('Login');
    });

    it('should include security stage for PCI-DSS compliance', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('ProcessPayment', {
            hasCompliance: true,
            complianceStandard: 'PCI_DSS',
          }),
        ],
      });

      const files = generate(domain, { platform: 'github' });
      const content = files[0]!.content;

      expect(content).toContain('security:');
      expect(content).toContain('Security Scan');
      expect(content).toContain('--pci-dss');
    });

    it('should include chaos stage for temporal requirements', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('FastOp', { hasTemporal: true }),
        ],
      });

      const files = generate(domain, { platform: 'github' });
      const content = files[0]!.content;

      expect(content).toContain('chaos:');
      expect(content).toContain('Chaos Testing');
    });

    it('should include performance stage for temporal requirements', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('FastOp', { hasTemporal: true }),
        ],
      });

      const files = generate(domain, { platform: 'github' });
      const content = files[0]!.content;

      expect(content).toContain('performance:');
      expect(content).toContain('Performance Tests');
    });

    it('should use behavior matrix for verification', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('A'),
          createMockBehavior('B'),
          createMockBehavior('C'),
        ],
      });

      const files = generate(domain, { platform: 'github' });
      const content = files[0]!.content;

      expect(content).toContain('matrix:');
      expect(content).toContain("behavior: ['A', 'B', 'C']");
    });
  });

  describe('GitLab CI', () => {
    it('should generate basic pipeline', () => {
      const domain = createMockDomain({
        behaviors: [createMockBehavior('CreateUser')],
      });

      const files = generate(domain, { platform: 'gitlab' });

      expect(files).toHaveLength(1);
      expect(files[0]!.path).toBe('.gitlab-ci.yml');
      
      const content = files[0]!.content;
      expect(content).toContain('stages:');
      expect(content).toContain('check:');
      expect(content).toContain('test:');
      expect(content).toContain('verify:');
    });

    it('should use parallel matrix for behaviors', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('A'),
          createMockBehavior('B'),
        ],
      });

      const files = generate(domain, { platform: 'gitlab' });
      const content = files[0]!.content;

      expect(content).toContain('parallel:');
      expect(content).toContain('matrix:');
      expect(content).toContain('BEHAVIOR:');
    });
  });

  describe('CircleCI', () => {
    it('should generate basic pipeline', () => {
      const domain = createMockDomain({
        behaviors: [createMockBehavior('CreateUser')],
      });

      const files = generate(domain, { platform: 'circle' });

      expect(files).toHaveLength(1);
      expect(files[0]!.path).toBe('.circleci/config.yml');
      
      const content = files[0]!.content;
      expect(content).toContain('version: 2.1');
      expect(content).toContain('jobs:');
      expect(content).toContain('workflows:');
    });
  });

  describe('Jenkins', () => {
    it('should generate Jenkinsfile', () => {
      const domain = createMockDomain({
        behaviors: [createMockBehavior('CreateUser')],
      });

      const files = generate(domain, { platform: 'jenkins' });

      expect(files).toHaveLength(1);
      expect(files[0]!.path).toBe('Jenkinsfile');
      
      const content = files[0]!.content;
      expect(content).toContain('pipeline {');
      expect(content).toContain('stages {');
      expect(content).toContain("stage('Check')");
      expect(content).toContain("stage('Test')");
      expect(content).toContain("stage('Verify')");
    });

    it('should use parallel stages for behaviors', () => {
      const domain = createMockDomain({
        behaviors: [
          createMockBehavior('A'),
          createMockBehavior('B'),
        ],
      });

      const files = generate(domain, { platform: 'jenkins' });
      const content = files[0]!.content;

      expect(content).toContain('parallel {');
      expect(content).toContain("stage('A')");
      expect(content).toContain("stage('B')");
    });
  });
});

describe('generator options', () => {
  it('should respect custom node version', () => {
    const domain = createMockDomain({
      behaviors: [createMockBehavior('Test')],
    });

    const files = generate(domain, {
      platform: 'github',
      nodeVersion: '18',
    });

    expect(files[0]!.content).toContain("node-version: '18'");
  });

  it('should respect custom deploy branch', () => {
    const domain = createMockDomain({
      behaviors: [createMockBehavior('Test')],
    });

    const files = generate(domain, {
      platform: 'github',
      deployBranch: 'production',
      includeDeploy: true,
    });

    expect(files[0]!.content).toContain('refs/heads/production');
  });

  it('should exclude deploy when disabled', () => {
    const domain = createMockDomain({
      behaviors: [createMockBehavior('Test')],
    });

    const files = generate(domain, {
      platform: 'github',
      includeDeploy: false,
    });

    expect(files[0]!.content).not.toContain('deploy:');
  });

  it('should respect custom source directory', () => {
    const domain = createMockDomain({
      behaviors: [createMockBehavior('Test')],
    });

    const files = generate(domain, {
      platform: 'github',
      sourceDir: 'lib',
    });

    expect(files[0]!.content).toContain('lib/');
  });
});
