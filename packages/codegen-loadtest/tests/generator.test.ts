// ============================================================================
// Load Test Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  generate,
  extractBehaviorSLA,
  extractThresholds,
  durationToMs,
  calculateSleepTime,
  formatK6Threshold,
  generateK6Script,
  generateArtilleryConfig,
  generateGatlingSimulation,
} from '../src';
import type { Domain, Behavior, TemporalSpec, BehaviorSLA } from '../src/ast-types';

// Helper to create source location
const loc = () => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
});

// Helper to create identifier
const id = (name: string) => ({ kind: 'Identifier' as const, name, location: loc() });

// Helper to create string literal
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, location: loc() });

// Helper to create duration literal
const dur = (value: number, unit: 'ms' | 'seconds' | 'minutes') => ({
  kind: 'DurationLiteral' as const,
  value,
  unit,
  location: loc(),
});

describe('Duration Conversion', () => {
  it('should convert milliseconds', () => {
    expect(durationToMs({ kind: 'DurationLiteral', value: 200, unit: 'ms', location: loc() })).toBe(200);
  });

  it('should convert seconds', () => {
    expect(durationToMs({ kind: 'DurationLiteral', value: 1, unit: 'seconds', location: loc() })).toBe(1000);
  });

  it('should convert minutes', () => {
    expect(durationToMs({ kind: 'DurationLiteral', value: 2, unit: 'minutes', location: loc() })).toBe(120000);
  });

  it('should convert hours', () => {
    expect(durationToMs({ kind: 'DurationLiteral', value: 1, unit: 'hours', location: loc() })).toBe(3600000);
  });
});

describe('Threshold Extraction', () => {
  it('should extract thresholds from temporal specs', () => {
    const temporalSpecs: TemporalSpec[] = [
      {
        kind: 'TemporalSpec',
        operator: 'within',
        predicate: id('response'),
        duration: dur(200, 'ms'),
        percentile: 50,
        location: loc(),
      },
      {
        kind: 'TemporalSpec',
        operator: 'within',
        predicate: id('response'),
        duration: dur(500, 'ms'),
        percentile: 95,
        location: loc(),
      },
      {
        kind: 'TemporalSpec',
        operator: 'within',
        predicate: id('response'),
        duration: dur(1, 'seconds'),
        percentile: 99,
        location: loc(),
      },
    ];

    const thresholds = extractThresholds(temporalSpecs);

    expect(thresholds).toHaveLength(3);
    expect(thresholds[0]).toEqual({ percentile: 50, durationMs: 200 });
    expect(thresholds[1]).toEqual({ percentile: 95, durationMs: 500 });
    expect(thresholds[2]).toEqual({ percentile: 99, durationMs: 1000 });
  });

  it('should provide defaults when no thresholds', () => {
    const thresholds = extractThresholds([]);
    
    expect(thresholds).toHaveLength(3);
    expect(thresholds).toContainEqual({ percentile: 50, durationMs: 200 });
    expect(thresholds).toContainEqual({ percentile: 95, durationMs: 500 });
    expect(thresholds).toContainEqual({ percentile: 99, durationMs: 1000 });
  });
});

describe('Sleep Time Calculation', () => {
  it('should calculate sleep time for rate limit', () => {
    const sleepTime = calculateSleepTime({
      count: 100,
      periodSeconds: 60,
      scope: 'user',
    });

    // 100 requests per 60 seconds = ~1.67 requests/second
    // Sleep should be around 0.54 seconds (0.6 * 0.9)
    expect(sleepTime).toBeGreaterThan(0.5);
    expect(sleepTime).toBeLessThan(0.7);
  });

  it('should handle high rate limits', () => {
    const sleepTime = calculateSleepTime({
      count: 1000,
      periodSeconds: 60,
      scope: 'user',
    });

    expect(sleepTime).toBeGreaterThanOrEqual(0.1);
  });
});

describe('K6 Threshold Formatting', () => {
  it('should format threshold for k6', () => {
    expect(formatK6Threshold({ percentile: 50, durationMs: 200 })).toBe('p(50)<200');
    expect(formatK6Threshold({ percentile: 95, durationMs: 500 })).toBe('p(95)<500');
    expect(formatK6Threshold({ percentile: 99, durationMs: 1000 })).toBe('p(99)<1000');
  });
});

describe('Behavior SLA Extraction', () => {
  it('should extract SLA from behavior', () => {
    const behavior: Behavior = {
      kind: 'Behavior',
      name: id('CreateUser'),
      description: str('Create a new user'),
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: id('email'),
            type: { kind: 'PrimitiveType', name: 'String', location: loc() },
            optional: false,
            annotations: [],
            location: loc(),
          },
          {
            kind: 'Field',
            name: id('username'),
            type: { kind: 'PrimitiveType', name: 'String', location: loc() },
            optional: false,
            annotations: [],
            location: loc(),
          },
        ],
        location: loc(),
      },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
        errors: [],
        location: loc(),
      },
      temporal: [
        {
          kind: 'TemporalSpec',
          operator: 'within',
          predicate: id('response'),
          duration: dur(200, 'ms'),
          percentile: 50,
          location: loc(),
        },
      ],
      security: [
        {
          kind: 'SecuritySpec',
          type: 'rate_limit',
          details: id('100_per_minute'),
          location: loc(),
        },
      ],
      location: loc(),
    };

    const sla = extractBehaviorSLA(behavior);

    expect(sla.name).toBe('CreateUser');
    expect(sla.thresholds.length).toBeGreaterThan(0);
    expect(sla.rateLimits.length).toBeGreaterThan(0);
    expect(sla.inputFields).toHaveLength(2);
    expect(sla.inputFields[0].name).toBe('email');
    expect(sla.inputFields[0].generator).toBe('email');
    expect(sla.inputFields[1].name).toBe('username');
  });
});

describe('K6 Script Generation', () => {
  it('should generate k6 script', () => {
    const behaviors: BehaviorSLA[] = [
      {
        name: 'CreateUser',
        thresholds: [
          { percentile: 50, durationMs: 200 },
          { percentile: 95, durationMs: 500 },
        ],
        rateLimits: [{ count: 100, periodSeconds: 60, scope: 'user' }],
        inputFields: [
          { name: 'email', type: 'String', optional: false, generator: 'email' },
          { name: 'username', type: 'String', optional: false, generator: 'string' },
        ],
        successCodes: [200, 201],
        maxErrorRate: 1,
      },
    ];

    const script = generateK6Script(behaviors, {
      baseUrl: 'http://localhost:3000',
      scenarios: ['smoke', 'load'],
    });

    expect(script).toContain("import http from 'k6/http'");
    expect(script).toContain('export const options');
    expect(script).toContain("'p(50)<200'");
    expect(script).toContain("'p(95)<500'");
    expect(script).toContain("'smoke':");
    expect(script).toContain("'load':");
    expect(script).toContain('generateEmail()');
    expect(script).toContain('export default function()');
    expect(script).toContain("group('CreateUser'");
    expect(script).toContain('handleSummary');
  });
});

describe('Artillery Config Generation', () => {
  it('should generate Artillery YAML config', () => {
    const behaviors: BehaviorSLA[] = [
      {
        name: 'CreateUser',
        thresholds: [
          { percentile: 50, durationMs: 200 },
          { percentile: 95, durationMs: 500 },
        ],
        rateLimits: [{ count: 100, periodSeconds: 60, scope: 'user' }],
        inputFields: [
          { name: 'email', type: 'String', optional: false, generator: 'email' },
        ],
        successCodes: [200, 201],
        maxErrorRate: 1,
      },
    ];

    const config = generateArtilleryConfig(behaviors, {
      baseUrl: 'http://localhost:3000',
      scenarios: ['load'],
    });

    expect(config).toContain('target: "http://localhost:3000"');
    expect(config).toContain('phases:');
    expect(config).toContain('p50: 200');
    expect(config).toContain('p95: 500');
    expect(config).toContain('scenarios:');
    expect(config).toContain('CreateUser');
    expect(config).toContain('$randomEmail()');
  });
});

describe('Gatling Simulation Generation', () => {
  it('should generate Gatling Scala simulation', () => {
    const behaviors: BehaviorSLA[] = [
      {
        name: 'CreateUser',
        thresholds: [
          { percentile: 50, durationMs: 200 },
          { percentile: 99, durationMs: 1000 },
        ],
        rateLimits: [{ count: 100, periodSeconds: 60, scope: 'user' }],
        inputFields: [
          { name: 'email', type: 'String', optional: false, generator: 'email' },
          { name: 'userId', type: 'UUID', optional: false, generator: 'uuid' },
        ],
        successCodes: [200, 201],
        maxErrorRate: 1,
      },
    ];

    const simulation = generateGatlingSimulation(behaviors, {
      baseUrl: 'http://localhost:3000',
      scenarios: ['load'],
      packageName: 'loadtest',
      simulationName: 'TestSimulation',
    });

    expect(simulation).toContain('package loadtest');
    expect(simulation).toContain('import io.gatling.core.Predef._');
    expect(simulation).toContain('class TestSimulation extends Simulation');
    expect(simulation).toContain('baseUrl("http://localhost:3000")');
    expect(simulation).toContain('createUserChain');
    expect(simulation).toContain('${randomEmail}');
    expect(simulation).toContain('${randomUuid}');
    expect(simulation).toContain('responseTime.percentile(50).lt(200)');
    expect(simulation).toContain('responseTime.percentile(99).lt(1000)');
  });
});

describe('Full Generation', () => {
  it('should generate k6 files', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('UserService'),
      version: str('1.0.0'),
      types: [],
      entities: [],
      behaviors: [
        {
          kind: 'Behavior',
          name: id('CreateUser'),
          input: {
            kind: 'InputSpec',
            fields: [
              {
                kind: 'Field',
                name: id('email'),
                type: { kind: 'PrimitiveType', name: 'String', location: loc() },
                optional: false,
                annotations: [],
                location: loc(),
              },
            ],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
            errors: [],
            location: loc(),
          },
          temporal: [
            {
              kind: 'TemporalSpec',
              operator: 'within',
              predicate: id('response'),
              duration: dur(200, 'ms'),
              percentile: 50,
              location: loc(),
            },
            {
              kind: 'TemporalSpec',
              operator: 'within',
              predicate: id('response'),
              duration: dur(500, 'ms'),
              percentile: 95,
              location: loc(),
            },
          ],
          security: [],
          location: loc(),
        },
      ],
      location: loc(),
    };

    const files = generate(domain, {
      framework: 'k6',
      scenarios: ['smoke', 'load'],
      baseUrl: 'http://api.test.com',
    });

    expect(files.length).toBeGreaterThan(0);
    
    const testFile = files.find(f => f.path.endsWith('test.js'));
    expect(testFile).toBeDefined();
    expect(testFile?.content).toContain('http://api.test.com');
    expect(testFile?.content).toContain('CreateUser');
    
    const packageFile = files.find(f => f.path.endsWith('package.json'));
    expect(packageFile).toBeDefined();
    
    const readmeFile = files.find(f => f.path.endsWith('README.md'));
    expect(readmeFile).toBeDefined();
  });

  it('should generate Artillery files', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('TestService'),
      version: str('1.0.0'),
      types: [],
      entities: [],
      behaviors: [
        {
          kind: 'Behavior',
          name: id('GetUsers'),
          input: {
            kind: 'InputSpec',
            fields: [],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'String', location: loc() },
            errors: [],
            location: loc(),
          },
          temporal: [],
          security: [],
          location: loc(),
        },
      ],
      location: loc(),
    };

    const files = generate(domain, {
      framework: 'artillery',
      scenarios: ['load'],
    });

    const configFile = files.find(f => f.path.endsWith('.yml'));
    expect(configFile).toBeDefined();
    expect(configFile?.content).toContain('target:');
    expect(configFile?.content).toContain('phases:');

    const helpersFile = files.find(f => f.path.endsWith('helpers.js'));
    expect(helpersFile).toBeDefined();
  });

  it('should generate Gatling files', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('TestService'),
      version: str('1.0.0'),
      types: [],
      entities: [],
      behaviors: [
        {
          kind: 'Behavior',
          name: id('ProcessOrder'),
          input: {
            kind: 'InputSpec',
            fields: [
              {
                kind: 'Field',
                name: id('orderId'),
                type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
                optional: false,
                annotations: [],
                location: loc(),
              },
            ],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
            errors: [],
            location: loc(),
          },
          temporal: [],
          security: [],
          location: loc(),
        },
      ],
      location: loc(),
    };

    const files = generate(domain, {
      framework: 'gatling',
      scenarios: ['stress'],
    });

    const scalaFile = files.find(f => f.path.endsWith('.scala'));
    expect(scalaFile).toBeDefined();
    expect(scalaFile?.content).toContain('extends Simulation');
    expect(scalaFile?.content).toContain('ProcessOrder');

    const buildFile = files.find(f => f.path.endsWith('build.sbt'));
    expect(buildFile).toBeDefined();
    expect(buildFile?.content).toContain('GatlingPlugin');
  });
});
