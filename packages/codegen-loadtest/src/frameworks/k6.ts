// ============================================================================
// k6 Load Test Script Generator
// ============================================================================

import type { BehaviorSLA, InputFieldSpec } from '../ast-types';
import { formatK6Threshold, calculateSleepTime } from '../thresholds';
import {
  generateK6SmokeScenario,
  generateK6LoadScenario,
  generateK6StressScenario,
  generateK6SpikeScenario,
  generateK6SoakScenario,
  type ScenarioType,
} from '../scenarios';

export interface K6Options {
  baseUrl: string;
  scenarios: ScenarioType[];
}

/**
 * Generate complete k6 test script
 */
export function generateK6Script(behaviors: BehaviorSLA[], options: K6Options): string {
  const lines: string[] = [];

  // Imports
  lines.push(generateK6Imports());
  lines.push('');

  // Custom metrics
  lines.push(generateK6Metrics(behaviors));
  lines.push('');

  // Options with thresholds and scenarios
  lines.push(generateK6Options(behaviors, options.scenarios));
  lines.push('');

  // Test data generators
  lines.push(generateK6DataGenerators(behaviors));
  lines.push('');

  // Main test function
  lines.push(generateK6MainFunction(behaviors, options.baseUrl));
  lines.push('');

  // Setup and teardown
  lines.push(generateK6Lifecycle());
  lines.push('');

  // Summary handler
  lines.push(generateK6SummaryHandler());

  return lines.join('\n');
}

/**
 * Generate k6 imports
 */
function generateK6Imports(): string {
  return `import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';`;
}

/**
 * Generate custom metrics for each behavior
 */
function generateK6Metrics(behaviors: BehaviorSLA[]): string {
  const lines: string[] = ['// Custom metrics'];
  lines.push("const errorRate = new Rate('errors');");
  lines.push("const requestCount = new Counter('requests');");

  for (const behavior of behaviors) {
    const metricName = toSnakeCase(behavior.name);
    lines.push(`const ${metricName}Duration = new Trend('${metricName}_duration');`);
  }

  return lines.join('\n');
}

/**
 * Generate k6 options with thresholds and scenarios
 */
function generateK6Options(behaviors: BehaviorSLA[], scenarios: ScenarioType[]): string {
  const thresholds: Record<string, string[]> = {
    'errors': ['rate<0.01'],
    'http_req_duration': ['p(99)<1000'],
  };

  // Add per-behavior thresholds
  for (const behavior of behaviors) {
    const metricName = `${toSnakeCase(behavior.name)}_duration`;
    thresholds[metricName] = behavior.thresholds.map(t => formatK6Threshold(t));
  }

  // Build scenarios object
  const scenarioConfigs: Record<string, object> = {};
  
  for (const scenario of scenarios) {
    switch (scenario) {
      case 'smoke':
        Object.assign(scenarioConfigs, generateK6SmokeScenario());
        break;
      case 'load':
        Object.assign(scenarioConfigs, generateK6LoadScenario());
        break;
      case 'stress':
        Object.assign(scenarioConfigs, generateK6StressScenario());
        break;
      case 'spike':
        Object.assign(scenarioConfigs, generateK6SpikeScenario());
        break;
      case 'soak':
        Object.assign(scenarioConfigs, generateK6SoakScenario());
        break;
    }
  }

  return `// SLA Thresholds (from ISL temporal specs)
export const options = {
  thresholds: ${JSON.stringify(thresholds, null, 4).replace(/"/g, "'")},
  
  scenarios: ${JSON.stringify(scenarioConfigs, null, 4).replace(/"/g, "'")},
};`;
}

/**
 * Generate test data generators
 */
function generateK6DataGenerators(behaviors: BehaviorSLA[]): string {
  const generators = new Set<string>();
  
  for (const behavior of behaviors) {
    for (const field of behavior.inputFields) {
      generators.add(field.generator);
    }
  }

  const lines: string[] = ['// Test data generation'];

  if (generators.has('email')) {
    lines.push(`function generateEmail() {
  return \`user_\${__VU}_\${__ITER}_\${Date.now()}@loadtest.local\`;
}`);
  }

  if (generators.has('uuid')) {
    lines.push(`function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}`);
  }

  if (generators.has('string')) {
    lines.push(`function generateString(length = 10) {
  return randomString(length);
}`);
  }

  if (generators.has('number')) {
    lines.push(`function generateNumber(min = 1, max = 1000) {
  return randomIntBetween(min, max);
}`);
  }

  if (generators.has('boolean')) {
    lines.push(`function generateBoolean() {
  return Math.random() > 0.5;
}`);
  }

  if (generators.has('timestamp')) {
    lines.push(`function generateTimestamp() {
  return new Date().toISOString();
}`);
  }

  return lines.join('\n\n');
}

/**
 * Generate main test function
 */
function generateK6MainFunction(behaviors: BehaviorSLA[], baseUrl: string): string {
  const lines: string[] = [];
  
  lines.push('// Main test function');
  lines.push('export default function() {');
  lines.push(`  const BASE_URL = __ENV.BASE_URL || '${baseUrl}';`);
  lines.push('');

  for (const behavior of behaviors) {
    const groupName = behavior.name;
    const metricName = toSnakeCase(behavior.name);
    const endpoint = `\${BASE_URL}/api/${toKebabCase(behavior.name)}`;
    
    lines.push(`  group('${groupName}', function() {`);
    lines.push(`    const payload = JSON.stringify({`);
    
    for (const field of behavior.inputFields) {
      lines.push(`      ${field.name}: ${getGeneratorCall(field)},`);
    }
    
    lines.push('    });');
    lines.push('');
    lines.push("    const params = { headers: { 'Content-Type': 'application/json' } };");
    lines.push('');
    lines.push('    const start = Date.now();');
    lines.push(`    const res = http.post(\`${endpoint}\`, payload, params);`);
    lines.push('    const duration = Date.now() - start;');
    lines.push('');
    lines.push(`    ${metricName}Duration.add(duration);`);
    lines.push('    requestCount.add(1);');
    lines.push('');
    lines.push('    const success = check(res, {');
    lines.push(`      '${behavior.name} status OK': (r) => ${behavior.successCodes.map(c => `r.status === ${c}`).join(' || ')},`);
    lines.push(`      '${behavior.name} has response': (r) => r.body && r.body.length > 0,`);
    lines.push(`      '${behavior.name} response time OK': (r) => r.timings.duration < ${behavior.thresholds[behavior.thresholds.length - 1]?.durationMs || 1000},`);
    lines.push('    });');
    lines.push('');
    lines.push('    errorRate.add(!success);');
    lines.push('  });');
    lines.push('');

    // Add sleep based on rate limit
    if (behavior.rateLimits.length > 0) {
      const sleepTime = calculateSleepTime(behavior.rateLimits[0]);
      lines.push(`  // Rate limiting: ${behavior.rateLimits[0].count}/${behavior.rateLimits[0].periodSeconds}s`);
      lines.push(`  sleep(${sleepTime.toFixed(2)});`);
    } else {
      lines.push('  sleep(0.5);');
    }
    lines.push('');
  }

  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate lifecycle hooks
 */
function generateK6Lifecycle(): string {
  return `// Lifecycle hooks
export function setup() {
  console.log('Starting load test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(\`Load test completed in \${duration}s\`);
}`;
}

/**
 * Generate summary handler
 */
function generateK6SummaryHandler(): string {
  return `// Generate reports
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data),
  };
}`;
}

/**
 * Get generator function call for field
 */
function getGeneratorCall(field: InputFieldSpec): string {
  switch (field.generator) {
    case 'email':
      return 'generateEmail()';
    case 'uuid':
      return 'generateUUID()';
    case 'string':
      return 'generateString()';
    case 'number':
      return 'generateNumber()';
    case 'boolean':
      return 'generateBoolean()';
    case 'timestamp':
      return 'generateTimestamp()';
    default:
      return 'generateString()';
  }
}

/**
 * Convert to snake_case
 */
function toSnakeCase(name: string): string {
  return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/**
 * Convert to kebab-case
 */
function toKebabCase(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}
