// ============================================================================
// Artillery Load Test Generator
// ============================================================================

import type { BehaviorSLA, InputFieldSpec } from '../ast-types';
import { formatArtilleryThreshold } from '../thresholds';
import {
  generateArtillerySmokePhases,
  generateArtilleryLoadPhases,
  generateArtilleryStressPhases,
  generateArtillerySpikePhases,
  generateArtillerySoakPhases,
  type ScenarioType,
} from '../scenarios';

export interface ArtilleryOptions {
  baseUrl: string;
  scenarios: ScenarioType[];
}

/**
 * Generate complete Artillery YAML config
 */
export function generateArtilleryConfig(behaviors: BehaviorSLA[], options: ArtilleryOptions): string {
  const config = buildArtilleryConfig(behaviors, options);
  return toYAML(config);
}

/**
 * Build Artillery config object
 */
function buildArtilleryConfig(behaviors: BehaviorSLA[], options: ArtilleryOptions): object {
  // Get phases from selected scenarios
  const phases = getPhases(options.scenarios);
  
  // Build ensure thresholds
  const ensure: Record<string, number> = {
    maxErrorRate: 1,
  };
  
  // Use first behavior's thresholds (or aggregate)
  if (behaviors.length > 0) {
    for (const threshold of behaviors[0].thresholds) {
      const formatted = formatArtilleryThreshold(threshold);
      ensure[formatted.key] = formatted.value;
    }
  }

  // Build scenarios
  const scenarios = behaviors.map(behavior => buildArtilleryScenario(behavior, options.baseUrl));

  return {
    config: {
      target: options.baseUrl,
      phases,
      ensure,
      plugins: {
        expect: {},
      },
      processor: './helpers.js',
    },
    scenarios,
  };
}

/**
 * Get phases based on selected scenarios
 */
function getPhases(scenarios: ScenarioType[]): object[] {
  const allPhases: object[] = [];

  for (const scenario of scenarios) {
    switch (scenario) {
      case 'smoke':
        allPhases.push(...generateArtillerySmokePhases());
        break;
      case 'load':
        allPhases.push(...generateArtilleryLoadPhases());
        break;
      case 'stress':
        allPhases.push(...generateArtilleryStressPhases());
        break;
      case 'spike':
        allPhases.push(...generateArtillerySpikePhases());
        break;
      case 'soak':
        allPhases.push(...generateArtillerySoakPhases());
        break;
    }
  }

  // If no scenarios selected, use load by default
  if (allPhases.length === 0) {
    return generateArtilleryLoadPhases();
  }

  return allPhases;
}

/**
 * Build Artillery scenario for a behavior
 */
function buildArtilleryScenario(behavior: BehaviorSLA, baseUrl: string): object {
  const endpoint = `/api/${toKebabCase(behavior.name)}`;
  
  // Build JSON payload with template variables
  const jsonPayload: Record<string, string> = {};
  for (const field of behavior.inputFields) {
    jsonPayload[field.name] = getArtilleryGenerator(field);
  }

  // Build capture and expect
  const flow: Array<Record<string, unknown>> = [
    {
      post: {
        url: endpoint,
        json: jsonPayload,
        capture: [
          {
            json: '$.id',
            as: 'responseId',
          },
        ],
        expect: [
          {
            statusCode: behavior.successCodes,
          },
        ],
      },
    },
  ];

  // Add rate limiting pause if needed
  if (behavior.rateLimits.length > 0) {
    const rateLimit = behavior.rateLimits[0];
    const pauseMs = Math.ceil((rateLimit.periodSeconds * 1000) / rateLimit.count);
    flow.push({ think: pauseMs / 1000 });
  }

  return {
    name: behavior.name,
    flow,
  };
}

/**
 * Get Artillery template generator for field
 */
function getArtilleryGenerator(field: InputFieldSpec): string {
  switch (field.generator) {
    case 'email':
      return '{{ $randomEmail() }}';
    case 'uuid':
      return '{{ $uuid() }}';
    case 'string':
      return '{{ $randomString(10) }}';
    case 'number':
      return '{{ $randomNumber(1, 1000) }}';
    case 'boolean':
      return '{{ $randomBoolean() }}';
    case 'timestamp':
      return '{{ $timestamp() }}';
    default:
      return '{{ $randomString(10) }}';
  }
}

/**
 * Generate Artillery helpers.js file
 */
export function generateArtilleryHelpers(): string {
  return `// Artillery helper functions
module.exports = {
  generateEmail,
  generateUUID,
  setRandomValues,
  logResponse,
};

function generateEmail(requestParams, context, ee, next) {
  context.vars.email = \`user_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}@loadtest.local\`;
  return next();
}

function generateUUID(requestParams, context, ee, next) {
  context.vars.uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return next();
}

function setRandomValues(requestParams, context, ee, next) {
  context.vars.randomString = Math.random().toString(36).substr(2, 10);
  context.vars.randomNumber = Math.floor(Math.random() * 1000) + 1;
  context.vars.timestamp = new Date().toISOString();
  return next();
}

function logResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.error(\`Error \${response.statusCode}: \${response.body}\`);
  }
  return next();
}
`;
}

/**
 * Convert object to YAML string
 */
function toYAML(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  const lines: string[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        const itemLines = toYAML(item, indent + 1).split('\n').filter(l => l.trim());
        lines.push(`${spaces}- ${itemLines[0].trim()}`);
        for (let i = 1; i < itemLines.length; i++) {
          lines.push(`${spaces}  ${itemLines[i].trim()}`);
        }
      } else {
        lines.push(`${spaces}- ${formatYAMLValue(item)}`);
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        lines.push(toYAML(value, indent + 1));
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${spaces}${key}:`);
        lines.push(toYAML(value, indent + 1));
      } else {
        lines.push(`${spaces}${key}: ${formatYAMLValue(value)}`);
      }
    }
  } else {
    return formatYAMLValue(obj);
  }

  return lines.join('\n');
}

/**
 * Format value for YAML
 */
function formatYAMLValue(value: unknown): string {
  if (typeof value === 'string') {
    // Quote strings that contain special characters or look like templates
    if (value.includes('{{') || value.includes(':') || value.includes('#')) {
      return `"${value}"`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) {
    return 'null';
  }
  return String(value);
}

/**
 * Convert to kebab-case
 */
function toKebabCase(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}
