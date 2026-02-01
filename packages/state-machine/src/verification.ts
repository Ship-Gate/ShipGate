/**
 * ISL State Machine Verification
 * 
 * Verifies state machines for correctness and completeness
 */

import type {
  StateMachine,
  StateNode,
  Transition,
  VerificationResult,
  MachineError,
  MachineWarning,
} from './types';

/**
 * Verify a state machine definition
 */
export function verifyMachine<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>
): VerificationResult {
  const errors: MachineError[] = [];
  const warnings: MachineWarning[] = [];
  const reachability = new Map<string, boolean>();
  const deadlocks: string[] = [];
  const unreachableStates: string[] = [];

  const states = Object.keys(machine.states) as TState[];

  // Check initial state exists
  if (!machine.states[machine.initial]) {
    errors.push({
      type: 'missing_state',
      message: `Initial state '${machine.initial}' does not exist`,
      state: machine.initial,
    });
  }

  // Mark initial state as reachable
  reachability.set(machine.initial, true);

  // Check each state
  for (const stateName of states) {
    const state = machine.states[stateName];
    
    // Check transitions
    if (state.on) {
      for (const [event, transitions] of Object.entries(state.on)) {
        const transArray = Array.isArray(transitions) ? transitions : [transitions];
        
        for (const transition of transArray as Transition<TState, TContext, string>[]) {
          // Check target state exists
          if (transition.target && !machine.states[transition.target]) {
            errors.push({
              type: 'missing_state',
              message: `Transition target '${transition.target}' does not exist`,
              state: stateName,
              transition: event,
            });
          } else if (transition.target) {
            reachability.set(transition.target, true);
          }

          // Check guard exists
          if (transition.guard) {
            const guardName = typeof transition.guard === 'string' 
              ? transition.guard 
              : transition.guard.type;
            if (!machine.guards?.[guardName]) {
              errors.push({
                type: 'missing_guard',
                message: `Guard '${guardName}' is not defined`,
                state: stateName,
                transition: event,
              });
            }
          }

          // Check actions exist
          if (transition.actions) {
            for (const actionRef of transition.actions) {
              const actionName = typeof actionRef === 'string' 
                ? actionRef 
                : actionRef.type;
              if (!machine.actions?.[actionName]) {
                errors.push({
                  type: 'missing_action',
                  message: `Action '${actionName}' is not defined`,
                  state: stateName,
                  transition: event,
                });
              }
            }
          }
        }
      }
    }

    // Check entry/exit actions
    if (state.entry) {
      for (const actionRef of state.entry) {
        const actionName = typeof actionRef === 'string' ? actionRef : actionRef.type;
        if (!machine.actions?.[actionName]) {
          errors.push({
            type: 'missing_action',
            message: `Entry action '${actionName}' is not defined`,
            state: stateName,
          });
        }
      }
    }

    if (state.exit) {
      for (const actionRef of state.exit) {
        const actionName = typeof actionRef === 'string' ? actionRef : actionRef.type;
        if (!machine.actions?.[actionName]) {
          errors.push({
            type: 'missing_action',
            message: `Exit action '${actionName}' is not defined`,
            state: stateName,
          });
        }
      }
    }

    // Check for deadlocks (non-final states with no outgoing transitions)
    if (state.type !== 'final' && !state.on && !state.always) {
      deadlocks.push(stateName);
      errors.push({
        type: 'deadlock',
        message: `State '${stateName}' has no outgoing transitions (deadlock)`,
        state: stateName,
      });
    }
  }

  // Check for unreachable states
  for (const stateName of states) {
    if (!reachability.get(stateName) && stateName !== machine.initial) {
      unreachableStates.push(stateName);
      warnings.push({
        type: 'unreachable_state',
        message: `State '${stateName}' is not reachable from initial state`,
        state: stateName,
      });
    }
  }

  // Check for states without final state path
  const hasFinalState = states.some(s => machine.states[s].type === 'final');
  if (!hasFinalState) {
    warnings.push({
      type: 'no_exit',
      message: 'State machine has no final states',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    reachability,
    deadlocks,
    unreachableStates,
  };
}

/**
 * Get all possible state paths
 */
export function getStatePaths<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>,
  maxDepth: number = 10
): string[][] {
  const paths: string[][] = [];
  const visited = new Set<string>();

  function traverse(state: TState, path: string[], depth: number): void {
    if (depth > maxDepth) return;
    
    const stateKey = `${state}-${path.join(',')}`;
    if (visited.has(stateKey)) return;
    visited.add(stateKey);

    const currentPath = [...path, state];
    const stateNode = machine.states[state];

    if (stateNode.type === 'final') {
      paths.push(currentPath);
      return;
    }

    if (stateNode.on) {
      for (const transitions of Object.values(stateNode.on)) {
        const transArray = Array.isArray(transitions) ? transitions : [transitions];
        for (const transition of transArray as Transition<TState, TContext, string>[]) {
          if (transition.target && transition.target !== state) {
            traverse(transition.target, currentPath, depth + 1);
          }
        }
      }
    }

    if (stateNode.always) {
      for (const transition of stateNode.always) {
        if (transition.target && transition.target !== state) {
          traverse(transition.target, currentPath, depth + 1);
        }
      }
    }
  }

  traverse(machine.initial, [], 0);
  return paths;
}

/**
 * Get all events that can occur in the machine
 */
export function getAllEvents<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>
): TEvent[] {
  const events = new Set<TEvent>();

  for (const state of Object.values(machine.states) as StateNode<TState, TEvent, TContext>[]) {
    if (state.on) {
      for (const event of Object.keys(state.on)) {
        events.add(event as TEvent);
      }
    }
  }

  return Array.from(events);
}

/**
 * Get all states in the machine
 */
export function getAllStates<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>
): TState[] {
  return Object.keys(machine.states) as TState[];
}

/**
 * Check if state machine is deterministic
 */
export function isDeterministic<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>
): boolean {
  for (const state of Object.values(machine.states) as StateNode<TState, TEvent, TContext>[]) {
    if (state.on) {
      for (const transitions of Object.values(state.on)) {
        if (Array.isArray(transitions)) {
          // Multiple transitions for same event - check if they have guards
          const unguarded = transitions.filter((t: Transition<TState, TContext, TEvent>) => !t.guard);
          if (unguarded.length > 1) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

/**
 * Generate a state diagram in Mermaid format
 */
export function toMermaid<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>
): string {
  const lines: string[] = ['stateDiagram-v2'];
  
  // Initial state
  lines.push(`    [*] --> ${machine.initial}`);

  // States and transitions
  for (const [stateName, state] of Object.entries(machine.states) as [TState, StateNode<TState, TEvent, TContext>][]) {
    // Final state
    if (state.type === 'final') {
      lines.push(`    ${stateName} --> [*]`);
      continue;
    }

    // Transitions
    if (state.on) {
      for (const [event, transitions] of Object.entries(state.on)) {
        const transArray = Array.isArray(transitions) ? transitions : [transitions];
        for (const transition of transArray as Transition<TState, TContext, string>[]) {
          if (transition.target) {
            const label = transition.guard 
              ? `${event} [${typeof transition.guard === 'string' ? transition.guard : transition.guard.type}]`
              : event;
            lines.push(`    ${stateName} --> ${transition.target}: ${label}`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}
