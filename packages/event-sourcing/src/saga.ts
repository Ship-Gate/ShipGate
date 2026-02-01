/**
 * Sagas
 * Long-running processes that coordinate multiple aggregates
 */

import { DomainEvent, Command, EventHandler } from './types';
import { EventStore } from './event-store';

/**
 * Saga state
 */
export interface SagaState {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  currentStep: number;
  data: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * Saga step
 */
export interface SagaStep {
  name: string;
  execute: (context: SagaContext) => Promise<void>;
  compensate?: (context: SagaContext) => Promise<void>;
}

/**
 * Saga context
 */
export interface SagaContext {
  sagaId: string;
  data: Record<string, unknown>;
  dispatch: (command: Command) => Promise<void>;
  emit: (eventType: string, data: unknown) => Promise<void>;
  complete: () => void;
  fail: (error: Error) => void;
}

/**
 * Base saga class
 */
export abstract class Saga {
  protected state: SagaState;
  protected steps: SagaStep[] = [];
  private commandDispatcher?: (command: Command) => Promise<void>;
  private eventEmitter?: (type: string, data: unknown) => Promise<void>;

  constructor(
    public readonly id: string,
    public readonly type: string
  ) {
    this.state = {
      id,
      type,
      status: 'running',
      currentStep: 0,
      data: {},
      startedAt: Date.now(),
    };
    this.defineSteps();
  }

  /**
   * Set command dispatcher
   */
  setDispatcher(dispatcher: (command: Command) => Promise<void>): void {
    this.commandDispatcher = dispatcher;
  }

  /**
   * Set event emitter
   */
  setEmitter(emitter: (type: string, data: unknown) => Promise<void>): void {
    this.eventEmitter = emitter;
  }

  /**
   * Start the saga
   */
  async start(initialData: Record<string, unknown> = {}): Promise<void> {
    this.state.data = initialData;
    await this.executeNextStep();
  }

  /**
   * Handle an event
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    // Check if this event advances the saga
    if (this.shouldAdvance(event)) {
      this.state.data = { ...this.state.data, ...this.extractData(event) };
      await this.executeNextStep();
    }
  }

  /**
   * Get current state
   */
  getState(): Readonly<SagaState> {
    return this.state;
  }

  /**
   * Execute the next step
   */
  private async executeNextStep(): Promise<void> {
    if (this.state.currentStep >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[this.state.currentStep]!;
    const context = this.createContext();

    try {
      await step.execute(context);
      this.state.currentStep++;
    } catch (error) {
      this.state.status = 'failed';
      this.state.error = (error as Error).message;
      await this.compensate();
    }
  }

  /**
   * Compensate failed steps
   */
  private async compensate(): Promise<void> {
    this.state.status = 'compensating';

    for (let i = this.state.currentStep - 1; i >= 0; i--) {
      const step = this.steps[i]!;
      if (step.compensate) {
        try {
          await step.compensate(this.createContext());
        } catch (error) {
          // Log but continue compensation
          console.error(`Compensation failed for step ${step.name}:`, error);
        }
      }
    }

    this.state.status = 'failed';
    this.state.completedAt = Date.now();
  }

  /**
   * Complete the saga
   */
  private complete(): void {
    this.state.status = 'completed';
    this.state.completedAt = Date.now();
  }

  /**
   * Create saga context
   */
  private createContext(): SagaContext {
    return {
      sagaId: this.id,
      data: this.state.data,
      dispatch: async (command) => {
        if (this.commandDispatcher) {
          await this.commandDispatcher(command);
        }
      },
      emit: async (type, data) => {
        if (this.eventEmitter) {
          await this.eventEmitter(type, data);
        }
      },
      complete: () => this.complete(),
      fail: (error) => {
        this.state.status = 'failed';
        this.state.error = error.message;
      },
    };
  }

  /**
   * Define saga steps - must be implemented
   */
  protected abstract defineSteps(): void;

  /**
   * Check if event should advance saga
   */
  protected abstract shouldAdvance(event: DomainEvent): boolean;

  /**
   * Extract data from event
   */
  protected abstract extractData(event: DomainEvent): Record<string, unknown>;
}

/**
 * Saga builder for fluent API
 */
export class SagaBuilder {
  private steps: SagaStep[] = [];
  private eventHandlers: Map<string, (event: DomainEvent) => boolean> = new Map();

  /**
   * Add a step
   */
  step(
    name: string,
    execute: (context: SagaContext) => Promise<void>,
    compensate?: (context: SagaContext) => Promise<void>
  ): this {
    this.steps.push({ name, execute, compensate });
    return this;
  }

  /**
   * Add event handler for advancing
   */
  onEvent(eventType: string, condition?: (event: DomainEvent) => boolean): this {
    this.eventHandlers.set(eventType, condition ?? (() => true));
    return this;
  }

  /**
   * Build the saga
   */
  build(id: string, type: string): Saga {
    const steps = this.steps;
    const handlers = this.eventHandlers;

    return new (class extends Saga {
      protected defineSteps(): void {
        this.steps = steps;
      }

      protected shouldAdvance(event: DomainEvent): boolean {
        const handler = handlers.get(event.type);
        return handler ? handler(event) : false;
      }

      protected extractData(event: DomainEvent): Record<string, unknown> {
        return event.data as Record<string, unknown>;
      }
    })(id, type);
  }
}

/**
 * Create saga builder
 */
export function saga(): SagaBuilder {
  return new SagaBuilder();
}

/**
 * Saga orchestrator
 */
export class SagaOrchestrator {
  private sagas: Map<string, Saga> = new Map();
  private eventStore: EventStore;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  /**
   * Start a new saga
   */
  async startSaga(saga: Saga, initialData?: Record<string, unknown>): Promise<void> {
    this.sagas.set(saga.id, saga);

    // Subscribe to events
    this.eventStore.subscribe(
      `saga_${saga.id}`,
      async (event) => {
        await saga.handleEvent(event);

        // Clean up completed/failed sagas
        const state = saga.getState();
        if (state.status === 'completed' || state.status === 'failed') {
          this.sagas.delete(saga.id);
          this.eventStore.unsubscribe(`saga_${saga.id}`);
        }
      }
    );

    await saga.start(initialData);
  }

  /**
   * Get saga status
   */
  getSagaStatus(id: string): SagaState | undefined {
    return this.sagas.get(id)?.getState();
  }

  /**
   * Get all active sagas
   */
  getActiveSagas(): SagaState[] {
    return Array.from(this.sagas.values()).map((s) => s.getState());
  }
}

/**
 * Create saga orchestrator
 */
export function createSagaOrchestrator(eventStore: EventStore): SagaOrchestrator {
  return new SagaOrchestrator(eventStore);
}
