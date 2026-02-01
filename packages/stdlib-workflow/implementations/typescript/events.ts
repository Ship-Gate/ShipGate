/**
 * Workflow Event Bus
 * 
 * Event emission and subscription for workflow lifecycle events.
 */

import type {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowId,
  StepId,
} from './types.js';

// ============================================
// Event Types
// ============================================

export interface WorkflowCreatedEvent extends WorkflowEvent {
  type: 'workflow.created';
  data: {
    name: string;
    stepsCount: number;
  };
}

export interface WorkflowStartedEvent extends WorkflowEvent {
  type: 'workflow.started';
  data: {
    name: string;
    stepsCount: number;
  };
}

export interface WorkflowCompletedEvent extends WorkflowEvent {
  type: 'workflow.completed';
  data: {
    durationMs: number;
    stepsExecuted: number;
    stepsSkipped?: number;
  };
}

export interface WorkflowFailedEvent extends WorkflowEvent {
  type: 'workflow.failed';
  data: {
    stepId?: StepId;
    error: string;
  };
}

export interface StepCompletedEvent extends WorkflowEvent {
  type: 'step.completed';
  stepId: StepId;
  data: {
    durationMs: number;
  };
}

export interface StepFailedEvent extends WorkflowEvent {
  type: 'step.failed';
  stepId: StepId;
  data: {
    error: string;
    attempts: number;
  };
}

// ============================================
// Event Handler Type
// ============================================

export type WorkflowEventHandler = (event: WorkflowEvent) => void | Promise<void>;

// ============================================
// Event Bus
// ============================================

export class WorkflowEventBus {
  private handlers: Map<WorkflowEventType | '*', Set<WorkflowEventHandler>> = new Map();
  private history: WorkflowEvent[] = [];
  private historyLimit: number;

  constructor(options?: { historyLimit?: number }) {
    this.historyLimit = options?.historyLimit ?? 1000;
  }

  /**
   * Emit an event
   */
  emit(event: WorkflowEvent): void {
    // Store in history
    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    // Notify specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        this.safeCall(handler, event);
      }
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        this.safeCall(handler, event);
      }
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  on(type: WorkflowEventType | '*', handler: WorkflowEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => this.off(type, handler);
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: WorkflowEventHandler): () => void {
    return this.on('*', handler);
  }

  /**
   * Unsubscribe from events
   */
  off(type: WorkflowEventType | '*', handler: WorkflowEventHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Subscribe to events for a specific workflow
   */
  onWorkflow(
    workflowId: WorkflowId,
    handler: WorkflowEventHandler
  ): () => void {
    const wrappedHandler = (event: WorkflowEvent) => {
      if (event.workflowId === workflowId) {
        handler(event);
      }
    };
    return this.onAll(wrappedHandler);
  }

  /**
   * Wait for a specific event
   */
  waitFor(
    type: WorkflowEventType,
    predicate?: (event: WorkflowEvent) => boolean,
    timeoutMs?: number
  ): Promise<WorkflowEvent> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const handler = (event: WorkflowEvent) => {
        if (!predicate || predicate(event)) {
          if (timer) clearTimeout(timer);
          this.off(type, handler);
          resolve(event);
        }
      };

      this.on(type, handler);

      if (timeoutMs) {
        timer = setTimeout(() => {
          this.off(type, handler);
          reject(new Error(`Timeout waiting for event: ${type}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Wait for workflow completion (success or failure)
   */
  waitForCompletion(
    workflowId: WorkflowId,
    timeoutMs?: number
  ): Promise<WorkflowEvent> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const completionTypes: WorkflowEventType[] = [
        'workflow.completed',
        'workflow.failed',
        'workflow.cancelled',
        'workflow.compensation_completed',
      ];

      const handler = (event: WorkflowEvent) => {
        if (
          event.workflowId === workflowId &&
          completionTypes.includes(event.type)
        ) {
          if (timer) clearTimeout(timer);
          this.off('*', handler);
          resolve(event);
        }
      };

      this.onAll(handler);

      if (timeoutMs) {
        timer = setTimeout(() => {
          this.off('*', handler);
          reject(new Error(`Timeout waiting for workflow completion: ${workflowId}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Get event history
   */
  getHistory(filter?: {
    workflowId?: WorkflowId;
    type?: WorkflowEventType;
    since?: Date;
    limit?: number;
  }): WorkflowEvent[] {
    let events = this.history;

    if (filter?.workflowId) {
      events = events.filter((e) => e.workflowId === filter.workflowId);
    }

    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }

    if (filter?.since) {
      events = events.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Remove all handlers
   */
  removeAllListeners(): void {
    this.handlers.clear();
  }

  private safeCall(handler: WorkflowEventHandler, event: WorkflowEvent): void {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch((err) => {
          console.error('Event handler error:', err);
        });
      }
    } catch (err) {
      console.error('Event handler error:', err);
    }
  }
}

// ============================================
// Event Helpers
// ============================================

/**
 * Create a workflow event
 */
export function createEvent(
  type: WorkflowEventType,
  workflowId: WorkflowId,
  data?: Record<string, unknown>,
  stepId?: StepId
): WorkflowEvent {
  return {
    type,
    workflowId,
    stepId,
    timestamp: new Date(),
    data,
  };
}

/**
 * Create an event logger
 */
export function createEventLogger(
  logger: (message: string, data: unknown) => void
): WorkflowEventHandler {
  return (event) => {
    logger(`[${event.type}] Workflow: ${event.workflowId}`, {
      ...event.data,
      stepId: event.stepId,
      timestamp: event.timestamp.toISOString(),
    });
  };
}
