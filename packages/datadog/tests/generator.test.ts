import { describe, it, expect } from 'vitest';
import { MonitorGenerator, createMonitorGenerator } from '../src/monitors/generator.js';
import { DashboardGenerator, createDashboardGenerator } from '../src/dashboards/generator.js';
import { SyntheticGenerator, createSyntheticGenerator } from '../src/synthetics/generator.js';
import type { Domain } from '../src/types.js';

// Sample domain for testing
const sampleDomain: Domain = {
  name: 'auth',
  description: 'Authentication domain',
  version: '1.0.0',
  behaviors: [
    {
      name: 'login',
      description: 'User login behavior',
      input: {
        email: { type: 'email' },
        password: { type: 'string' },
      },
      output: {
        token: { type: 'string' },
        user: { type: 'object' },
      },
      preconditions: [
        'input.email != null',
        'input.password.length >= 8',
      ],
      postconditions: [
        'result.token != null',
        'result.user.id != null',
      ],
      invariants: [
        'user.email is unique',
      ],
      temporal: [
        { operator: 'within', duration: '500ms', percentile: 99 },
      ],
    },
    {
      name: 'logout',
      description: 'User logout behavior',
      preconditions: ['user.authenticated'],
      postconditions: ['session.invalidated'],
    },
    {
      name: 'refreshToken',
      description: 'Refresh authentication token',
      temporal: [
        { operator: 'within', duration: '200ms', percentile: 95 },
      ],
    },
  ],
};

describe('MonitorGenerator', () => {
  let generator: MonitorGenerator;

  beforeEach(() => {
    generator = createMonitorGenerator({
      alertChannel: '@slack-test',
      criticalChannel: '@pagerduty-test',
    });
  });

  describe('generateForDomain', () => {
    it('should generate monitors for all behaviors', () => {
      const result = generator.generateForDomain(sampleDomain);

      expect(result.monitors.length).toBeGreaterThan(0);
      expect(result.summary.total).toBe(result.monitors.length);
      expect(result.summary.byDomain['auth']).toBe(result.monitors.length);
    });

    it('should include verification score monitors', () => {
      const result = generator.generateForDomain(sampleDomain);
      
      const scoreMonitors = result.monitors.filter(m => 
        m.name.includes('verification score')
      );

      expect(scoreMonitors.length).toBe(sampleDomain.behaviors.length);
    });

    it('should include failure monitors', () => {
      const result = generator.generateForDomain(sampleDomain);
      
      const failureMonitors = result.monitors.filter(m => 
        m.name.includes('verification failures')
      );

      expect(failureMonitors.length).toBe(sampleDomain.behaviors.length);
    });

    it('should generate latency monitors from temporal specs', () => {
      const result = generator.generateForDomain(sampleDomain);
      
      const latencyMonitors = result.monitors.filter(m => 
        m.name.includes('latency')
      );

      // Should have latency monitors for behaviors with temporal specs
      expect(latencyMonitors.length).toBeGreaterThan(0);
    });

    it('should generate SLO monitors', () => {
      const result = generator.generateForDomain(sampleDomain);
      
      const sloMonitors = result.monitors.filter(m => 
        m.name.includes('SLO')
      );

      expect(sloMonitors.length).toBeGreaterThan(0);
    });

    it('should include correct tags', () => {
      const result = generator.generateForDomain(sampleDomain);

      for (const monitor of result.monitors) {
        expect(monitor.tags).toContain('isl');
        expect(monitor.tags.some(t => t.startsWith('domain:'))).toBe(true);
        expect(monitor.tags.some(t => t.startsWith('behavior:'))).toBe(true);
      }
    });

    it('should include alert channels in message', () => {
      const result = generator.generateForDomain(sampleDomain);

      const criticalMonitor = result.monitors.find(m => 
        m.name.includes('verification failures')
      );

      expect(criticalMonitor?.message).toContain('@pagerduty-test');
    });
  });

  describe('toJSON', () => {
    it('should export monitors as JSON', () => {
      const result = generator.generateForDomain(sampleDomain);
      const json = generator.toJSON(result.monitors);

      expect(() => JSON.parse(json)).not.toThrow();
      
      const parsed = JSON.parse(json);
      expect(parsed.length).toBe(result.monitors.length);
    });
  });

  describe('toTerraform', () => {
    it('should export monitors as Terraform', () => {
      const result = generator.generateForDomain(sampleDomain);
      const terraform = generator.toTerraform(result.monitors);

      expect(terraform).toContain('resource "datadog_monitor"');
      expect(terraform).toContain('monitor_thresholds');
    });
  });
});

describe('DashboardGenerator', () => {
  let generator: DashboardGenerator;

  beforeEach(() => {
    generator = createDashboardGenerator();
  });

  describe('generateForDomain', () => {
    it('should generate a complete dashboard', () => {
      const dashboard = generator.generateForDomain(sampleDomain);

      expect(dashboard.title).toContain('auth');
      expect(dashboard.widgets.length).toBeGreaterThan(0);
      expect(dashboard.layout_type).toBe('ordered');
    });

    it('should include overview widgets', () => {
      const dashboard = generator.generateForDomain(sampleDomain);

      const scoreWidget = dashboard.widgets.find(w => 
        w.definition.title?.includes('Verification Score')
      );

      expect(scoreWidget).toBeDefined();
    });

    it('should include trend widgets', () => {
      const dashboard = generator.generateForDomain(sampleDomain);

      const trendWidget = dashboard.widgets.find(w => 
        w.definition.title?.includes('Trend')
      );

      expect(trendWidget).toBeDefined();
    });

    it('should include template variables', () => {
      const dashboard = generator.generateForDomain(sampleDomain);

      expect(dashboard.template_variables).toBeDefined();
      expect(dashboard.template_variables?.some(v => v.name === 'env')).toBe(true);
      expect(dashboard.template_variables?.some(v => v.name === 'behavior')).toBe(true);
    });

    it('should include per-behavior widgets when enabled', () => {
      const dashboard = generator.generateForDomain(sampleDomain);

      const loginWidget = dashboard.widgets.find(w => 
        w.definition.title?.includes('login')
      );

      expect(loginWidget).toBeDefined();
    });
  });

  describe('generateOverviewDashboard', () => {
    it('should generate overview for multiple domains', () => {
      const domains: Domain[] = [
        sampleDomain,
        { name: 'payments', behaviors: [{ name: 'charge' }] },
      ];

      const dashboard = generator.generateOverviewDashboard(domains);

      expect(dashboard.title).toContain('Overview');
      expect(dashboard.widgets.length).toBeGreaterThan(0);
    });
  });

  describe('toJSON', () => {
    it('should export dashboard as JSON', () => {
      const dashboard = generator.generateForDomain(sampleDomain);
      const json = generator.toJSON(dashboard);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});

describe('SyntheticGenerator', () => {
  let generator: SyntheticGenerator;

  beforeEach(() => {
    generator = createSyntheticGenerator({
      apiUrl: 'https://api.example.com',
      locations: ['aws:us-east-1'],
    });
  });

  describe('generateForDomain', () => {
    it('should generate tests for all behaviors', () => {
      const tests = generator.generateForDomain(sampleDomain);

      expect(tests.length).toBeGreaterThanOrEqual(sampleDomain.behaviors.length);
    });

    it('should generate API tests with correct structure', () => {
      const tests = generator.generateForDomain(sampleDomain);
      const loginTest = tests.find(t => t.name.includes('login'));

      expect(loginTest).toBeDefined();
      expect(loginTest?.type).toBe('api');
      expect(loginTest?.subtype).toBe('http');
      expect(loginTest?.config.request).toBeDefined();
      expect(loginTest?.config.assertions.length).toBeGreaterThan(0);
    });

    it('should infer correct HTTP method', () => {
      const tests = generator.generateForDomain(sampleDomain);
      const logoutTest = tests.find(t => t.name.includes('logout'));

      // logout doesn't match any pattern, should default to POST
      expect(logoutTest?.config.request.method).toBeDefined();
    });

    it('should include latency assertions from temporal specs', () => {
      const tests = generator.generateForDomain(sampleDomain);
      const loginTest = tests.find(t => t.name.includes('login') && !t.name.includes('Multi'));

      const latencyAssertion = loginTest?.config.assertions.find(
        a => a.type === 'responseTime'
      );

      expect(latencyAssertion).toBeDefined();
      expect(latencyAssertion?.target).toBe(500); // 500ms from temporal spec
    });

    it('should include correct tags', () => {
      const tests = generator.generateForDomain(sampleDomain);

      for (const test of tests) {
        expect(test.tags).toContain('isl');
        expect(test.tags).toContain('domain:auth');
        expect(test.tags).toContain('synthetic');
      }
    });

    it('should use configured locations', () => {
      const tests = generator.generateForDomain(sampleDomain);

      for (const test of tests) {
        expect(test.locations).toContain('aws:us-east-1');
      }
    });
  });

  describe('generateAPITest', () => {
    it('should generate a single API test', () => {
      const test = generator.generateAPITest('auth', sampleDomain.behaviors[0]!);

      expect(test.name).toContain('auth.login');
      expect(test.config.request.url).toContain('auth/login');
    });
  });

  describe('toJSON', () => {
    it('should export tests as JSON', () => {
      const tests = generator.generateForDomain(sampleDomain);
      const json = generator.toJSON(tests);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('toTerraform', () => {
    it('should export tests as Terraform', () => {
      const tests = generator.generateForDomain(sampleDomain);
      const terraform = generator.toTerraform(tests);

      expect(terraform).toContain('resource "datadog_synthetics_test"');
    });
  });
});
