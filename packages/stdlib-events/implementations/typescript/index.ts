// ============================================================================
// ISL Standard Library - Events Module
// @isl-lang/stdlib-events
// Event sourcing, CQRS, and event-driven architecture patterns
// ============================================================================

export * from './types.js';
export * from './events.js';
export * from './event-store.js';
export * from './projections.js';
export * from './commands.js';
export * from './process-manager.js';
export * from './outbox.js';

// Default export for convenience
import * as Events from './events.js';
import * as EventStore from './event-store.js';
import * as Projections from './projections.js';
import * as Commands from './commands.js';
import * as ProcessManager from './process-manager.js';
import * as Outbox from './outbox.js';

export const StdLibEvents = {
  Events,
  EventStore,
  Projections,
  Commands,
  ProcessManager,
  Outbox,
};

export default StdLibEvents;
