/**
 * State Machine Validator
 *
 * Validate state machine configurations for correctness and completeness.
 */

import { StateMachineConfig, StateConfig, TransitionConfig } from './machine.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  location?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: string;
}

export class StateValidator {
  /**
   * Validate a state machine configuration
   */
  validate(config: StateMachineConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check basic structure
    if (!config.id) {
      errors.push({
        code: 'MISSING_ID',
        message: 'State machine must have an ID',
      });
    }

    if (!config.initial) {
      errors.push({
        code: 'MISSING_INITIAL',
        message: 'State machine must have an initial state',
      });
    }

    if (!config.states || config.states.length === 0) {
      errors.push({
        code: 'NO_STATES',
        message: 'State machine must have at least one state',
      });
      return { valid: false, errors, warnings };
    }

    // Validate initial state exists
    if (config.initial && !config.states.find((s) => s.name === config.initial)) {
      errors.push({
        code: 'INVALID_INITIAL',
        message: `Initial state '${config.initial}' does not exist`,
      });
    }

    // Validate each state
    for (const state of config.states) {
      this.validateState(state, errors, warnings);
    }

    // Validate transitions
    const stateNames = new Set(config.states.map((s) => s.name));
    for (const transition of config.transitions) {
      this.validateTransition(transition, stateNames, errors, warnings);
    }

    // Check for unreachable states
    const reachableStates = this.findReachableStates(config);
    for (const state of config.states) {
      if (!reachableStates.has(state.name) && state.name !== config.initial) {
        warnings.push({
          code: 'UNREACHABLE_STATE',
          message: `State '${state.name}' is not reachable from initial state`,
          location: state.name,
        });
      }
    }

    // Check for dead-end states (non-final states with no outgoing transitions)
    for (const state of config.states) {
      if (!state.final) {
        const hasOutgoing = config.transitions.some((t) => t.from === state.name);
        if (!hasOutgoing) {
          warnings.push({
            code: 'DEAD_END_STATE',
            message: `Non-final state '${state.name}' has no outgoing transitions`,
            location: state.name,
          });
        }
      }
    }

    // Check for duplicate transitions
    const transitionKeys = new Set<string>();
    for (const transition of config.transitions) {
      const key = `${transition.from}-${transition.event}`;
      if (transitionKeys.has(key)) {
        warnings.push({
          code: 'DUPLICATE_TRANSITION',
          message: `Duplicate transition: ${transition.from} --${transition.event}-->`,
          location: key,
        });
      }
      transitionKeys.add(key);
    }

    // Check for final states
    const hasFinalState = config.states.some((s) => s.final);
    if (!hasFinalState) {
      warnings.push({
        code: 'NO_FINAL_STATE',
        message: 'State machine has no final states',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single state
   */
  private validateState(
    state: StateConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!state.name) {
      errors.push({
        code: 'MISSING_STATE_NAME',
        message: 'State must have a name',
      });
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(state.name)) {
      errors.push({
        code: 'INVALID_STATE_NAME',
        message: `Invalid state name: '${state.name}'`,
        location: state.name,
      });
    }
  }

  /**
   * Validate a single transition
   */
  private validateTransition(
    transition: TransitionConfig,
    stateNames: Set<string>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!transition.event) {
      errors.push({
        code: 'MISSING_EVENT',
        message: 'Transition must have an event',
      });
    }

    if (transition.from !== '*' && !stateNames.has(transition.from)) {
      errors.push({
        code: 'INVALID_SOURCE',
        message: `Transition source state '${transition.from}' does not exist`,
        location: `${transition.from} --${transition.event}-->`,
      });
    }

    if (!stateNames.has(transition.to)) {
      errors.push({
        code: 'INVALID_TARGET',
        message: `Transition target state '${transition.to}' does not exist`,
        location: `--${transition.event}--> ${transition.to}`,
      });
    }
  }

  /**
   * Find all reachable states from initial state
   */
  private findReachableStates(config: StateMachineConfig): Set<string> {
    const reachable = new Set<string>();
    const queue = [config.initial];

    while (queue.length > 0) {
      const state = queue.shift()!;
      if (reachable.has(state)) continue;
      reachable.add(state);

      // Find all transitions from this state
      const transitions = config.transitions.filter(
        (t) => t.from === state || t.from === '*'
      );

      for (const transition of transitions) {
        if (!reachable.has(transition.to)) {
          queue.push(transition.to);
        }
      }
    }

    return reachable;
  }

  /**
   * Check if state machine is deterministic
   */
  isDeterministic(config: StateMachineConfig): boolean {
    // Group transitions by (from, event)
    const transitionMap = new Map<string, TransitionConfig[]>();

    for (const transition of config.transitions) {
      const key = `${transition.from}-${transition.event}`;
      const existing = transitionMap.get(key) ?? [];
      existing.push(transition);
      transitionMap.set(key, existing);
    }

    // Check for non-determinism (multiple transitions for same from+event)
    for (const transitions of transitionMap.values()) {
      if (transitions.length > 1) {
        // If no guards, it's non-deterministic
        const hasGuards = transitions.every((t) => t.guards && t.guards.length > 0);
        if (!hasGuards) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get statistics about the state machine
   */
  getStatistics(config: StateMachineConfig): StateMachineStats {
    const reachable = this.findReachableStates(config);
    const finalStates = config.states.filter((s) => s.final);
    const events = new Set(config.transitions.map((t) => t.event));

    return {
      totalStates: config.states.length,
      reachableStates: reachable.size,
      unreachableStates: config.states.length - reachable.size,
      finalStates: finalStates.length,
      transitions: config.transitions.length,
      uniqueEvents: events.size,
      isDeterministic: this.isDeterministic(config),
      averageTransitionsPerState:
        config.transitions.length / config.states.length,
    };
  }
}

interface StateMachineStats {
  totalStates: number;
  reachableStates: number;
  unreachableStates: number;
  finalStates: number;
  transitions: number;
  uniqueEvents: number;
  isDeterministic: boolean;
  averageTransitionsPerState: number;
}

/**
 * Validate state machine configuration
 */
export function validateStateMachine(config: StateMachineConfig): ValidationResult {
  const validator = new StateValidator();
  return validator.validate(config);
}
