/**
 * ISL Dependency Analyzer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ISLDependencyAnalyzer,
  createDependencyAnalyzer,
  analyzeDomain,
} from '../src/analyzer.js';
import type { DependencyInfo } from '../src/types.js';

// Mock ISL Domain
const createMockDomain = (overrides: Partial<MockDomain> = {}): MockDomain => ({
  kind: 'Domain',
  name: { name: 'TestDomain' },
  entities: [],
  behaviors: [],
  views: [],
  ...overrides,
});

interface MockDomain {
  kind: 'Domain';
  name: { name: string };
  entities: Array<{
    kind: 'Entity';
    name: { name: string };
    fields: Array<{
      name: { name: string };
      type: unknown;
      annotations: Array<{ name: { name: string }; value?: unknown }>;
    }>;
    lifecycle?: unknown;
  }>;
  behaviors: Array<{
    kind: 'Behavior';
    name: { name: string };
    observability?: unknown;
    security?: unknown[];
  }>;
  views: Array<{
    kind: 'View';
    name: { name: string };
    forEntity: { name: { parts: Array<{ name: string }> } };
    cache?: {
      ttl: { value: number; unit: string };
    };
  }>;
}

describe('ISLDependencyAnalyzer', () => {
  let analyzer: ISLDependencyAnalyzer;

  beforeEach(() => {
    analyzer = new ISLDependencyAnalyzer();
  });

  describe('constructor', () => {
    it('should create analyzer with default config', () => {
      const analyzer = new ISLDependencyAnalyzer();
      expect(analyzer).toBeInstanceOf(ISLDependencyAnalyzer);
    });

    it('should create analyzer with custom config', () => {
      const analyzer = new ISLDependencyAnalyzer({
        includeDatabase: false,
        includeCache: true,
      });
      expect(analyzer).toBeInstanceOf(ISLDependencyAnalyzer);
    });
  });

  describe('analyze', () => {
    it('should return empty array for domain without dependencies', () => {
      const domain = createMockDomain();
      const deps = analyzer.analyze(domain);
      expect(deps).toEqual([]);
    });

    it('should detect database dependency from entities', () => {
      const domain = createMockDomain({
        entities: [
          {
            kind: 'Entity',
            name: { name: 'User' },
            fields: [
              {
                name: { name: 'id' },
                type: { kind: 'PrimitiveType', name: 'UUID' },
                annotations: [{ name: { name: 'persistent' } }],
              },
            ],
          },
        ],
      });

      const deps = analyzer.analyze(domain);
      expect(deps).toHaveLength(1);
      expect(deps[0].type).toBe('database');
      expect(deps[0].name).toBe('testdomain_db');
      expect(deps[0].critical).toBe(true);
    });

    it('should detect cache dependency from views with cache spec', () => {
      const domain = createMockDomain({
        views: [
          {
            kind: 'View',
            name: { name: 'UserProfile' },
            forEntity: { name: { parts: [{ name: 'User' }] } },
            cache: { ttl: { value: 60, unit: 'seconds' } },
          },
        ],
      });

      const deps = analyzer.analyze(domain);
      const cacheDep = deps.find(d => d.type === 'cache');
      expect(cacheDep).toBeDefined();
      expect(cacheDep?.name).toBe('redis');
      expect(cacheDep?.critical).toBe(false);
    });

    it('should detect queue dependency from async behaviors', () => {
      const domain = createMockDomain({
        behaviors: [
          {
            kind: 'Behavior',
            name: { name: 'PublishUserEvent' },
          },
        ],
      });

      const deps = analyzer.analyze(domain);
      const queueDep = deps.find(d => d.type === 'queue');
      expect(queueDep).toBeDefined();
      expect(queueDep?.name).toBe('rabbitmq');
    });

    it('should detect payment gateway dependency from payment behaviors', () => {
      const domain = createMockDomain({
        behaviors: [
          {
            kind: 'Behavior',
            name: { name: 'ProcessPayment' },
          },
        ],
      });

      const deps = analyzer.analyze(domain);
      const apiDep = deps.find(d => d.type === 'external-api');
      expect(apiDep).toBeDefined();
      expect(apiDep?.critical).toBe(true);
    });

    it('should deduplicate dependencies', () => {
      const domain = createMockDomain({
        entities: [
          {
            kind: 'Entity',
            name: { name: 'User' },
            fields: [
              {
                name: { name: 'id' },
                type: {},
                annotations: [{ name: { name: 'persistent' } }],
              },
            ],
          },
          {
            kind: 'Entity',
            name: { name: 'Order' },
            fields: [
              {
                name: { name: 'id' },
                type: {},
                annotations: [{ name: { name: 'persistent' } }],
              },
            ],
          },
        ],
      });

      const deps = analyzer.analyze(domain);
      const dbDeps = deps.filter(d => d.type === 'database');
      expect(dbDeps).toHaveLength(1);
    });
  });

  describe('getSummary', () => {
    it('should return correct summary for dependencies', () => {
      const dependencies: DependencyInfo[] = [
        { type: 'database', name: 'db', critical: true, source: {} },
        { type: 'cache', name: 'cache', critical: false, source: {} },
        { type: 'queue', name: 'queue', critical: true, source: {} },
      ];

      const summary = analyzer.getSummary(dependencies);

      expect(summary.total).toBe(3);
      expect(summary.critical).toBe(2);
      expect(summary.nonCritical).toBe(1);
      expect(summary.byType.database).toBe(1);
      expect(summary.byType.cache).toBe(1);
      expect(summary.byType.queue).toBe(1);
    });
  });

  describe('addRule', () => {
    it('should allow adding custom detection rules', () => {
      analyzer.addRule({
        name: 'custom-service',
        detect: (_domain) => [
          {
            type: 'custom',
            name: 'custom-service',
            critical: false,
            source: { annotation: '@custom' },
          },
        ],
      });

      const domain = createMockDomain();
      const deps = analyzer.analyze(domain);
      const customDep = deps.find(d => d.name === 'custom-service');
      expect(customDep).toBeDefined();
    });
  });
});

describe('createDependencyAnalyzer', () => {
  it('should create an analyzer instance', () => {
    const analyzer = createDependencyAnalyzer();
    expect(analyzer).toBeInstanceOf(ISLDependencyAnalyzer);
  });

  it('should accept config options', () => {
    const analyzer = createDependencyAnalyzer({
      includeDatabase: false,
    });
    expect(analyzer).toBeInstanceOf(ISLDependencyAnalyzer);
  });
});

describe('analyzeDomain', () => {
  it('should analyze domain directly', () => {
    const domain = createMockDomain({
      entities: [
        {
          kind: 'Entity',
          name: { name: 'Test' },
          fields: [],
          lifecycle: { transitions: [] },
        },
      ],
    });

    const deps = analyzeDomain(domain);
    expect(Array.isArray(deps)).toBe(true);
  });
});
