// ============================================================================
// Saga / Process Manager
// ============================================================================

import {
  ProcessStatus,
} from './types.js';
import type {
  CorrelationId,
  EventId,
} from './types.js';
import type { DomainEvent } from './events.js';
import type { Command } from './commands.js';

/**
 * Process manager state
 */
export interface ProcessManagerState<TState = Record<string, unknown>> {
  id: string;
  name: string;
  status: ProcessStatus;
  currentStep?: string;
  correlationId: CorrelationId;
  state: TState;
  handledEvents: EventId[];
  dispatchedCommands: string[];
  timeoutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Process step definition
 */
export interface ProcessStep<TState> {
  name: string;
  condition?: (state: TState) => boolean;
  handle: (state: TState) => Command[] | Promise<Command[]>;
  compensate?: (state: TState) => Command[] | Promise<Command[]>;
}

/**
 * Process manager event handler
 */
export type ProcessEventHandler<TState, TData = Record<string, unknown>> = (
  state: ProcessManagerState<TState>,
  event: DomainEvent<TData>
) => ProcessManagerState<TState>;

/**
 * Process manager interface
 */
export interface IProcessManager<TState> {
  readonly id: string;
  readonly name: string;
  readonly status: ProcessStatus;
  readonly state: TState;

  start(correlationId: CorrelationId, initialState?: Partial<TState>): void;
  handleEvent(event: DomainEvent): Command[];
  complete(): void;
  fail(reason: string): void;
  compensate(): Command[];
}

/**
 * In-memory process manager implementation
 */
export class InMemoryProcessManager<TState extends Record<string, unknown>>
  implements IProcessManager<TState>
{
  private _state: ProcessManagerState<TState>;
  private eventHandlers = new Map<string, ProcessEventHandler<TState>>();
  private steps: ProcessStep<TState>[] = [];
  private compensatingSteps: ProcessStep<TState>[] = [];

  constructor(
    public readonly name: string,
    initialState: TState
  ) {
    this._state = {
      id: globalThis.crypto.randomUUID(),
      name,
      status: ProcessStatus.STARTED,
      correlationId: '',
      state: { ...initialState },
      handledEvents: [],
      dispatchedCommands: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  get id(): string {
    return this._state.id;
  }

  get status(): ProcessStatus {
    return this._state.status;
  }

  get state(): TState {
    return this._state.state;
  }

  /**
   * Register an event handler
   */
  on<TData = Record<string, unknown>>(
    eventType: string,
    handler: ProcessEventHandler<TState, TData>
  ): this {
    this.eventHandlers.set(eventType, handler as ProcessEventHandler<TState>);
    return this;
  }

  /**
   * Add a process step
   */
  addStep(step: ProcessStep<TState>): this {
    this.steps.push(step);
    if (step.compensate) {
      this.compensatingSteps.unshift(step);
    }
    return this;
  }

  start(correlationId: CorrelationId, initialState?: Partial<TState>): void {
    this._state = {
      ...this._state,
      correlationId,
      status: ProcessStatus.IN_PROGRESS,
      state: { ...this._state.state, ...initialState },
      updatedAt: new Date(),
    };

    const firstStep = this.steps[0];
    if (firstStep) {
      this._state.currentStep = firstStep.name;
    }
  }

  handleEvent(event: DomainEvent): Command[] {
    if (
      this._state.status !== ProcessStatus.IN_PROGRESS &&
      this._state.status !== ProcessStatus.STARTED
    ) {
      return [];
    }

    // Check if we've already handled this event
    if (this._state.handledEvents.includes(event.id)) {
      return [];
    }

    const handler = this.eventHandlers.get(event.eventType);
    if (handler) {
      this._state = handler(this._state, event);
      this._state.handledEvents.push(event.id);
      this._state.updatedAt = new Date();
    }

    // Find and execute the current step
    const currentStep = this.steps.find((s) => s.name === this._state.currentStep);
    if (currentStep && (!currentStep.condition || currentStep.condition(this._state.state))) {
      // This would normally be async, but for simplicity we'll handle it synchronously
      const commands = currentStep.handle(this._state.state);
      if (commands instanceof Promise) {
        // In real implementation, this would be handled properly
        return [];
      }

      // Move to next step
      const currentIndex = this.steps.findIndex((s) => s.name === this._state.currentStep);
      const nextStep = this.steps[currentIndex + 1];
      if (nextStep) {
        this._state.currentStep = nextStep.name;
      } else {
        this._state.currentStep = undefined;
      }

      this._state.dispatchedCommands.push(...commands.map((c) => c.id));
      return commands;
    }

    return [];
  }

  complete(): void {
    this._state.status = ProcessStatus.COMPLETED;
    this._state.currentStep = undefined;
    this._state.updatedAt = new Date();
  }

  fail(reason: string): void {
    this._state.status = ProcessStatus.FAILED;
    this._state.state = {
      ...this._state.state,
      failureReason: reason,
    } as TState;
    this._state.updatedAt = new Date();
  }

  compensate(): Command[] {
    this._state.status = ProcessStatus.COMPENSATING;
    this._state.updatedAt = new Date();

    const commands: Command[] = [];

    for (const step of this.compensatingSteps) {
      if (step.compensate) {
        const stepCommands = step.compensate(this._state.state);
        if (!(stepCommands instanceof Promise)) {
          commands.push(...stepCommands);
        }
      }
    }

    this._state.status = ProcessStatus.COMPENSATED;
    return commands;
  }

  /**
   * Check if process has timed out
   */
  checkTimeout(): boolean {
    if (!this._state.timeoutAt) {
      return false;
    }

    if (new Date() > this._state.timeoutAt) {
      this._state.status = ProcessStatus.TIMED_OUT;
      return true;
    }

    return false;
  }

  /**
   * Set timeout for the process
   */
  setTimeout(timeoutMs: number): void {
    this._state.timeoutAt = new Date(Date.now() + timeoutMs);
  }
}

/**
 * Create a process manager builder
 */
export function createProcessManager<TState extends Record<string, unknown>>(
  name: string,
  initialState: TState
): InMemoryProcessManager<TState> {
  return new InMemoryProcessManager(name, initialState);
}
