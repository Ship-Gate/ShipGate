// ============================================================================
// CQRS Commands
// ============================================================================

import type {
  CorrelationId,
  EventVersion,
  ActorType,
} from './types.js';
import type { DomainEvent } from './events.js';

/**
 * Base command interface
 */
export interface Command<TPayload = Record<string, unknown>> {
  /** Unique command identifier */
  readonly id: string;

  /** Target aggregate ID */
  readonly aggregateId: string;

  /** When the command was created */
  readonly timestamp: Date;

  /** Correlation ID for tracing */
  readonly correlationId?: CorrelationId;

  /** Actor who issued the command */
  readonly actor?: {
    id: string;
    type: ActorType;
  };

  /** Idempotency key for deduplication */
  readonly idempotencyKey?: string;

  /** Expected aggregate version for optimistic concurrency */
  readonly expectedVersion?: EventVersion;

  /** Command payload */
  readonly payload: TPayload;
}

/**
 * Command result - success case
 */
export interface CommandSuccess {
  aggregateId: string;
  newVersion: EventVersion;
  events: DomainEvent[];
}

/**
 * Command error types
 */
export enum CommandErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AGGREGATE_NOT_FOUND = 'AGGREGATE_NOT_FOUND',
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

/**
 * Command error
 */
export class CommandError extends Error {
  constructor(
    public readonly code: CommandErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/**
 * Command result type
 */
export type CommandResult =
  | { success: true; data: CommandSuccess }
  | { success: false; error: CommandError };

/**
 * Command handler type
 */
export type CommandHandler<TCommand extends Command, TAggregate> = (
  command: TCommand,
  aggregate: TAggregate | null
) => Promise<DomainEvent[]>;

/**
 * Create a command
 */
export function createCommand<TPayload = Record<string, unknown>>(
  params: Omit<Command<TPayload>, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: Date;
  }
): Command<TPayload> {
  return {
    id: params.id ?? globalThis.crypto.randomUUID(),
    aggregateId: params.aggregateId,
    timestamp: params.timestamp ?? new Date(),
    correlationId: params.correlationId,
    actor: params.actor,
    idempotencyKey: params.idempotencyKey,
    expectedVersion: params.expectedVersion,
    payload: params.payload,
  };
}

/**
 * Command dispatcher interface
 */
export interface ICommandDispatcher {
  dispatch<TCommand extends Command>(command: TCommand): Promise<CommandResult>;
  register<TCommand extends Command, TAggregate>(
    commandType: string,
    handler: CommandHandler<TCommand, TAggregate>
  ): void;
}

/**
 * Simple in-memory command dispatcher
 */
export class InMemoryCommandDispatcher implements ICommandDispatcher {
  private handlers = new Map<string, CommandHandler<Command, unknown>>();
  private processedKeys = new Set<string>();

  register<TCommand extends Command, TAggregate>(
    commandType: string,
    handler: CommandHandler<TCommand, TAggregate>
  ): void {
    this.handlers.set(commandType, handler as CommandHandler<Command, unknown>);
  }

  async dispatch<TCommand extends Command>(command: TCommand): Promise<CommandResult> {
    // Check idempotency
    if (command.idempotencyKey) {
      if (this.processedKeys.has(command.idempotencyKey)) {
        return {
          success: true,
          data: {
            aggregateId: command.aggregateId,
            newVersion: 0, // Would need to return cached result
            events: [],
          },
        };
      }
    }

    const commandType = command.constructor.name;
    const handler = this.handlers.get(commandType);

    if (!handler) {
      return {
        success: false,
        error: new CommandError(
          CommandErrorCode.VALIDATION_ERROR,
          `No handler registered for command type: ${commandType}`
        ),
      };
    }

    try {
      const events = await handler(command, null);

      if (command.idempotencyKey) {
        this.processedKeys.add(command.idempotencyKey);
      }

      return {
        success: true,
        data: {
          aggregateId: command.aggregateId,
          newVersion: events.length,
          events,
        },
      };
    } catch (err) {
      if (err instanceof CommandError) {
        return { success: false, error: err };
      }

      return {
        success: false,
        error: new CommandError(
          CommandErrorCode.BUSINESS_RULE_VIOLATION,
          err instanceof Error ? err.message : String(err)
        ),
      };
    }
  }

  /**
   * Clear processed idempotency keys (for testing)
   */
  clearIdempotencyKeys(): void {
    this.processedKeys.clear();
  }
}

/**
 * Validate a command has required fields
 */
export function validateCommand(command: Command): string[] {
  const errors: string[] = [];

  if (!command.aggregateId) {
    errors.push('aggregateId is required');
  }

  if (!command.payload || typeof command.payload !== 'object') {
    errors.push('payload must be an object');
  }

  return errors;
}
