/**
 * ISL Domain Simulator
 * 
 * Simulate ISL domains for testing and exploration.
 * 
 * @example
 * ```typescript
 * import { Simulator } from '@intentos/simulator';
 * 
 * const sim = new Simulator({
 *   domain: authDomain,
 *   initialState: { users: [] },
 * });
 * 
 * // Execute behaviors
 * const result = await sim.execute('CreateUser', {
 *   email: 'test@example.com',
 * });
 * 
 * // Check state
 * console.log(sim.getEntities('User'));
 * 
 * // Check invariants
 * const check = sim.checkInvariants();
 * 
 * // Get timeline
 * const timeline = sim.getTimeline();
 * ```
 */

// Main simulator
export { Simulator } from './simulator.js';

// State management
export { StateManager, generateId } from './state.js';

// Behavior execution
export { BehaviorExecutor } from './executor.js';

// Timeline
export { TimelineManager, type TimelineStats } from './timeline.js';

// Scenarios
export {
  ScenarioPlayer,
  ScenarioRecorder,
  timelineToScenario,
  createAssertionsFromState,
  mergeScenarios,
  type ScenarioPlayerOptions,
  type RecorderOptions,
} from './scenarios/index.js';

// Types
export type {
  // Core
  SimulatorOptions,
  Domain,
  EntityDefinition,
  FieldDefinition,
  BehaviorDefinition,
  OutputDefinition,
  ErrorDefinition,
  PostconditionDefinition,
  InvariantDefinition,
  EnumDefinition,
  LifecycleTransition,
  
  // Execution
  BehaviorImplementation,
  ExecutionContext,
  BehaviorResult,
  
  // State
  SimulatorState,
  EntityStore,
  EntityInstance,
  
  // Timeline
  Timeline,
  TimelineEvent,
  
  // Invariants
  InvariantCheckResult,
  InvariantViolation,
  
  // Scenarios
  Scenario,
  ScenarioStep,
  ScenarioAssertion,
  ScenarioResult,
  ScenarioStepResult,
  ScenarioAssertionResult,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Quick Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

import { Simulator } from './simulator.js';
import type { Domain, SimulatorOptions, BehaviorResult } from './types.js';

/**
 * Create a simulator from a domain
 */
export function createSimulator(
  domain: Domain,
  options?: Partial<Omit<SimulatorOptions, 'domain'>>
): Simulator {
  return new Simulator({ domain, ...options });
}

/**
 * Quick simulation runner - executes steps and returns results
 */
export async function simulate(
  domain: Domain,
  steps: Array<{ behavior: string; input?: Record<string, unknown> }>,
  options?: Partial<Omit<SimulatorOptions, 'domain'>>
): Promise<{
  results: BehaviorResult[];
  finalState: ReturnType<Simulator['snapshot']>;
  invariantsValid: boolean;
}> {
  const sim = createSimulator(domain, options);
  const results = await sim.executeSequence(steps);
  const invariantCheck = sim.checkInvariants();
  
  return {
    results,
    finalState: sim.snapshot(),
    invariantsValid: invariantCheck.valid,
  };
}

/**
 * Create a domain definition helper
 */
export function defineDomain(
  name: string,
  definition: {
    version?: string;
    entities?: Domain['entities'];
    behaviors?: Domain['behaviors'];
    enums?: Domain['enums'];
    invariants?: Domain['invariants'];
  }
): Domain {
  return {
    name,
    version: definition.version,
    entities: definition.entities || [],
    behaviors: definition.behaviors || [],
    enums: definition.enums || [],
    invariants: definition.invariants || [],
  };
}
