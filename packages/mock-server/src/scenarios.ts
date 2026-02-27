/**
 * Scenario Manager
 *
 * Manage scenario-based mock responses for different test cases.
 */

export interface ScenarioResponse {
  /** Response data */
  data?: unknown;
  /** Error to return */
  error?: string;
  /** HTTP status code */
  status?: number;
  /** Delay before responding */
  delay?: number;
}

export interface BehaviorScenario {
  /** Condition to match */
  when?: (input: unknown) => boolean;
  /** Response to return */
  response: ScenarioResponse | unknown;
  /** Number of times to return this response (-1 for infinite) */
  times?: number;
}

export interface Scenario {
  /** Unique scenario name */
  name: string;
  /** Description of the scenario */
  description?: string;
  /** Behavior-specific responses */
  behaviors: Record<string, BehaviorScenario | BehaviorScenario[]>;
  /** State modifications */
  state?: Record<string, unknown[]>;
  /** Setup function called when scenario is activated */
  setup?: () => void | Promise<void>;
  /** Teardown function called when scenario is deactivated */
  teardown?: () => void | Promise<void>;
}

export interface ScenarioOptions {
  /** Available scenarios */
  scenarios?: Scenario[];
}

export class ScenarioManager {
  private scenarios: Map<string, Scenario>;
  private activeScenario: string | null;
  private callCounts: Map<string, number>;

  constructor(options: ScenarioOptions = {}) {
    this.scenarios = new Map();
    this.activeScenario = null;
    this.callCounts = new Map();

    // Register initial scenarios
    for (const scenario of options.scenarios ?? []) {
      this.registerScenario(scenario);
    }

    // Register built-in scenarios
    this.registerBuiltInScenarios();
  }

  private registerBuiltInScenarios(): void {
    // Happy path scenario
    this.registerScenario({
      name: 'happy-path',
      description: 'All operations succeed',
      behaviors: {},
    });

    // Error scenario
    this.registerScenario({
      name: 'all-errors',
      description: 'All operations return errors',
      behaviors: {
        '*': {
          response: { error: 'INTERNAL_ERROR' },
        },
      },
    });

    // Slow response scenario
    this.registerScenario({
      name: 'slow-responses',
      description: 'All responses are delayed',
      behaviors: {
        '*': {
          response: { delay: 2000 },
        },
      },
    });

    // Intermittent failures scenario
    this.registerScenario({
      name: 'intermittent-failures',
      description: 'Random failures occur',
      behaviors: {
        '*': [
          {
            when: () => Math.random() < 0.3,
            response: { error: 'SERVICE_UNAVAILABLE' },
          },
        ],
      },
    });

    // Rate limited scenario
    this.registerScenario({
      name: 'rate-limited',
      description: 'All requests are rate limited',
      behaviors: {
        '*': {
          response: { error: 'RATE_LIMITED', status: 429 },
        },
      },
    });

    // Unauthorized scenario
    this.registerScenario({
      name: 'unauthorized',
      description: 'All requests return unauthorized',
      behaviors: {
        '*': {
          response: { error: 'UNAUTHORIZED', status: 401 },
        },
      },
    });
  }

  /**
   * Register a new scenario
   */
  registerScenario(scenario: Scenario): void {
    this.scenarios.set(scenario.name, scenario);
  }

  /**
   * Unregister a scenario
   */
  unregisterScenario(name: string): boolean {
    return this.scenarios.delete(name);
  }

  /**
   * Get a scenario by name
   */
  getScenario(name: string): Scenario | undefined {
    return this.scenarios.get(name);
  }

  /**
   * List all available scenarios
   */
  listScenarios(): Array<{ name: string; description?: string }> {
    return Array.from(this.scenarios.values()).map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  /**
   * Activate a scenario
   */
  async activateScenario(name: string): Promise<void> {
    const scenario = this.scenarios.get(name);
    if (!scenario) {
      throw new Error(`Scenario '${name}' not found`);
    }

    // Deactivate current scenario
    if (this.activeScenario) {
      await this.deactivateScenario();
    }

    // Run setup
    if (scenario.setup) {
      await scenario.setup();
    }

    this.activeScenario = name;
    this.callCounts.clear();
  }

  /**
   * Deactivate the current scenario
   */
  async deactivateScenario(): Promise<void> {
    if (!this.activeScenario) {
      return;
    }

    const scenario = this.scenarios.get(this.activeScenario);
    if (scenario?.teardown) {
      await scenario.teardown();
    }

    this.activeScenario = null;
    this.callCounts.clear();
  }

  /**
   * Get the active scenario name
   */
  getActiveScenario(): string | null {
    return this.activeScenario;
  }

  /**
   * Get response for a behavior based on active scenario
   */
  getResponse(behaviorName: string, input: unknown): unknown | undefined {
    if (!this.activeScenario) {
      return undefined;
    }

    const scenario = this.scenarios.get(this.activeScenario);
    if (!scenario) {
      return undefined;
    }

    // Check behavior-specific response
    let behaviorConfig = scenario.behaviors[behaviorName];

    // Check wildcard
    if (!behaviorConfig && scenario.behaviors['*']) {
      behaviorConfig = scenario.behaviors['*'];
    }

    if (!behaviorConfig) {
      return undefined;
    }

    // Handle array of scenarios
    const configs = Array.isArray(behaviorConfig) ? behaviorConfig : [behaviorConfig];

    for (const config of configs) {
      // Check condition
      if (config.when && !config.when(input)) {
        continue;
      }

      // Check times limit
      const callKey = `${this.activeScenario}:${behaviorName}`;
      const currentCount = this.callCounts.get(callKey) ?? 0;

      if (config.times !== undefined && config.times !== -1 && currentCount >= config.times) {
        continue;
      }

      // Increment call count
      this.callCounts.set(callKey, currentCount + 1);

      // Return response
      const response = config.response;

      // Handle ScenarioResponse object
      if (response && typeof response === 'object' && 'error' in response) {
        const scenarioResponse = response as ScenarioResponse;
        return {
          _scenario: {
            error: scenarioResponse.error,
            status: scenarioResponse.status,
            delay: scenarioResponse.delay,
          },
        };
      }

      // Handle delay-only response
      if (response && typeof response === 'object' && 'delay' in response && !('data' in response)) {
        const scenarioResponse = response as ScenarioResponse;
        return {
          _scenario: {
            delay: scenarioResponse.delay,
          },
        };
      }

      return response;
    }

    return undefined;
  }

  /**
   * Get state modifications for active scenario
   */
  getStateModifications(): Record<string, unknown[]> | undefined {
    if (!this.activeScenario) {
      return undefined;
    }

    const scenario = this.scenarios.get(this.activeScenario);
    return scenario?.state;
  }

  /**
   * Create a scenario programmatically
   */
  createScenario(
    name: string,
    options: {
      description?: string;
      behaviors?: Record<string, BehaviorScenario | BehaviorScenario[]>;
      state?: Record<string, unknown[]>;
    }
  ): Scenario {
    const scenario: Scenario = {
      name,
      description: options.description,
      behaviors: options.behaviors ?? {},
      state: options.state,
    };

    this.registerScenario(scenario);
    return scenario;
  }

  /**
   * Create a scenario that fails after N successful calls
   */
  createFailAfterScenario(
    name: string,
    behaviorName: string,
    successCount: number,
    error: string = 'INTERNAL_ERROR'
  ): Scenario {
    return this.createScenario(name, {
      description: `${behaviorName} fails after ${successCount} successful calls`,
      behaviors: {
        [behaviorName]: [
          {
            times: successCount,
            response: undefined, // Use default response
          },
          {
            response: { error },
          },
        ],
      },
    });
  }

  /**
   * Create a scenario that returns specific data
   */
  createDataScenario(
    name: string,
    behaviorName: string,
    data: unknown
  ): Scenario {
    return this.createScenario(name, {
      description: `${behaviorName} returns specific data`,
      behaviors: {
        [behaviorName]: {
          response: data,
        },
      },
    });
  }

  /**
   * Create a scenario that matches input conditions
   */
  createConditionalScenario(
    name: string,
    behaviorName: string,
    condition: (input: unknown) => boolean,
    response: unknown
  ): Scenario {
    return this.createScenario(name, {
      description: `${behaviorName} with conditional response`,
      behaviors: {
        [behaviorName]: {
          when: condition,
          response,
        },
      },
    });
  }

  /**
   * Compose multiple scenarios into one
   */
  composeScenarios(name: string, scenarioNames: string[]): Scenario {
    const behaviors: Record<string, BehaviorScenario[]> = {};

    for (const scenarioName of scenarioNames) {
      const scenario = this.scenarios.get(scenarioName);
      if (!scenario) continue;

      for (const [behavior, config] of Object.entries(scenario.behaviors)) {
        if (!behaviors[behavior]) {
          behaviors[behavior] = [];
        }
        const configs = Array.isArray(config) ? config : [config];
        behaviors[behavior].push(...configs);
      }
    }

    return this.createScenario(name, {
      description: `Composed from: ${scenarioNames.join(', ')}`,
      behaviors,
    });
  }

  /**
   * Reset all call counts
   */
  resetCallCounts(): void {
    this.callCounts.clear();
  }
}
