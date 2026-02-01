/**
 * ISL State Machine Syntax
 * 
 * Parse and generate ISL state machine specifications
 */

import type {
  StateMachine,
  StateMachineSpec,
  StateSpec,
  EventSpec,
  TransitionSpec,
} from './types';

/**
 * Parse ISL state machine specification
 */
export function parseStateMachineISL(isl: string): StateMachineSpec {
  const lines = isl.split('\n').map(l => l.trim());
  const spec: StateMachineSpec = {
    name: '',
    states: [],
    events: [],
    transitions: [],
    invariants: [],
  };

  let currentSection: 'states' | 'events' | 'transitions' | 'invariants' | null = null;

  for (const line of lines) {
    if (!line || line.startsWith('//')) continue;

    // Machine declaration
    if (line.startsWith('machine ')) {
      spec.name = line.replace('machine ', '').replace(' {', '').trim();
      continue;
    }

    // Domain declaration
    if (line.startsWith('domain ')) {
      spec.domain = line.replace('domain ', '').replace(';', '').trim();
      continue;
    }

    // Section headers
    if (line === 'states {') {
      currentSection = 'states';
      continue;
    }
    if (line === 'events {') {
      currentSection = 'events';
      continue;
    }
    if (line === 'transitions {') {
      currentSection = 'transitions';
      continue;
    }
    if (line === 'invariants {') {
      currentSection = 'invariants';
      continue;
    }
    if (line === '}') {
      currentSection = null;
      continue;
    }

    // Parse section content
    switch (currentSection) {
      case 'states':
        parseStateDeclaration(line, spec.states);
        break;
      case 'events':
        parseEventDeclaration(line, spec.events);
        break;
      case 'transitions':
        parseTransitionDeclaration(line, spec.transitions);
        break;
      case 'invariants':
        if (line.endsWith(';')) {
          spec.invariants?.push(line.replace(';', '').trim());
        }
        break;
    }
  }

  return spec;
}

/**
 * Parse a state declaration
 */
function parseStateDeclaration(line: string, states: StateSpec[]): void {
  // Format: initial State1; or State2; or final State3;
  let type: StateSpec['type'] = 'normal';
  let name = line.replace(';', '').trim();

  if (name.startsWith('initial ')) {
    type = 'initial';
    name = name.replace('initial ', '');
  } else if (name.startsWith('final ')) {
    type = 'final';
    name = name.replace('final ', '');
  }

  states.push({ name, type });
}

/**
 * Parse an event declaration
 */
function parseEventDeclaration(line: string, events: EventSpec[]): void {
  // Format: EventName; or EventName { payload }
  const match = line.match(/^(\w+)(?:\s*\{([^}]+)\})?;?$/);
  if (match) {
    const event: EventSpec = { name: match[1] };
    if (match[2]) {
      event.payload = parsePayload(match[2]);
    }
    events.push(event);
  }
}

/**
 * Parse event payload
 */
function parsePayload(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = payload.split(',').map(p => p.trim());
  
  for (const part of parts) {
    const [name, type] = part.split(':').map(p => p.trim());
    if (name && type) {
      result[name] = type;
    }
  }
  
  return result;
}

/**
 * Parse a transition declaration
 */
function parseTransitionDeclaration(line: string, transitions: TransitionSpec[]): void {
  // Format: State1 -> State2 on Event [guard] / action;
  const match = line.match(
    /^(\w+)\s*->\s*(\w+)\s+on\s+(\w+)(?:\s*\[([^\]]+)\])?(?:\s*\/\s*(.+))?;?$/
  );
  
  if (match) {
    const transition: TransitionSpec = {
      from: match[1],
      to: match[2],
      event: match[3],
    };
    
    if (match[4]) {
      transition.guard = match[4].trim();
    }
    
    if (match[5]) {
      transition.actions = match[5].split(',').map(a => a.trim());
    }
    
    transitions.push(transition);
  }
}

/**
 * Generate ISL from state machine
 */
export function generateStateMachineISL<TState extends string, TEvent extends string, TContext>(
  machine: StateMachine<TState, TEvent, TContext>
): string {
  const lines: string[] = [];
  
  lines.push(`machine ${machine.id} {`);
  
  if (machine.description) {
    lines.push(`  // ${machine.description}`);
  }
  
  // States section
  lines.push('');
  lines.push('  states {');
  
  for (const [stateName, state] of Object.entries(machine.states)) {
    let prefix = '';
    if (stateName === machine.initial) prefix = 'initial ';
    else if ((state as { type?: string }).type === 'final') prefix = 'final ';
    
    lines.push(`    ${prefix}${stateName};`);
  }
  
  lines.push('  }');
  
  // Events section
  const events = new Set<string>();
  for (const state of Object.values(machine.states) as { on?: Record<string, unknown> }[]) {
    if (state.on) {
      for (const event of Object.keys(state.on)) {
        events.add(event);
      }
    }
  }
  
  if (events.size > 0) {
    lines.push('');
    lines.push('  events {');
    for (const event of events) {
      lines.push(`    ${event};`);
    }
    lines.push('  }');
  }
  
  // Transitions section
  lines.push('');
  lines.push('  transitions {');
  
  for (const [stateName, state] of Object.entries(machine.states)) {
    const stateNode = state as { on?: Record<string, unknown> };
    if (stateNode.on) {
      for (const [event, transitions] of Object.entries(stateNode.on)) {
        const transArray = Array.isArray(transitions) ? transitions : [transitions];
        for (const transition of transArray as { target?: string; guard?: string | { type: string }; actions?: (string | { type: string })[] }[]) {
          if (transition.target) {
            let line = `    ${stateName} -> ${transition.target} on ${event}`;
            
            if (transition.guard) {
              const guardName = typeof transition.guard === 'string' 
                ? transition.guard 
                : transition.guard.type;
              line += ` [${guardName}]`;
            }
            
            if (transition.actions && transition.actions.length > 0) {
              const actionNames = transition.actions.map(a => 
                typeof a === 'string' ? a : a.type
              );
              line += ` / ${actionNames.join(', ')}`;
            }
            
            line += ';';
            lines.push(line);
          }
        }
      }
    }
  }
  
  lines.push('  }');
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Convert ISL spec to state machine
 */
export function specToMachine(spec: StateMachineSpec): StateMachine {
  const states: Record<string, { type?: string; on?: Record<string, { target: string; guard?: string; actions?: string[] }> }> = {};
  let initial = '';
  
  // Create states
  for (const stateSpec of spec.states) {
    states[stateSpec.name] = {
      type: stateSpec.type === 'final' ? 'final' : 'atomic',
      on: {},
    };
    
    if (stateSpec.type === 'initial') {
      initial = stateSpec.name;
    }
  }
  
  // Set initial if not explicitly marked
  if (!initial && spec.states.length > 0) {
    initial = spec.states[0].name;
  }
  
  // Add transitions
  for (const trans of spec.transitions) {
    if (!states[trans.from].on) {
      states[trans.from].on = {};
    }
    
    states[trans.from].on![trans.event] = {
      target: trans.to,
      guard: trans.guard,
      actions: trans.actions,
    };
  }
  
  return {
    id: spec.name,
    description: spec.description,
    initial,
    states: states as StateMachine['states'],
    guards: {},
    actions: {},
  };
}

/**
 * Example ISL state machine template
 */
export const orderStateMachineISL = `
machine OrderStateMachine {
  // Order processing state machine
  domain Orders;

  states {
    initial Pending;
    Confirmed;
    Processing;
    Shipped;
    Delivered;
    final Cancelled;
    final Completed;
  }

  events {
    Confirm;
    StartProcessing;
    Ship { trackingNumber: string };
    Deliver;
    Cancel { reason: string };
    Complete;
  }

  transitions {
    Pending -> Confirmed on Confirm / sendConfirmationEmail;
    Pending -> Cancelled on Cancel / refundPayment;
    Confirmed -> Processing on StartProcessing / allocateInventory;
    Confirmed -> Cancelled on Cancel [canCancel] / refundPayment;
    Processing -> Shipped on Ship / updateTracking, notifyCustomer;
    Shipped -> Delivered on Deliver;
    Delivered -> Completed on Complete / sendSurvey;
  }

  invariants {
    // Order amount must be positive
    order.amount > 0;
    // Cancelled orders cannot be modified
    state != Cancelled || !hasTransitions;
  }
}
`;
