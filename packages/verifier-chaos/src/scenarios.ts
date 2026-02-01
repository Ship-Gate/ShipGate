/**
 * Chaos Scenarios Parser
 * 
 * Parses and validates chaos scenarios from ISL domain definitions.
 */

import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';

export type InjectionType = 
  | 'database_failure'
  | 'network_latency'
  | 'network_partition'
  | 'service_unavailable'
  | 'cpu_pressure'
  | 'memory_pressure'
  | 'clock_skew'
  | 'concurrent_requests';

export interface ChaosInjection {
  type: InjectionType;
  target?: string;
  parameters: Record<string, unknown>;
}

export interface ChaosAssertion {
  type: 'error_returned' | 'recovery' | 'timeout' | 'state_check' | 'invariant';
  expected: unknown;
  message?: string;
}

export interface ParsedChaosScenario {
  name: string;
  behaviorName: string;
  injections: ChaosInjection[];
  setup: ChaosStep[];
  actions: ChaosStep[];
  assertions: ChaosAssertion[];
}

export interface ChaosStep {
  type: 'call' | 'assign' | 'wait';
  target?: string;
  value?: unknown;
  arguments?: Record<string, unknown>;
  delayMs?: number;
}

export interface ScenarioParseResult {
  success: boolean;
  scenarios: ParsedChaosScenario[];
  errors: ScenarioError[];
}

export interface ScenarioError {
  scenario?: string;
  message: string;
  location?: { line: number; column: number };
}

/**
 * Parse chaos scenarios from a domain declaration
 */
export function parseChaosScenarios(
  domain: DomainDeclaration,
  behaviorName?: string
): ScenarioParseResult {
  const scenarios: ParsedChaosScenario[] = [];
  const errors: ScenarioError[] = [];

  // For now, we'll extract chaos scenarios from behavior definitions
  // In a full implementation, this would parse the chaos blocks from the AST
  
  const behaviors = behaviorName
    ? domain.behaviors.filter(b => b.name.name === behaviorName)
    : domain.behaviors;

  for (const behavior of behaviors) {
    // Generate default chaos scenarios based on behavior definition
    const defaultScenarios = generateDefaultChaosScenarios(behavior);
    scenarios.push(...defaultScenarios);
  }

  return {
    success: errors.length === 0,
    scenarios,
    errors,
  };
}

/**
 * Parse chaos scenarios from scenario names
 */
export function parseScenarioNames(
  domain: DomainDeclaration,
  behaviorName: string,
  scenarioNames: string[]
): ScenarioParseResult {
  const allResult = parseChaosScenarios(domain, behaviorName);
  
  if (scenarioNames.length === 0) {
    return allResult;
  }

  const filtered = allResult.scenarios.filter(s => 
    scenarioNames.includes(s.name) || 
    scenarioNames.some(name => s.name.includes(name))
  );

  const notFound = scenarioNames.filter(name => 
    !filtered.some(s => s.name.includes(name))
  );

  const errors = [
    ...allResult.errors,
    ...notFound.map(name => ({
      message: `Scenario not found: ${name}`,
    })),
  ];

  return {
    success: errors.length === 0,
    scenarios: filtered,
    errors,
  };
}

/**
 * Generate default chaos scenarios for a behavior
 */
function generateDefaultChaosScenarios(
  behavior: BehaviorDeclaration
): ParsedChaosScenario[] {
  const scenarios: ParsedChaosScenario[] = [];
  const behaviorName = behavior.name.name;

  // Database failure scenario
  scenarios.push({
    name: `${behaviorName}_database_failure`,
    behaviorName,
    injections: [{
      type: 'database_failure',
      parameters: { failureType: 'unavailable' },
    }],
    setup: [],
    actions: [{
      type: 'call',
      target: behaviorName,
      arguments: {},
    }],
    assertions: [{
      type: 'error_returned',
      expected: true,
      message: 'Should return error when database is unavailable',
    }],
  });

  // Network latency scenario
  scenarios.push({
    name: `${behaviorName}_network_latency`,
    behaviorName,
    injections: [{
      type: 'network_latency',
      parameters: { latencyMs: 5000 },
    }],
    setup: [],
    actions: [{
      type: 'call',
      target: behaviorName,
      arguments: {},
    }],
    assertions: [{
      type: 'timeout',
      expected: false,
      message: 'Should handle network latency gracefully',
    }],
  });

  // Service unavailable scenario
  scenarios.push({
    name: `${behaviorName}_service_unavailable`,
    behaviorName,
    injections: [{
      type: 'service_unavailable',
      parameters: { statusCode: 503 },
    }],
    setup: [],
    actions: [{
      type: 'call',
      target: behaviorName,
      arguments: {},
    }],
    assertions: [{
      type: 'error_returned',
      expected: true,
      message: 'Should handle service unavailability',
    }],
  });

  // Concurrent requests scenario
  scenarios.push({
    name: `${behaviorName}_concurrent_requests`,
    behaviorName,
    injections: [{
      type: 'concurrent_requests',
      parameters: { concurrency: 10 },
    }],
    setup: [],
    actions: [{
      type: 'call',
      target: behaviorName,
      arguments: {},
    }],
    assertions: [{
      type: 'invariant',
      expected: 'consistent_state',
      message: 'Should maintain consistency under concurrent load',
    }],
  });

  return scenarios;
}

/**
 * Create a custom chaos scenario
 */
export function createChaosScenario(
  name: string,
  behaviorName: string,
  config: {
    injections: ChaosInjection[];
    setup?: ChaosStep[];
    actions?: ChaosStep[];
    assertions?: ChaosAssertion[];
  }
): ParsedChaosScenario {
  return {
    name,
    behaviorName,
    injections: config.injections,
    setup: config.setup ?? [],
    actions: config.actions ?? [{
      type: 'call',
      target: behaviorName,
      arguments: {},
    }],
    assertions: config.assertions ?? [{
      type: 'error_returned',
      expected: true,
    }],
  };
}

/**
 * Validate a chaos scenario
 */
export function validateScenario(
  scenario: ParsedChaosScenario,
  domain: DomainDeclaration
): ScenarioError[] {
  const errors: ScenarioError[] = [];

  // Check behavior exists
  const behavior = domain.behaviors.find(b => b.name.name === scenario.behaviorName);
  if (!behavior) {
    errors.push({
      scenario: scenario.name,
      message: `Behavior not found: ${scenario.behaviorName}`,
    });
    return errors;
  }

  // Validate injections
  for (const injection of scenario.injections) {
    if (!isValidInjectionType(injection.type)) {
      errors.push({
        scenario: scenario.name,
        message: `Invalid injection type: ${injection.type}`,
      });
    }
  }

  // Validate assertions
  if (scenario.assertions.length === 0) {
    errors.push({
      scenario: scenario.name,
      message: 'Scenario must have at least one assertion',
    });
  }

  return errors;
}

/**
 * Check if injection type is valid
 */
function isValidInjectionType(type: string): type is InjectionType {
  const validTypes: InjectionType[] = [
    'database_failure',
    'network_latency',
    'network_partition',
    'service_unavailable',
    'cpu_pressure',
    'memory_pressure',
    'clock_skew',
    'concurrent_requests',
  ];
  return validTypes.includes(type as InjectionType);
}

/**
 * Get all injection types supported
 */
export function getSupportedInjectionTypes(): InjectionType[] {
  return [
    'database_failure',
    'network_latency',
    'network_partition',
    'service_unavailable',
    'cpu_pressure',
    'memory_pressure',
    'clock_skew',
    'concurrent_requests',
  ];
}
