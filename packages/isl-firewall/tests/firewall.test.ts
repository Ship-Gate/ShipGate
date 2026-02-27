/**
 * ISL Firewall - Smoke Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentFirewall,
  createClaimExtractor,
  createPolicyEngine,
  createAllowlistManager,
  getAvailablePolicies,
} from '../src/index.js';
import type { Claim, Evidence } from '../src/index.js';

describe('ISL Firewall - Claim Extractor', () => {
  it('should extract API endpoint claims', async () => {
    const extractor = createClaimExtractor();
    const content = `
      const users = await fetch('/api/users');
      const posts = await fetch('/api/posts');
    `;

    const claims = await extractor.extract(content, 'test.ts');
    const apiClaims = claims.filter(c => c.type === 'api_endpoint');

    expect(apiClaims.length).toBe(2);
    expect(apiClaims.map(c => c.value)).toContain('/api/users');
    expect(apiClaims.map(c => c.value)).toContain('/api/posts');
  });

  it('should extract env variable claims', async () => {
    const extractor = createClaimExtractor();
    const content = `
      const apiKey = process.env.API_KEY;
      const dbUrl = process.env.DATABASE_URL;
    `;

    const claims = await extractor.extract(content, 'test.ts');
    const envClaims = claims.filter(c => c.type === 'env_variable');

    expect(envClaims.length).toBe(2);
    expect(envClaims.map(c => c.value)).toContain('API_KEY');
    expect(envClaims.map(c => c.value)).toContain('DATABASE_URL');
  });

  it('should extract import claims', async () => {
    const extractor = createClaimExtractor();
    const content = `
      import { useState } from 'react';
      import axios from 'axios';
      import { helper } from './utils';
    `;

    const claims = await extractor.extract(content, 'test.ts');
    const importClaims = claims.filter(c => c.type === 'import');

    expect(importClaims.length).toBe(3);
    expect(importClaims.map(c => c.value)).toContain('react');
    expect(importClaims.map(c => c.value)).toContain('axios');
    expect(importClaims.map(c => c.value)).toContain('./utils');
  });

  it('should extract file reference claims', async () => {
    const extractor = createClaimExtractor();
    const content = `
      const config = require('./config.json');
      const data = fs.readFileSync('../data/file.txt');
    `;

    const claims = await extractor.extract(content, 'test.ts');
    const fileClaims = claims.filter(c => c.type === 'file_reference');

    expect(fileClaims.length).toBe(2);
    expect(fileClaims.map(c => c.value)).toContain('./config.json');
    expect(fileClaims.map(c => c.value)).toContain('../data/file.txt');
  });

  it('should extract with statistics', async () => {
    const extractor = createClaimExtractor();
    const content = `
      import { api } from '@/lib/api';
      const url = '/api/users';
      const key = process.env.API_KEY;
    `;

    const result = await extractor.extractWithStats(content, 'test.ts');

    expect(result.statistics.totalClaims).toBeGreaterThan(0);
    expect(result.statistics.byType.api_endpoint).toBe(1);
    expect(result.statistics.byType.env_variable).toBe(1);
    expect(result.statistics.avgConfidence).toBeGreaterThan(0);
  });
});

describe('ISL Firewall - Policy Engine', () => {
  it('should list available policies', () => {
    const policies = getAvailablePolicies();
    
    expect(policies).toContain('ghost-route');
    expect(policies).toContain('ghost-env');
    expect(policies).toContain('ghost-import');
    expect(policies).toContain('ghost-file');
  });

  it('should detect ghost route violations', () => {
    const engine = createPolicyEngine(['ghost-route']);
    
    const claim: Claim = {
      id: 'test-claim',
      type: 'api_endpoint',
      value: '/api/unknown-route',
      location: { line: 1, column: 1, length: 10 },
      confidence: 0.8,
      context: '',
    };

    const evidence: Evidence = {
      claimId: 'test-claim',
      found: false,
      source: 'truthpack',
      confidence: 0,
      details: {},
    };

    const violations = engine.evaluate(claim, evidence);

    expect(violations.length).toBe(1);
    expect(violations[0].policyId).toBe('ghost-route');
    expect(violations[0].tier).toBe('hard_block');
  });

  it('should not flag verified claims', () => {
    const engine = createPolicyEngine(['ghost-route']);
    
    const claim: Claim = {
      id: 'test-claim',
      type: 'api_endpoint',
      value: '/api/users',
      location: { line: 1, column: 1, length: 10 },
      confidence: 0.8,
      context: '',
    };

    const evidence: Evidence = {
      claimId: 'test-claim',
      found: true,
      source: 'truthpack',
      location: { file: 'routes.ts', line: 10 },
      confidence: 1.0,
      details: {},
    };

    const violations = engine.evaluate(claim, evidence);

    expect(violations.length).toBe(0);
  });

  it('should evaluate all claims', () => {
    const engine = createPolicyEngine(['ghost-route', 'ghost-env']);
    
    const claims: Claim[] = [
      {
        id: 'claim-1',
        type: 'api_endpoint',
        value: '/api/ghost',
        location: { line: 1, column: 1, length: 10 },
        confidence: 0.8,
        context: '',
      },
      {
        id: 'claim-2',
        type: 'env_variable',
        value: 'MISSING_VAR',
        location: { line: 2, column: 1, length: 10 },
        confidence: 0.8,
        context: '',
      },
    ];

    const evidenceMap = new Map([
      ['claim-1', { claimId: 'claim-1', found: false, source: 'truthpack' as const, confidence: 0, details: {} }],
      ['claim-2', { claimId: 'claim-2', found: false, source: 'truthpack' as const, confidence: 0, details: {} }],
    ]);

    const decision = engine.evaluateAll(claims, evidenceMap);

    expect(decision.allowed).toBe(false);
    expect(decision.violations.length).toBe(2);
  });
});

describe('ISL Firewall - Allowlist Manager', () => {
  it('should check route allowlist', async () => {
    const manager = createAllowlistManager('/test/project');
    await manager.load();

    // Add a route prefix
    manager.get().allowedRoutePrefixes = ['/api/internal/'];

    expect(manager.isRouteAllowed('/api/internal/health')).toBe(true);
    expect(manager.isRouteAllowed('/api/external/health')).toBe(false);
  });

  it('should check path ignore patterns', async () => {
    const manager = createAllowlistManager('/test/project');
    await manager.load();

    expect(manager.isPathIgnored('node_modules/package/index.js')).toBe(true);
    expect(manager.isPathIgnored('src/index.ts')).toBe(false);
    expect(manager.isPathIgnored('dist/bundle.js')).toBe(true);
    expect(manager.isPathIgnored('file.generated.ts')).toBe(true);
  });

  it('should check env var allowlist', async () => {
    const manager = createAllowlistManager('/test/project');
    await manager.load();

    manager.get().allowedEnvVars = ['NODE_ENV', 'REACT_*'];

    expect(manager.isEnvVarAllowed('NODE_ENV')).toBe(true);
    expect(manager.isEnvVarAllowed('REACT_APP_API')).toBe(true);
    expect(manager.isEnvVarAllowed('SECRET_KEY')).toBe(false);
  });
});

describe('ISL Firewall - Agent Firewall', () => {
  it('should evaluate content in observe mode', async () => {
    const firewall = createAgentFirewall({
      mode: 'observe',
      projectRoot: process.cwd(),
    });

    const result = await firewall.evaluate({
      content: `
        const api = '/api/ghost-endpoint';
        const key = process.env.GHOST_VAR;
      `,
      filePath: 'src/test.ts',
    });

    // In observe mode, always allowed
    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('observe');
    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should get firewall status', () => {
    const firewall = createAgentFirewall({
      mode: 'enforce',
      policies: ['ghost-route', 'ghost-env'],
    });

    const status = firewall.getStatus();

    expect(status.mode).toBe('enforce');
    expect(status.policies).toContain('ghost-route');
    expect(status.policies).toContain('ghost-env');
  });

  it('should switch modes', () => {
    const firewall = createAgentFirewall({ mode: 'observe' });

    expect(firewall.getMode()).toBe('observe');
    
    firewall.setMode('enforce');
    expect(firewall.getMode()).toBe('enforce');
    
    firewall.lockdown();
    expect(firewall.getMode()).toBe('lockdown');
  });

  it('should provide quick check', async () => {
    const firewall = createAgentFirewall({ mode: 'observe' });

    const result = await firewall.quickCheck({
      content: 'const x = 1;',
      filePath: 'src/simple.ts',
    });

    expect(result.allowed).toBe(true);
    expect(typeof result.reason).toBe('string');
  });

  it('should report statistics', async () => {
    const firewall = createAgentFirewall({ mode: 'observe' });

    const result = await firewall.evaluate({
      content: `
        import { api } from 'axios';
        const url = '/api/users';
      `,
      filePath: 'src/api.ts',
    });

    expect(result.stats.claimsExtracted).toBeGreaterThan(0);
    expect(typeof result.stats.evidenceFound).toBe('number');
    expect(typeof result.stats.evidenceMissing).toBe('number');
    expect(typeof result.stats.violationsTotal).toBe('number');
  });
});
