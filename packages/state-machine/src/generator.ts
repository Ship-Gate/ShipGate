/**
 * State Machine Generator
 *
 * Generate state machine configurations from ISL lifecycle specifications.
 */

import { StateMachineConfig, StateConfig, TransitionConfig } from './machine.js';

export interface GeneratorOptions {
  /** Include guard functions */
  includeGuards?: boolean;
  /** Include action stubs */
  includeActions?: boolean;
  /** Output format */
  format?: 'config' | 'typescript' | 'json';
}

interface ParsedLifecycle {
  entityName: string;
  states: ParsedState[];
  transitions: ParsedTransition[];
}

interface ParsedState {
  name: string;
  initial?: boolean;
  final?: boolean;
  description?: string;
}

interface ParsedTransition {
  from: string;
  to: string;
  event: string;
  guard?: string;
  action?: string;
  description?: string;
}

export class StateMachineGenerator {
  private options: Required<GeneratorOptions>;

  constructor(options: GeneratorOptions = {}) {
    this.options = {
      includeGuards: options.includeGuards ?? true,
      includeActions: options.includeActions ?? true,
      format: options.format ?? 'config',
    };
  }

  /**
   * Generate state machine from ISL content
   */
  generate(islContent: string): StateMachineConfig | string {
    const lifecycles = this.parseLifecycles(islContent);

    if (lifecycles.length === 0) {
      throw new Error('No lifecycle definitions found in ISL content');
    }

    // Generate for the first lifecycle (or merge multiple)
    const lifecycle = lifecycles[0]!;
    const config = this.generateConfig(lifecycle);

    switch (this.options.format) {
      case 'typescript':
        return this.generateTypeScript(config, lifecycle);
      case 'json':
        return JSON.stringify(config, null, 2);
      default:
        return config;
    }
  }

  /**
   * Generate all state machines from ISL
   */
  generateAll(islContent: string): Map<string, StateMachineConfig> {
    const lifecycles = this.parseLifecycles(islContent);
    const machines = new Map<string, StateMachineConfig>();

    for (const lifecycle of lifecycles) {
      machines.set(lifecycle.entityName, this.generateConfig(lifecycle));
    }

    return machines;
  }

  /**
   * Generate state machine configuration
   */
  private generateConfig(lifecycle: ParsedLifecycle): StateMachineConfig {
    const states: StateConfig[] = lifecycle.states.map((s) => ({
      name: s.name,
      initial: s.initial,
      final: s.final,
      onEntry: this.options.includeActions ? [`on${s.name}Entry`] : undefined,
      onExit: this.options.includeActions ? [`on${s.name}Exit`] : undefined,
      meta: {
        description: s.description,
      },
    }));

    const transitions: TransitionConfig[] = lifecycle.transitions.map((t) => ({
      from: t.from,
      to: t.to,
      event: t.event,
      guards: this.options.includeGuards && t.guard ? [t.guard] : undefined,
      actions: this.options.includeActions && t.action ? [t.action] : undefined,
      description: t.description,
    }));

    const initialState = lifecycle.states.find((s) => s.initial)?.name ?? lifecycle.states[0]?.name ?? '';

    return {
      id: `${lifecycle.entityName}Machine`,
      initial: initialState,
      states,
      transitions,
      context: {},
    };
  }

  /**
   * Generate TypeScript code
   */
  private generateTypeScript(config: StateMachineConfig, lifecycle: ParsedLifecycle): string {
    const stateNames = lifecycle.states.map((s) => s.name);
    const eventNames = [...new Set(lifecycle.transitions.map((t) => t.event))];

    return `
import { StateMachine, createStateMachine, StateMachineConfig } from '@isl-lang/state-machine';

// State type
export type ${lifecycle.entityName}State = ${stateNames.map((s) => `'${s}'`).join(' | ')};

// Event type
export type ${lifecycle.entityName}Event = ${eventNames.map((e) => `'${e}'`).join(' | ')};

// Context type
export interface ${lifecycle.entityName}Context {
  id: string;
  updatedAt: string;
  // Add your custom context fields here
}

// Machine configuration
export const ${this.toCamelCase(lifecycle.entityName)}MachineConfig: StateMachineConfig = ${JSON.stringify(config, null, 2)};

// Create machine instance
export function create${lifecycle.entityName}Machine(
  initialContext?: Partial<${lifecycle.entityName}Context>
): StateMachine<${lifecycle.entityName}Context> {
  const machine = createStateMachine<${lifecycle.entityName}Context>(
    ${this.toCamelCase(lifecycle.entityName)}MachineConfig,
    {
      id: '',
      updatedAt: new Date().toISOString(),
      ...initialContext,
    }
  );

  // Register guards
${this.generateGuardRegistrations(lifecycle)}

  // Register actions
${this.generateActionRegistrations(lifecycle)}

  return machine;
}

// Type-safe send function
export function send${lifecycle.entityName}Event(
  machine: StateMachine<${lifecycle.entityName}Context>,
  event: ${lifecycle.entityName}Event,
  payload?: unknown
): boolean {
  return machine.send({ type: event, payload });
}

// Check if transition is possible
export function can${lifecycle.entityName}(
  machine: StateMachine<${lifecycle.entityName}Context>,
  event: ${lifecycle.entityName}Event
): boolean {
  return machine.can(event);
}
`;
  }

  /**
   * Generate guard registrations
   */
  private generateGuardRegistrations(lifecycle: ParsedLifecycle): string {
    const guards = lifecycle.transitions
      .filter((t) => t.guard)
      .map((t) => t.guard!)
      .filter((g, i, arr) => arr.indexOf(g) === i);

    if (guards.length === 0) return '  // No guards defined';

    return guards.map((guard) => `
  machine.registerGuard('${guard}', (context, event) => {
    // TODO: Implement guard logic for ${guard}
    return true;
  });`).join('\n');
  }

  /**
   * Generate action registrations
   */
  private generateActionRegistrations(lifecycle: ParsedLifecycle): string {
    const actions = new Set<string>();

    // Entry/exit actions
    for (const state of lifecycle.states) {
      actions.add(`on${state.name}Entry`);
      actions.add(`on${state.name}Exit`);
    }

    // Transition actions
    for (const transition of lifecycle.transitions) {
      if (transition.action) {
        actions.add(transition.action);
      }
    }

    return Array.from(actions).map((action) => `
  machine.registerAction('${action}', (context, event) => {
    // TODO: Implement action logic for ${action}
    return {
      ...context,
      updatedAt: new Date().toISOString(),
    };
  });`).join('\n');
  }

  /**
   * Parse lifecycle definitions from ISL
   */
  private parseLifecycles(content: string): ParsedLifecycle[] {
    const lifecycles: ParsedLifecycle[] = [];

    // Match lifecycle blocks
    const lifecycleRegex = /lifecycle\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g;
    let match;

    while ((match = lifecycleRegex.exec(content)) !== null) {
      const entityName = match[1]!;
      const body = match[2]!;

      const states = this.parseStates(body);
      const transitions = this.parseTransitions(body);

      lifecycles.push({ entityName, states, transitions });
    }

    // Also check for entity-level lifecycle
    const entityLifecycleRegex = /entity\s+(\w+)\s*\{[\s\S]*?lifecycle\s*\{([\s\S]*?)\n\s*\}/g;
    while ((match = entityLifecycleRegex.exec(content)) !== null) {
      const entityName = match[1]!;
      const body = match[2]!;

      const states = this.parseStates(body);
      const transitions = this.parseTransitions(body);

      lifecycles.push({ entityName, states, transitions });
    }

    return lifecycles;
  }

  /**
   * Parse states from lifecycle body
   */
  private parseStates(body: string): ParsedState[] {
    const states: ParsedState[] = [];

    // Match state definitions
    const stateRegex = /(\w+)(?:\s*\[([^\]]+)\])?/g;
    const statesMatch = body.match(/states?\s*:\s*\[([^\]]+)\]/);

    if (statesMatch) {
      let match;
      while ((match = stateRegex.exec(statesMatch[1]!)) !== null) {
        const name = match[1]!;
        const annotations = match[2] ?? '';

        states.push({
          name,
          initial: annotations.includes('initial'),
          final: annotations.includes('final'),
        });
      }
    }

    // Also match state: name -> name -> name syntax
    const flowMatch = body.match(/flow\s*:\s*(.+)/);
    if (flowMatch && flowMatch[1]) {
      const flow = flowMatch[1];
      const stateNames = flow.split('->').map((s) => s.trim());

      for (let i = 0; i < stateNames.length; i++) {
        const name = stateNames[i]!;
        if (!states.find((s) => s.name === name)) {
          states.push({
            name,
            initial: i === 0,
            final: i === stateNames.length - 1,
          });
        }
      }
    }

    return states;
  }

  /**
   * Parse transitions from lifecycle body
   */
  private parseTransitions(body: string): ParsedTransition[] {
    const transitions: ParsedTransition[] = [];

    // Match transition definitions: FROM --EVENT--> TO
    const transitionRegex = /(\w+)\s*--(\w+)-->\s*(\w+)(?:\s*\[([^\]]+)\])?/g;
    let match;

    while ((match = transitionRegex.exec(body)) !== null) {
      const annotations = match[4] ?? '';
      const guardMatch = annotations.match(/guard:\s*(\w+)/);
      const actionMatch = annotations.match(/action:\s*(\w+)/);

      transitions.push({
        from: match[1]!,
        to: match[3]!,
        event: match[2]!,
        guard: guardMatch?.[1],
        action: actionMatch?.[1],
      });
    }

    // Also match when: "event" transitions: from -> to
    const whenRegex = /when\s*:\s*"(\w+)"\s*transitions?\s*:\s*(\w+)\s*->\s*(\w+)/g;
    while ((match = whenRegex.exec(body)) !== null) {
      transitions.push({
        from: match[2]!,
        to: match[3]!,
        event: match[1]!,
      });
    }

    return transitions;
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

/**
 * Generate state machine from ISL
 */
export function generateStateMachine(
  islContent: string,
  options?: GeneratorOptions
): StateMachineConfig | string {
  const generator = new StateMachineGenerator(options);
  return generator.generate(islContent);
}
