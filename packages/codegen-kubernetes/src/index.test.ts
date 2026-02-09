// ============================================================================
// Kubernetes Codegen Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { KubernetesGenerator, createKubernetesGenerator, DEFAULT_OPTIONS } from './index.js';
import type { Domain } from './types.js';

const testDomain: Domain = {
  name: 'TestService',
  description: 'A test service',
  version: '1.0.0',
  behaviors: [
    { name: 'handleRequest', temporal: [{ operator: 'within', duration: '500ms' }] },
  ],
  entities: [{ name: 'User' }],
  config: {
    port: 8080,
    healthPath: '/health',
    readinessPath: '/ready',
    livenessPath: '/live',
    env: { NODE_ENV: 'production' },
    secrets: ['api-key'],
  },
};

describe('KubernetesGenerator', () => {
  it('should create generator with default options', () => {
    const generator = new KubernetesGenerator();
    expect(generator).toBeDefined();
  });

  it('should create generator with custom options', () => {
    const generator = new KubernetesGenerator({
      namespace: 'custom-ns',
      replicas: 3,
    });
    expect(generator).toBeDefined();
  });

  it('should generate files for a domain', () => {
    const generator = new KubernetesGenerator();
    const files = generator.generate(testDomain);

    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.path.includes('deployment.yaml'))).toBe(true);
    expect(files.some(f => f.path.includes('service.yaml'))).toBe(true);
    expect(files.some(f => f.path.includes('configmap.yaml'))).toBe(true);
  });

  it('should include HPA when enabled', () => {
    const generator = new KubernetesGenerator({ includeHPA: true });
    const files = generator.generate(testDomain);

    expect(files.some(f => f.path.includes('hpa.yaml'))).toBe(true);
  });

  it('should include PDB when enabled', () => {
    const generator = new KubernetesGenerator({ includePDB: true });
    const files = generator.generate(testDomain);

    expect(files.some(f => f.path.includes('pdb.yaml'))).toBe(true);
  });

  it('should include NetworkPolicy when enabled', () => {
    const generator = new KubernetesGenerator({ includeNetworkPolicies: true });
    const files = generator.generate(testDomain);

    expect(files.some(f => f.path.includes('networkpolicy.yaml'))).toBe(true);
  });

  it('should generate kustomization when enabled', () => {
    const generator = new KubernetesGenerator({ generateKustomize: true });
    const files = generator.generate(testDomain);

    expect(files.some(f => f.path.includes('kustomization.yaml'))).toBe(true);
  });

  it('should generate Helm chart when enabled', () => {
    const generator = new KubernetesGenerator({ generateHelm: true, generateKustomize: false });
    const files = generator.generate(testDomain);

    expect(files.some(f => f.path.includes('Chart.yaml'))).toBe(true);
  });

  it('should generate for multiple domains', () => {
    const generator = new KubernetesGenerator();
    const domains: Domain[] = [
      testDomain,
      { name: 'AnotherService', behaviors: [] },
    ];
    const files = generator.generateAll(domains);

    expect(files.some(f => f.path.includes('testservice'))).toBe(true);
    expect(files.some(f => f.path.includes('anotherservice'))).toBe(true);
  });
});

describe('createKubernetesGenerator', () => {
  it('should create a generator instance', () => {
    const generator = createKubernetesGenerator();
    expect(generator).toBeInstanceOf(KubernetesGenerator);
  });

  it('should pass options to the generator', () => {
    const generator = createKubernetesGenerator({ namespace: 'test-ns' });
    expect(generator).toBeInstanceOf(KubernetesGenerator);
  });
});

describe('DEFAULT_OPTIONS', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_OPTIONS.namespace).toBe('default');
    expect(DEFAULT_OPTIONS.replicas).toBe(2);
    expect(DEFAULT_OPTIONS.imageTag).toBe('latest');
    expect(DEFAULT_OPTIONS.generateHelm).toBe(true);
    expect(DEFAULT_OPTIONS.generateKustomize).toBe(true);
  });
});
