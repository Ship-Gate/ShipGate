// ============================================================================
// Synthetic Test Generator
// ============================================================================

import type {
  DatadogSynthetic,
  SyntheticRequest,
  SyntheticAssertion,
  SyntheticOptions,
  Domain,
  Behavior,
  TemporalSpec,
} from '../types.js';

/**
 * Synthetic test generation options
 */
export interface SyntheticGeneratorOptions {
  /** Base API URL (can use {{API_URL}} variable) */
  apiUrl?: string;
  /** Default check interval in seconds (default: 300) */
  checkInterval?: number;
  /** Test locations */
  locations?: string[];
  /** Default headers */
  defaultHeaders?: Record<string, string>;
  /** Authentication configuration */
  auth?: {
    type: 'basic' | 'api_key' | 'bearer';
    value: string;
    header?: string;
  };
  /** Additional tags */
  tags?: string[];
  /** Generate browser tests (default: false) */
  includeBrowserTests?: boolean;
  /** Default timeout in ms (default: 30000) */
  defaultTimeout?: number;
  /** Retry configuration */
  retry?: {
    count: number;
    interval: number;
  };
}

const DEFAULT_OPTIONS: Required<SyntheticGeneratorOptions> = {
  apiUrl: '{{API_URL}}',
  checkInterval: 300,
  locations: ['aws:us-east-1', 'aws:eu-west-1', 'aws:ap-northeast-1'],
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  auth: {
    type: 'api_key',
    value: '{{API_KEY}}',
    header: 'X-API-Key',
  },
  tags: [],
  includeBrowserTests: false,
  defaultTimeout: 30000,
  retry: {
    count: 2,
    interval: 300,
  },
};

/**
 * Synthetic Test Generator
 * 
 * Generates Datadog synthetic tests from ISL specifications including:
 * - API tests for each behavior
 * - Assertions from postconditions
 * - Latency assertions from temporal specs
 * - Multi-step tests for complex flows
 * 
 * @example
 * ```typescript
 * const generator = new SyntheticGenerator({
 *   apiUrl: 'https://api.example.com',
 *   locations: ['aws:us-east-1'],
 * });
 * 
 * const tests = generator.generateForDomain(authDomain);
 * ```
 */
export class SyntheticGenerator {
  private options: Required<SyntheticGeneratorOptions>;

  constructor(options: SyntheticGeneratorOptions = {}) {
    this.options = { 
      ...DEFAULT_OPTIONS, 
      ...options,
      defaultHeaders: { ...DEFAULT_OPTIONS.defaultHeaders, ...options.defaultHeaders },
      retry: { ...DEFAULT_OPTIONS.retry, ...options.retry },
    };
  }

  /**
   * Generate synthetic tests for a domain
   */
  generateForDomain(domain: Domain): DatadogSynthetic[] {
    const tests: DatadogSynthetic[] = [];

    for (const behavior of domain.behaviors) {
      // API test for each behavior
      tests.push(this.generateAPITest(domain.name, behavior));

      // Multi-step test if behavior has dependencies
      if (this.hasDependencies(behavior)) {
        tests.push(this.generateMultiStepTest(domain.name, behavior));
      }
    }

    return tests;
  }

  /**
   * Generate a single API test
   */
  generateAPITest(domainName: string, behavior: Behavior): DatadogSynthetic {
    const request = this.buildRequest(domainName, behavior);
    const assertions = this.buildAssertions(behavior);

    return {
      name: `ISL: ${domainName}.${behavior.name} API Test`,
      type: 'api',
      subtype: 'http',
      config: {
        request,
        assertions,
        variables: this.buildVariables(behavior),
      },
      options: this.buildOptions(behavior),
      locations: this.options.locations,
      tags: this.buildTags(domainName, behavior),
      message: this.buildMessage(domainName, behavior),
      status: 'live',
    };
  }

  /**
   * Generate a multi-step API test
   */
  generateMultiStepTest(domainName: string, behavior: Behavior): DatadogSynthetic {
    const steps = this.buildMultiStepConfig(domainName, behavior);

    return {
      name: `ISL: ${domainName}.${behavior.name} Multi-Step Test`,
      type: 'api',
      subtype: 'multi',
      config: {
        request: {
          method: 'GET',
          url: `${this.options.apiUrl}/health`,
        },
        assertions: [
          { type: 'statusCode', operator: 'is', target: 200 },
        ],
        variables: this.buildVariables(behavior),
      },
      options: {
        ...this.buildOptions(behavior),
        tick_every: this.options.checkInterval * 2, // Less frequent for multi-step
      },
      locations: this.options.locations,
      tags: [...this.buildTags(domainName, behavior), 'multi-step'],
      message: `Multi-step test for ${domainName}.${behavior.name}`,
      status: 'live',
    };
  }

  /**
   * Generate SSL certificate test
   */
  generateSSLTest(domain: string, hostname: string): DatadogSynthetic {
    return {
      name: `ISL: ${domain} SSL Certificate`,
      type: 'api',
      subtype: 'ssl',
      config: {
        request: {
          method: 'GET',
          url: hostname,
        },
        assertions: [
          {
            type: 'certificate',
            operator: 'isInLessThan',
            target: 30, // Days until expiry
          },
        ],
      },
      options: {
        tick_every: 86400, // Daily
        min_location_failed: 1,
      },
      locations: ['aws:us-east-1'],
      tags: ['isl', `domain:${domain}`, 'ssl', 'certificate'],
      status: 'live',
    };
  }

  /**
   * Generate TCP connectivity test
   */
  generateTCPTest(domain: string, host: string, port: number): DatadogSynthetic {
    return {
      name: `ISL: ${domain} TCP Connectivity`,
      type: 'api',
      subtype: 'tcp',
      config: {
        request: {
          method: 'GET',
          url: `${host}:${port}`,
        },
        assertions: [
          { type: 'responseTime', operator: 'lessThan', target: 1000 },
        ],
      },
      options: {
        tick_every: 60, // Every minute
        min_location_failed: 2,
      },
      locations: this.options.locations,
      tags: ['isl', `domain:${domain}`, 'tcp', 'connectivity'],
      status: 'live',
    };
  }

  /**
   * Export tests as JSON
   */
  toJSON(tests: DatadogSynthetic[]): string {
    return JSON.stringify(tests, null, 2);
  }

  /**
   * Export tests as Terraform
   */
  toTerraform(tests: DatadogSynthetic[]): string {
    return tests.map(test => this.testToTerraform(test)).join('\n\n');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildRequest(domainName: string, behavior: Behavior): SyntheticRequest {
    const headers = { ...this.options.defaultHeaders };

    // Add auth header
    if (this.options.auth.type === 'api_key' && this.options.auth.header) {
      headers[this.options.auth.header] = this.options.auth.value;
    } else if (this.options.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${this.options.auth.value}`;
    }

    return {
      method: this.inferMethod(behavior),
      url: `${this.options.apiUrl}/api/${domainName}/${behavior.name}`,
      headers,
      body: this.generateSampleBody(behavior),
      timeout: this.options.defaultTimeout,
    };
  }

  private buildAssertions(behavior: Behavior): SyntheticAssertion[] {
    const assertions: SyntheticAssertion[] = [
      // Status code
      { type: 'statusCode', operator: 'is', target: 200 },
    ];

    // Latency from temporal specs
    const latencyTarget = this.getLatencyTarget(behavior);
    if (latencyTarget) {
      assertions.push({
        type: 'responseTime',
        operator: 'lessThan',
        target: latencyTarget,
      });
    }

    // Postcondition assertions
    if (behavior.postconditions) {
      assertions.push(...this.postconditionsToAssertions(behavior.postconditions));
    }

    return assertions;
  }

  private buildOptions(behavior: Behavior): SyntheticOptions {
    return {
      tick_every: this.options.checkInterval,
      min_location_failed: 1,
      retry: this.options.retry,
      follow_redirects: true,
      allow_insecure: false,
      monitor_options: {
        renotify_interval: 120,
      },
    };
  }

  private buildVariables(behavior: Behavior): Array<{ name: string; type: string; value?: string }> {
    const variables: Array<{ name: string; type: string; value?: string }> = [];

    // Add variables for input parameters
    if (behavior.input) {
      for (const [name, schema] of Object.entries(behavior.input)) {
        variables.push({
          name: `INPUT_${name.toUpperCase()}`,
          type: 'text',
          value: this.generateSampleValue(schema),
        });
      }
    }

    return variables;
  }

  private buildTags(domainName: string, behavior: Behavior): string[] {
    return [
      'isl',
      `domain:${domainName}`,
      `behavior:${behavior.name}`,
      'synthetic',
      ...this.options.tags,
    ];
  }

  private buildMessage(domainName: string, behavior: Behavior): string {
    return `Synthetic test for ${domainName}.${behavior.name}

{{#is_alert}}
🚨 Synthetic test failed!

**Domain:** ${domainName}
**Behavior:** ${behavior.name}
**Location:** {{check.public_location.name}}
**Response Time:** {{response.response_time}}ms

Please investigate immediately.
@slack-platform-alerts
{{/is_alert}}

{{#is_recovery}}
✅ Synthetic test recovered for ${behavior.name}
{{/is_recovery}}`;
  }

  private buildMultiStepConfig(domainName: string, behavior: Behavior): unknown {
    // This would generate multi-step config for complex flows
    // Simplified for this implementation
    return {
      steps: [
        {
          name: 'Setup',
          request: {
            method: 'GET',
            url: `${this.options.apiUrl}/health`,
          },
          assertions: [
            { type: 'statusCode', operator: 'is', target: 200 },
          ],
        },
        {
          name: behavior.name,
          request: this.buildRequest(domainName, behavior),
          assertions: this.buildAssertions(behavior),
        },
      ],
    };
  }

  private inferMethod(behavior: Behavior): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' {
    const name = behavior.name.toLowerCase();
    
    if (name.startsWith('get') || name.startsWith('list') || name.startsWith('find')) {
      return 'GET';
    }
    if (name.startsWith('create') || name.startsWith('add') || name.startsWith('register')) {
      return 'POST';
    }
    if (name.startsWith('update') || name.startsWith('modify')) {
      return 'PUT';
    }
    if (name.startsWith('delete') || name.startsWith('remove')) {
      return 'DELETE';
    }
    
    return 'POST';
  }

  private generateSampleBody(behavior: Behavior): string {
    if (!behavior.input) return '{}';

    const body: Record<string, unknown> = {};
    
    for (const [name, schema] of Object.entries(behavior.input)) {
      body[name] = this.generateSampleValue(schema);
    }

    return JSON.stringify(body);
  }

  private generateSampleValue(schema: unknown): string {
    if (typeof schema === 'object' && schema !== null) {
      const s = schema as { type?: string };
      switch (s.type) {
        case 'string': return 'test-value';
        case 'number': return '42';
        case 'boolean': return 'true';
        case 'email': return 'test@example.com';
        case 'uuid': return '00000000-0000-0000-0000-000000000000';
        default: return 'test';
      }
    }
    return 'test';
  }

  private getLatencyTarget(behavior: Behavior): number | null {
    if (!behavior.temporal) return null;

    for (const temporal of behavior.temporal) {
      if (temporal.operator === 'within' && temporal.duration) {
        return this.parseDuration(temporal.duration);
      }
    }

    return null;
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) return 5000; // Default 5s

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 5000;
    }
  }

  private postconditionsToAssertions(postconditions: string[]): SyntheticAssertion[] {
    const assertions: SyntheticAssertion[] = [];

    for (const postcondition of postconditions) {
      // Parse simple postconditions
      if (postcondition.includes('result.success')) {
        assertions.push({
          type: 'body',
          operator: 'contains',
          target: '"success":true',
        });
      }
      if (postcondition.includes('result.id')) {
        assertions.push({
          type: 'body',
          operator: 'matches',
          target: '"id":"[^"]+"',
        });
      }
    }

    return assertions;
  }

  private hasDependencies(behavior: Behavior): boolean {
    // Check if behavior has preconditions that suggest dependencies
    if (!behavior.preconditions) return false;
    
    return behavior.preconditions.some(p => 
      p.includes('authenticated') || 
      p.includes('exists') || 
      p.includes('valid')
    );
  }

  private testToTerraform(test: DatadogSynthetic): string {
    const resourceName = test.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    return `
resource "datadog_synthetics_test" "${resourceName}" {
  name      = ${JSON.stringify(test.name)}
  type      = ${JSON.stringify(test.type)}
  subtype   = ${JSON.stringify(test.subtype ?? 'http')}
  status    = ${JSON.stringify(test.status ?? 'live')}
  message   = <<-EOT
${test.message ?? ''}
  EOT
  locations = ${JSON.stringify(test.locations)}
  tags      = ${JSON.stringify(test.tags)}

  options_list {
    tick_every         = ${test.options.tick_every}
    min_location_failed = ${test.options.min_location_failed ?? 1}
    
    retry {
      count    = ${test.options.retry?.count ?? 2}
      interval = ${test.options.retry?.interval ?? 300}
    }
  }

  request_definition {
    method = ${JSON.stringify(test.config.request.method)}
    url    = ${JSON.stringify(test.config.request.url)}
    ${test.config.request.body ? `body   = ${JSON.stringify(test.config.request.body)}` : ''}
  }

  ${test.config.assertions.map(a => `
  assertion {
    type     = ${JSON.stringify(a.type)}
    operator = ${JSON.stringify(a.operator)}
    target   = ${JSON.stringify(String(a.target))}
  }`).join('\n')}
}`;
  }
}

/**
 * Create a synthetic test generator
 */
export function createSyntheticGenerator(options?: SyntheticGeneratorOptions): SyntheticGenerator {
  return new SyntheticGenerator(options);
}

/**
 * Generate synthetic tests for a domain (convenience function)
 */
export function generateSyntheticTests(
  domain: Domain,
  options?: SyntheticGeneratorOptions
): DatadogSynthetic[] {
  const generator = new SyntheticGenerator(options);
  return generator.generateForDomain(domain);
}
