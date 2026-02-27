/**
 * ISL Adapters - Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isGitHubActions,
  getGitHubContext,
  parseRepository,
  isPullRequest,
  generatePRComment,
  generateCompactComment,
  generateSARIF,
} from '../src/github/index.js';
import {
  firewallTools,
  gateTools,
  handleFirewallStatus,
} from '../src/mcp/index.js';
import { runGateCommand, runQuickCheck } from '../src/cli/index.js';
import type { GateResult } from '@isl-lang/gate';

describe('ISL Adapters - GitHub Context', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should detect GitHub Actions environment', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(isGitHubActions()).toBe(true);
  });

  it('should return false when not in GitHub Actions', () => {
    delete process.env.GITHUB_ACTIONS;
    expect(isGitHubActions()).toBe(false);
  });

  it('should parse repository owner and name', () => {
    const result = parseRepository('owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should return null for invalid repository format', () => {
    expect(parseRepository('invalid')).toBeNull();
    expect(parseRepository('too/many/parts')).toBeNull();
  });

  it('should detect pull request events', () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    expect(isPullRequest()).toBe(true);

    process.env.GITHUB_EVENT_NAME = 'push';
    expect(isPullRequest()).toBe(false);
  });

  it('should get GitHub context from environment', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_EVENT_NAME = 'push';
    process.env.GITHUB_SHA = 'abc123';
    process.env.GITHUB_REF = 'refs/heads/main';
    process.env.GITHUB_REPOSITORY = 'owner/repo';

    const context = getGitHubContext();
    expect(context).not.toBeNull();
    expect(context?.eventName).toBe('push');
    expect(context?.sha).toBe('abc123');
    expect(context?.repository).toBe('owner/repo');
  });
});

describe('ISL Adapters - PR Comment Generator', () => {
  const mockResult: GateResult = {
    verdict: 'NO_SHIP',
    score: 65,
    reasons: [
      {
        code: 'GHOST_ROUTE',
        message: '2 ghost routes detected',
        files: ['src/api.ts', 'src/routes.ts'],
        severity: 'high',
      },
      {
        code: 'MISSING_ENV',
        message: 'Missing environment variable',
        files: ['src/config.ts'],
        severity: 'medium',
      },
    ],
    evidencePath: '.isl-gate/evidence',
    fingerprint: 'abc123',
    durationMs: 150,
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  it('should generate PR comment with verdict and score', () => {
    const comment = generatePRComment(mockResult);
    
    expect(comment).toContain('NO_SHIP');
    expect(comment).toContain('65/100');
    expect(comment).toContain('GHOST_ROUTE');
    expect(comment).toContain('ghost routes');
  });

  it('should include affected files', () => {
    const comment = generatePRComment(mockResult);
    
    expect(comment).toContain('src/api.ts');
    expect(comment).toContain('Affected Files');
  });

  it('should generate compact comment', () => {
    const comment = generateCompactComment(mockResult);
    
    expect(comment).toContain('NO_SHIP');
    expect(comment).toContain('65/100');
    expect(comment).toContain('Issues: 2');
  });

  it('should generate SARIF output', () => {
    const sarif = generateSARIF(mockResult, '/project');
    
    expect(sarif).toHaveProperty('$schema');
    expect(sarif).toHaveProperty('version', '2.1.0');
    expect(sarif).toHaveProperty('runs');
  });

  it('should handle SHIP verdict', () => {
    const shipResult: GateResult = {
      ...mockResult,
      verdict: 'SHIP',
      score: 100,
      reasons: [{ code: 'PASS', message: 'All checks passed', files: [] }],
    };

    const comment = generatePRComment(shipResult);
    expect(comment).toContain('SHIP');
    expect(comment).toContain('✅');
  });
});

describe('ISL Adapters - MCP Tools', () => {
  it('should have firewall tools defined', () => {
    expect(firewallTools.length).toBeGreaterThan(0);
    
    const toolNames = firewallTools.map(t => t.name);
    expect(toolNames).toContain('firewall_evaluate');
    expect(toolNames).toContain('firewall_quick_check');
    expect(toolNames).toContain('firewall_status');
  });

  it('should have gate tools defined', () => {
    expect(gateTools.length).toBeGreaterThan(0);
    
    const toolNames = gateTools.map(t => t.name);
    expect(toolNames).toContain('gate_check');
    expect(toolNames).toContain('gate_quick_check');
  });

  it('should have valid tool schemas', () => {
    for (const tool of [...firewallTools, ...gateTools]) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema).toHaveProperty('properties');
    }
  });

  it('should handle firewall status', () => {
    const result = handleFirewallStatus(process.cwd());
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Firewall Status');
    expect(result.content[0].text).toContain('Mode:');
  });
});

describe('ISL Adapters - CLI Gate Command', () => {
  it('should run quick check', async () => {
    const result = await runQuickCheck({
      projectRoot: process.cwd(),
    });

    expect(result.verdict).toBe('SHIP');
    expect(result.exitCode).toBe(0);
  });

  it('should handle strict mode', async () => {
    const result = await runQuickCheck({
      projectRoot: process.cwd(),
      strict: true,
    });

    expect(result.exitCode).toBe(0); // SHIP = 0
  });
});
