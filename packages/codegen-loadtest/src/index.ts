// ============================================================================
// ISL Load Test Generator - Public API
// ============================================================================

export {
  generateLoadTests,
  type GeneratorOptions,
  type GeneratedFile,
} from './generator';

// Framework exports
export {
  generateK6Script,
  generateArtilleryConfig,
  generateArtilleryHelpers,
  generateGatlingSimulation,
  generateGatlingBuildSbt,
  generateGatlingPluginsSbt,
  type K6Options,
  type ArtilleryOptions,
  type GatlingOptions,
  type Framework,
} from './frameworks';

// Scenario exports
export {
  generateK6SmokeScenario,
  generateK6LoadScenario,
  generateK6StressScenario,
  generateK6SpikeScenario,
  generateK6SoakScenario,
  generateArtillerySmokePhases,
  generateArtilleryLoadPhases,
  generateArtilleryStressPhases,
  generateArtillerySpikePhases,
  generateArtillerySoakPhases,
  generateGatlingSmokeScenario,
  generateGatlingLoadScenario,
  generateGatlingStressScenario,
  generateGatlingSpikeScenario,
  generateGatlingSoakScenario,
  ALL_SCENARIOS,
  type ScenarioType,
  type SmokeConfig,
  type LoadConfig,
  type StressConfig,
  type SpikeConfig,
  type SoakConfig,
} from './scenarios';

// Threshold exports
export {
  extractBehaviorSLA,
  extractThresholds,
  extractRateLimits,
  durationToMs,
  calculateSleepTime,
  formatK6Threshold,
  formatArtilleryThreshold,
} from './thresholds';

// Type exports
export type {
  Domain,
  Behavior,
  TemporalSpec,
  SecuritySpec,
  BehaviorSLA,
  SLAThreshold,
  RateLimit,
  InputFieldSpec,
} from './ast-types';

// ============================================================================
// Main API Function
// ============================================================================

import { generateLoadTests, type GeneratorOptions, type GeneratedFile } from './generator';
import type { Domain } from './ast-types';

/**
 * Generate load tests from an ISL Domain AST
 *
 * @param domain - The parsed Domain AST node
 * @param options - Generator options including framework, scenarios, and base URL
 * @returns Array of generated files with paths and contents
 *
 * @example
 * ```typescript
 * import { generate } from '@intentos/codegen-loadtest';
 *
 * // Generate k6 tests
 * const files = generate(domainAST, {
 *   framework: 'k6',
 *   scenarios: ['smoke', 'load', 'stress'],
 *   baseUrl: 'http://localhost:3000',
 * });
 *
 * // Generate Artillery tests
 * const artilleryFiles = generate(domainAST, {
 *   framework: 'artillery',
 *   scenarios: ['load'],
 *   baseUrl: 'https://api.example.com',
 * });
 *
 * // Generate Gatling tests
 * const gatlingFiles = generate(domainAST, {
 *   framework: 'gatling',
 *   scenarios: ['stress', 'spike'],
 * });
 * ```
 */
export function generate(
  domain: Domain,
  options: {
    framework: 'k6' | 'artillery' | 'gatling';
    scenarios?: ('smoke' | 'load' | 'stress' | 'spike' | 'soak')[];
    baseUrl?: string;
  }
): GeneratedFile[] {
  return generateLoadTests(domain, options);
}
