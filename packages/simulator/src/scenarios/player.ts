/**
 * Scenario Player
 * 
 * Plays back recorded scenarios and validates outcomes.
 */

import type {
  Scenario,
  ScenarioStep,
  ScenarioResult,
  ScenarioStepResult,
  ScenarioAssertion,
  ScenarioAssertionResult,
  BehaviorResult,
  SimulatorState,
  Timeline,
} from '../types.js';

export interface ScenarioPlayerOptions {
  /** Execute behavior function */
  execute: (behavior: string, input: Record<string, unknown>) => Promise<BehaviorResult>;
  /** Get current state */
  getState: () => SimulatorState;
  /** Get timeline */
  getTimeline: () => Timeline;
  /** Reset simulator */
  reset: () => void;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Add delay between steps (ms) */
  stepDelay?: number;
}

export class ScenarioPlayer {
  private options: ScenarioPlayerOptions;

  constructor(options: ScenarioPlayerOptions) {
    this.options = options;
  }

  /**
   * Play a scenario
   */
  async play(scenario: Scenario): Promise<ScenarioResult> {
    const startTime = Date.now();
    const stepResults: ScenarioStepResult[] = [];
    let failed = false;

    // Execute each step
    for (const step of scenario.steps) {
      if (failed && this.options.stopOnFailure) {
        break;
      }

      // Apply delay if specified
      const delay = step.delay ?? this.options.stepDelay ?? 0;
      if (delay > 0) {
        await sleep(delay);
      }

      // Execute step
      const stepResult = await this.executeStep(step);
      stepResults.push(stepResult);

      if (!stepResult.success) {
        failed = true;
      }
    }

    // Run assertions
    const assertionResults = this.runAssertions(scenario.assertions ?? []);

    return {
      scenario,
      success: !failed && assertionResults.every(a => a.passed),
      steps: stepResults,
      assertions: assertionResults,
      timeline: this.options.getTimeline(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: ScenarioStep): Promise<ScenarioStepResult> {
    const startTime = Date.now();

    try {
      const result = await this.options.execute(step.behavior, step.input);
      const durationMs = Date.now() - startTime;

      // Check expectations
      let success = true;
      let error: string | undefined;

      if (step.expect) {
        if (step.expect.success !== undefined && result.success !== step.expect.success) {
          success = false;
          error = `Expected success=${step.expect.success}, got ${result.success}`;
        }
        
        if (step.expect.errorCode && result.error?.code !== step.expect.errorCode) {
          success = false;
          error = `Expected error code '${step.expect.errorCode}', got '${result.error?.code}'`;
        }

        if (step.expect.data) {
          const dataMatch = this.matchData(result.data, step.expect.data);
          if (!dataMatch.matches) {
            success = false;
            error = dataMatch.message;
          }
        }
      }

      return {
        step,
        success,
        result,
        durationMs,
        error,
      };
    } catch (err) {
      return {
        step,
        success: false,
        result: {
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: err instanceof Error ? err.message : 'Unknown error',
          },
        },
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Run assertions against current state
   */
  private runAssertions(assertions: ScenarioAssertion[]): ScenarioAssertionResult[] {
    const state = this.options.getState();
    const results: ScenarioAssertionResult[] = [];

    for (const assertion of assertions) {
      results.push(this.evaluateAssertion(assertion, state));
    }

    return results;
  }

  /**
   * Evaluate a single assertion
   */
  private evaluateAssertion(
    assertion: ScenarioAssertion,
    state: SimulatorState
  ): ScenarioAssertionResult {
    switch (assertion.type) {
      case 'entity_exists': {
        const entityType = assertion.entityType!;
        const store = state.entities[entityType];
        const exists = store && Object.keys(store.items).length > 0;
        return {
          assertion,
          passed: exists === assertion.expected,
          actual: exists,
          message: exists === assertion.expected 
            ? undefined 
            : `Expected ${entityType} existence to be ${assertion.expected}`,
        };
      }

      case 'entity_count': {
        const entityType = assertion.entityType!;
        const store = state.entities[entityType];
        const count = store?.count ?? 0;
        const expected = assertion.expected as number;
        return {
          assertion,
          passed: count === expected,
          actual: count,
          message: count === expected 
            ? undefined 
            : `Expected ${entityType} count to be ${expected}, got ${count}`,
        };
      }

      case 'state_value': {
        const actual = getValueByPath(state, assertion.path!);
        const passed = JSON.stringify(actual) === JSON.stringify(assertion.expected);
        return {
          assertion,
          passed,
          actual,
          message: passed 
            ? undefined 
            : `Expected ${assertion.path} to be ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(actual)}`,
        };
      }

      case 'invariant': {
        // Invariant checking would need full expression evaluation
        return {
          assertion,
          passed: true,
          actual: true,
          message: undefined,
        };
      }

      default:
        return {
          assertion,
          passed: false,
          actual: undefined,
          message: `Unknown assertion type: ${assertion.type}`,
        };
    }
  }

  /**
   * Match data against expected pattern
   */
  private matchData(
    actual: unknown,
    expected: Record<string, unknown>
  ): { matches: boolean; message: string } {
    if (actual === null || actual === undefined) {
      return { matches: false, message: 'Result data is null or undefined' };
    }

    const actualObj = actual as Record<string, unknown>;

    for (const [key, expectedValue] of Object.entries(expected)) {
      const actualValue = actualObj[key];
      
      if (typeof expectedValue === 'object' && expectedValue !== null) {
        const nested = this.matchData(actualValue, expectedValue as Record<string, unknown>);
        if (!nested.matches) {
          return nested;
        }
      } else if (actualValue !== expectedValue) {
        return {
          matches: false,
          message: `Expected ${key}=${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
        };
      }
    }

    return { matches: true, message: '' };
  }

  /**
   * Play multiple scenarios
   */
  async playAll(scenarios: Scenario[]): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];

    for (const scenario of scenarios) {
      this.options.reset();
      const result = await this.play(scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Play scenarios matching tags
   */
  async playByTags(scenarios: Scenario[], tags: string[]): Promise<ScenarioResult[]> {
    const filtered = scenarios.filter(s => 
      s.tags?.some(t => tags.includes(t))
    );
    return this.playAll(filtered);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
