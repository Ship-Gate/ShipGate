/**
 * XState Generator
 *
 * Generate XState machine definitions from ISL specifications.
 */

export interface XStateOptions {
  /** Include type definitions */
  includeTypes?: boolean;
  /** Include services */
  includeServices?: boolean;
  /** Include actions */
  includeActions?: boolean;
  /** Include guards */
  includeGuards?: boolean;
  /** XState version */
  xstateVersion?: '4' | '5';
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
  onEntry?: string[];
  onExit?: string[];
}

interface ParsedTransition {
  from: string;
  to: string;
  event: string;
  guard?: string;
  actions?: string[];
}

export class XStateGenerator {
  private options: Required<XStateOptions>;

  constructor(options: XStateOptions = {}) {
    this.options = {
      includeTypes: options.includeTypes ?? true,
      includeServices: options.includeServices ?? true,
      includeActions: options.includeActions ?? true,
      includeGuards: options.includeGuards ?? true,
      xstateVersion: options.xstateVersion ?? '5',
    };
  }

  /**
   * Generate XState machine from ISL content
   */
  generate(islContent: string): string {
    const lifecycles = this.parseLifecycles(islContent);

    if (lifecycles.length === 0) {
      throw new Error('No lifecycle definitions found');
    }

    const parts: string[] = [];

    // Imports
    parts.push(this.generateImports());

    for (const lifecycle of lifecycles) {
      // Types
      if (this.options.includeTypes) {
        parts.push(this.generateTypes(lifecycle));
      }

      // Machine definition
      parts.push(this.generateMachine(lifecycle));

      // Actions
      if (this.options.includeActions) {
        parts.push(this.generateActions(lifecycle));
      }

      // Guards
      if (this.options.includeGuards) {
        parts.push(this.generateGuards(lifecycle));
      }

      // Actor (XState v5)
      if (this.options.xstateVersion === '5') {
        parts.push(this.generateActor(lifecycle));
      }
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate imports
   */
  private generateImports(): string {
    if (this.options.xstateVersion === '5') {
      return `
import { setup, createActor, assign, fromPromise } from 'xstate';
import type { ActorRefFrom, SnapshotFrom } from 'xstate';`;
    }

    return `
import { createMachine, assign, interpret } from 'xstate';
import type { InterpreterFrom, StateFrom } from 'xstate';`;
  }

  /**
   * Generate TypeScript types
   */
  private generateTypes(lifecycle: ParsedLifecycle): string {
    const stateNames = lifecycle.states.map((s) => `'${s.name}'`).join(' | ');
    const eventNames = [...new Set(lifecycle.transitions.map((t) => t.event))];
    const eventTypes = eventNames.map((e) => `{ type: '${e}' }`).join(' | ');

    return `
// Types for ${lifecycle.entityName}
export interface ${lifecycle.entityName}Context {
  id: string;
  data: Record<string, unknown>;
  error?: Error;
  retryCount: number;
}

export type ${lifecycle.entityName}State = ${stateNames};

export type ${lifecycle.entityName}Event = ${eventTypes};

export type ${lifecycle.entityName}MachineContext = ${lifecycle.entityName}Context;
export type ${lifecycle.entityName}MachineEvent = ${lifecycle.entityName}Event;`;
  }

  /**
   * Generate XState machine definition
   */
  private generateMachine(lifecycle: ParsedLifecycle): string {
    const initialState = lifecycle.states.find((s) => s.initial)?.name ?? lifecycle.states[0]?.name;

    if (this.options.xstateVersion === '5') {
      return this.generateV5Machine(lifecycle, initialState);
    }

    return this.generateV4Machine(lifecycle, initialState);
  }

  /**
   * Generate XState v5 machine
   */
  private generateV5Machine(lifecycle: ParsedLifecycle, initialState: string): string {
    const statesConfig: string[] = [];

    for (const state of lifecycle.states) {
      const transitions = lifecycle.transitions.filter((t) => t.from === state.name);
      const transitionConfig = transitions.map((t) => {
        const config: string[] = [`target: '${t.to}'`];
        if (t.guard) {
          config.push(`guard: '${t.guard}'`);
        }
        if (t.actions && t.actions.length > 0) {
          config.push(`actions: [${t.actions.map((a) => `'${a}'`).join(', ')}]`);
        }
        return `        ${t.event}: {\n          ${config.join(',\n          ')}\n        }`;
      }).join(',\n');

      let stateConfig = `      ${state.name}: {\n`;
      
      if (state.final) {
        stateConfig += `        type: 'final',\n`;
      }

      if (state.onEntry && state.onEntry.length > 0) {
        stateConfig += `        entry: [${state.onEntry.map((a) => `'${a}'`).join(', ')}],\n`;
      }

      if (state.onExit && state.onExit.length > 0) {
        stateConfig += `        exit: [${state.onExit.map((a) => `'${a}'`).join(', ')}],\n`;
      }

      if (transitionConfig) {
        stateConfig += `        on: {\n${transitionConfig}\n        }\n`;
      }

      stateConfig += `      }`;
      statesConfig.push(stateConfig);
    }

    return `
// XState v5 machine setup
export const ${this.toCamelCase(lifecycle.entityName)}Machine = setup({
  types: {
    context: {} as ${lifecycle.entityName}Context,
    events: {} as ${lifecycle.entityName}Event,
  },
  actions: ${this.toCamelCase(lifecycle.entityName)}Actions,
  guards: ${this.toCamelCase(lifecycle.entityName)}Guards,
}).createMachine({
  id: '${lifecycle.entityName}',
  initial: '${initialState}',
  context: {
    id: '',
    data: {},
    retryCount: 0,
  },
  states: {
${statesConfig.join(',\n')}
  },
});`;
  }

  /**
   * Generate XState v4 machine
   */
  private generateV4Machine(lifecycle: ParsedLifecycle, initialState: string): string {
    const statesConfig: string[] = [];

    for (const state of lifecycle.states) {
      const transitions = lifecycle.transitions.filter((t) => t.from === state.name);
      const transitionConfig = transitions.map((t) => {
        const config: string[] = [`target: '${t.to}'`];
        if (t.guard) {
          config.push(`cond: '${t.guard}'`);
        }
        if (t.actions && t.actions.length > 0) {
          config.push(`actions: [${t.actions.map((a) => `'${a}'`).join(', ')}]`);
        }
        return `        ${t.event}: { ${config.join(', ')} }`;
      }).join(',\n');

      let stateConfig = `    ${state.name}: {\n`;
      
      if (state.final) {
        stateConfig += `      type: 'final',\n`;
      }

      if (state.onEntry && state.onEntry.length > 0) {
        stateConfig += `      entry: [${state.onEntry.map((a) => `'${a}'`).join(', ')}],\n`;
      }

      if (transitionConfig) {
        stateConfig += `      on: {\n${transitionConfig}\n      }\n`;
      }

      stateConfig += `    }`;
      statesConfig.push(stateConfig);
    }

    return `
// XState v4 machine
export const ${this.toCamelCase(lifecycle.entityName)}Machine = createMachine<
  ${lifecycle.entityName}Context,
  ${lifecycle.entityName}Event
>(
  {
    id: '${lifecycle.entityName}',
    initial: '${initialState}',
    context: {
      id: '',
      data: {},
      retryCount: 0,
    },
    states: {
${statesConfig.join(',\n')}
    },
  },
  {
    actions: ${this.toCamelCase(lifecycle.entityName)}Actions,
    guards: ${this.toCamelCase(lifecycle.entityName)}Guards,
  }
);`;
  }

  /**
   * Generate actions
   */
  private generateActions(lifecycle: ParsedLifecycle): string {
    const actionNames = new Set<string>();

    for (const state of lifecycle.states) {
      state.onEntry?.forEach((a) => actionNames.add(a));
      state.onExit?.forEach((a) => actionNames.add(a));
    }

    for (const transition of lifecycle.transitions) {
      transition.actions?.forEach((a) => actionNames.add(a));
    }

    // Add common actions
    actionNames.add('logTransition');
    actionNames.add('updateTimestamp');
    actionNames.add('incrementRetry');
    actionNames.add('resetRetry');

    const actions = Array.from(actionNames).map((name) => `
  ${name}: assign({
    // TODO: Implement ${name}
  })`);

    return `
// Actions
const ${this.toCamelCase(lifecycle.entityName)}Actions = {
${actions.join(',\n')}
};`;
  }

  /**
   * Generate guards
   */
  private generateGuards(lifecycle: ParsedLifecycle): string {
    const guardNames = new Set<string>();

    for (const transition of lifecycle.transitions) {
      if (transition.guard) {
        guardNames.add(transition.guard);
      }
    }

    // Add common guards
    guardNames.add('canRetry');
    guardNames.add('isValid');

    const guards = Array.from(guardNames).map((name) => `
  ${name}: ({ context }) => {
    // TODO: Implement ${name}
    return true;
  }`);

    return `
// Guards
const ${this.toCamelCase(lifecycle.entityName)}Guards = {
${guards.join(',\n')}
};`;
  }

  /**
   * Generate XState v5 actor
   */
  private generateActor(lifecycle: ParsedLifecycle): string {
    return `
// Create actor
export function create${lifecycle.entityName}Actor(initialContext?: Partial<${lifecycle.entityName}Context>) {
  return createActor(${this.toCamelCase(lifecycle.entityName)}Machine, {
    input: initialContext,
  });
}

// Type helpers
export type ${lifecycle.entityName}Actor = ActorRefFrom<typeof ${this.toCamelCase(lifecycle.entityName)}Machine>;
export type ${lifecycle.entityName}Snapshot = SnapshotFrom<typeof ${this.toCamelCase(lifecycle.entityName)}Machine>;

// Usage example:
// const actor = create${lifecycle.entityName}Actor({ id: 'entity-1' });
// actor.start();
// actor.send({ type: 'EVENT_NAME' });`;
  }

  /**
   * Parse lifecycles from ISL
   */
  private parseLifecycles(content: string): ParsedLifecycle[] {
    const lifecycles: ParsedLifecycle[] = [];

    const lifecycleRegex = /lifecycle\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g;
    let match;

    while ((match = lifecycleRegex.exec(content)) !== null) {
      const entityName = match[1];
      const body = match[2];

      const states = this.parseStates(body);
      const transitions = this.parseTransitions(body);

      lifecycles.push({ entityName, states, transitions });
    }

    return lifecycles;
  }

  private parseStates(body: string): ParsedState[] {
    const states: ParsedState[] = [];
    const stateRegex = /(\w+)(?:\s*\[([^\]]+)\])?/g;
    const statesMatch = body.match(/states?\s*:\s*\[([^\]]+)\]/);

    if (statesMatch) {
      let match;
      while ((match = stateRegex.exec(statesMatch[1])) !== null) {
        const name = match[1];
        const annotations = match[2] ?? '';

        states.push({
          name,
          initial: annotations.includes('initial'),
          final: annotations.includes('final'),
          onEntry: [`on${name}Entry`],
          onExit: [`on${name}Exit`],
        });
      }
    }

    return states;
  }

  private parseTransitions(body: string): ParsedTransition[] {
    const transitions: ParsedTransition[] = [];
    const transitionRegex = /(\w+)\s*--(\w+)-->\s*(\w+)(?:\s*\[([^\]]+)\])?/g;
    let match;

    while ((match = transitionRegex.exec(body)) !== null) {
      const annotations = match[4] ?? '';
      const guardMatch = annotations.match(/guard:\s*(\w+)/);
      const actionMatch = annotations.match(/action:\s*(\w+)/);

      transitions.push({
        from: match[1],
        to: match[3],
        event: match[2],
        guard: guardMatch?.[1],
        actions: actionMatch ? [actionMatch[1]] : undefined,
      });
    }

    return transitions;
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

/**
 * Generate XState machine from ISL
 */
export function generateXState(
  islContent: string,
  options?: XStateOptions
): string {
  const generator = new XStateGenerator(options);
  return generator.generate(islContent);
}
