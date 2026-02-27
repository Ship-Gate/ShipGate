/**
 * Grafana Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generate, generateJSON, Domain } from '../src/generator.js';

// Helper to create mock domain
function createMockDomain(name: string, behaviors: string[]): Domain {
  return {
    name: { value: name },
    behaviors: behaviors.map(b => ({
      name: { value: b },
    })),
  };
}

describe('Grafana Generator', () => {
  describe('generate', () => {
    it('should generate dashboard for domain', () => {
      const domain = createMockDomain('Auth', ['Login', 'Logout', 'Register']);
      const result = generate(domain);
      
      expect(result).toBeDefined();
      expect(result.dashboard).toBeDefined();
      expect(result.dashboard.title).toBe('ISL - Auth Domain');
      expect(result.dashboard.uid).toBe('isl-auth');
      expect(result.dashboard.tags).toContain('isl');
      expect(result.dashboard.tags).toContain('verification');
      expect(result.dashboard.tags).toContain('auth');
    });

    it('should include templating variables', () => {
      const domain = createMockDomain('Payments', ['CreatePayment', 'RefundPayment']);
      const result = generate(domain);
      
      expect(result.dashboard.templating).toBeDefined();
      expect(result.dashboard.templating?.list).toBeDefined();
      
      const varNames = result.dashboard.templating?.list.map(v => v.name) ?? [];
      expect(varNames).toContain('datasource');
      expect(varNames).toContain('domain');
      expect(varNames).toContain('behavior');
    });

    it('should generate panels', () => {
      const domain = createMockDomain('Users', ['CreateUser']);
      const result = generate(domain);
      
      expect(result.dashboard.panels).toBeDefined();
      expect(result.dashboard.panels?.length).toBeGreaterThan(0);
    });

    it('should include row panels', () => {
      const domain = createMockDomain('Test', ['TestBehavior']);
      const result = generate(domain);
      
      const rowPanels = result.dashboard.panels?.filter(p => p.type === 'row') ?? [];
      expect(rowPanels.length).toBeGreaterThan(0);
      
      const rowTitles = rowPanels.map(p => p.title);
      expect(rowTitles).toContain('Overview');
      expect(rowTitles).toContain('Trust Score');
      expect(rowTitles).toContain('Verification Trends');
      expect(rowTitles).toContain('Coverage');
      expect(rowTitles).toContain('Latency');
    });

    it('should respect options', () => {
      const domain = createMockDomain('Test', ['TestBehavior']);
      const result = generate(domain, { 
        refresh: '1m',
        includeChaos: false,
      });
      
      expect(result.dashboard.refresh).toBe('1m');
      
      const rowTitles = result.dashboard.panels
        ?.filter(p => p.type === 'row')
        .map(p => p.title) ?? [];
      expect(rowTitles).not.toContain('Chaos Testing');
    });
  });

  describe('generateJSON', () => {
    it('should return valid JSON string', () => {
      const domain = createMockDomain('Test', ['TestBehavior']);
      const json = generateJSON(domain);
      
      expect(() => JSON.parse(json)).not.toThrow();
      
      const parsed = JSON.parse(json);
      expect(parsed.dashboard).toBeDefined();
      expect(parsed.dashboard.title).toBe('ISL - Test Domain');
    });

    it('should format JSON with indentation', () => {
      const domain = createMockDomain('Test', ['TestBehavior']);
      const json = generateJSON(domain);
      
      // Check for indentation (2 spaces)
      expect(json).toContain('\n  ');
    });
  });

  describe('Panel Configuration', () => {
    it('should include trust score gauge with thresholds', () => {
      const domain = createMockDomain('Auth', ['Login']);
      const result = generate(domain);
      
      const panels = result.dashboard.panels ?? [];
      const trustPanel = panels.find(p => p.title === 'Trust Score');
      
      expect(trustPanel).toBeDefined();
      expect(trustPanel?.type).toBe('gauge');
    });

    it('should include verification rate stat', () => {
      const domain = createMockDomain('Auth', ['Login']);
      const result = generate(domain);
      
      const panels = result.dashboard.panels ?? [];
      const ratePanel = panels.find(p => p.title === 'Verification Rate');
      
      expect(ratePanel).toBeDefined();
      expect(ratePanel?.type).toBe('stat');
    });

    it('should include timeseries panels', () => {
      const domain = createMockDomain('Auth', ['Login']);
      const result = generate(domain);
      
      const panels = result.dashboard.panels ?? [];
      const timeseriesPanels = panels.filter(p => p.type === 'timeseries');
      
      expect(timeseriesPanels.length).toBeGreaterThan(0);
    });
  });

  describe('Prometheus Queries', () => {
    it('should use correct metric names', () => {
      const domain = createMockDomain('Auth', ['Login']);
      const json = generateJSON(domain);
      
      expect(json).toContain('isl_trust_score');
      expect(json).toContain('isl_verification_total');
      expect(json).toContain('isl_coverage_ratio');
      expect(json).toContain('isl_implementation_latency_seconds');
    });

    it('should include domain label in queries', () => {
      const domain = createMockDomain('Auth', ['Login']);
      const json = generateJSON(domain);
      
      expect(json).toContain("domain='auth'");
    });
  });
});
