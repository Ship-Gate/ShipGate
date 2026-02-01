/**
 * Command Bus
 *
 * CQRS command handling infrastructure.
 */

import { v4 as uuidv4 } from 'uuid';

export interface Command<T = unknown> {
  /** Command type */
  type: string;
  /** Command payload */
  payload: T;
  /** Command metadata */
  metadata?: CommandMetadata;
}

export interface CommandMetadata {
  /** Command ID */
  id?: string;
  /** User who issued command */
  userId?: string;
  /** Correlation ID */
  correlationId?: string;
  /** Timestamp */
  timestamp?: string;
}

export interface CommandResult<T = unknown> {
  /** Success status */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message */
  error?: string;
  /** Events generated */
  events?: Array<{ type: string; payload: unknown }>;
}

export type CommandHandler<TPayload = unknown, TResult = unknown> = (
  command: Command<TPayload>
) => Promise<CommandResult<TResult>>;

export interface CommandBusOptions {
  /** Middleware to apply */
  middleware?: CommandMiddleware[];
  /** Enable command logging */
  logging?: boolean;
  /** Validation mode */
  validation?: 'strict' | 'lenient' | 'none';
}

export type CommandMiddleware = (
  command: Command,
  next: () => Promise<CommandResult>
) => Promise<CommandResult>;

export class CommandBus {
  private handlers: Map<string, CommandHandler>;
  private middleware: CommandMiddleware[];
  private options: Required<CommandBusOptions>;

  constructor(options: CommandBusOptions = {}) {
    this.handlers = new Map();
    this.middleware = options.middleware ?? [];
    this.options = {
      middleware: options.middleware ?? [],
      logging: options.logging ?? true,
      validation: options.validation ?? 'strict',
    };
  }

  /**
   * Register a command handler
   */
  register<TPayload, TResult>(
    commandType: string,
    handler: CommandHandler<TPayload, TResult>
  ): void {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command: ${commandType}`);
    }
    this.handlers.set(commandType, handler as CommandHandler);
  }

  /**
   * Execute a command
   */
  async execute<TPayload, TResult>(
    command: Command<TPayload>
  ): Promise<CommandResult<TResult>> {
    // Add metadata
    const fullCommand: Command<TPayload> = {
      ...command,
      metadata: {
        id: command.metadata?.id ?? uuidv4(),
        timestamp: command.metadata?.timestamp ?? new Date().toISOString(),
        ...command.metadata,
      },
    };

    if (this.options.logging) {
      console.log(`[Command] ${fullCommand.type}`, fullCommand.metadata?.id);
    }

    // Build middleware chain
    const handler = this.handlers.get(fullCommand.type);
    if (!handler) {
      return {
        success: false,
        error: `No handler registered for command: ${fullCommand.type}`,
      };
    }

    const executeHandler = async () => handler(fullCommand);

    // Apply middleware in reverse order
    let chain = executeHandler;
    for (const mw of [...this.middleware].reverse()) {
      const currentChain = chain;
      chain = () => mw(fullCommand, currentChain);
    }

    try {
      const result = await chain();

      if (this.options.logging) {
        console.log(
          `[Command] ${fullCommand.type} ${result.success ? 'succeeded' : 'failed'}`,
          result.error
        );
      }

      return result as CommandResult<TResult>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (this.options.logging) {
        console.error(`[Command] ${fullCommand.type} error:`, message);
      }

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Create a command
   */
  createCommand<T>(type: string, payload: T, metadata?: CommandMetadata): Command<T> {
    return {
      type,
      payload,
      metadata: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Add middleware
   */
  use(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Check if handler is registered
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  /**
   * Get registered command types
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Built-in middleware
 */
export const CommandMiddleware = {
  /**
   * Logging middleware
   */
  logging(): CommandMiddleware {
    return async (command, next) => {
      const start = Date.now();
      console.log(`[Command Start] ${command.type}`, command.metadata?.id);

      const result = await next();

      const duration = Date.now() - start;
      console.log(
        `[Command End] ${command.type} - ${result.success ? 'OK' : 'FAIL'} (${duration}ms)`
      );

      return result;
    };
  },

  /**
   * Timing middleware
   */
  timing(): CommandMiddleware {
    return async (command, next) => {
      const start = Date.now();
      const result = await next();
      const duration = Date.now() - start;

      return {
        ...result,
        metadata: {
          ...(result as unknown as { metadata?: Record<string, unknown> }).metadata,
          duration,
        },
      } as CommandResult;
    };
  },

  /**
   * Retry middleware
   */
  retry(maxRetries: number = 3, delay: number = 100): CommandMiddleware {
    return async (command, next) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await next();
        } catch (error) {
          lastError = error as Error;
          await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt)));
        }
      }

      return {
        success: false,
        error: lastError?.message ?? 'Max retries exceeded',
      };
    };
  },

  /**
   * Validation middleware
   */
  validation(validators: Record<string, (payload: unknown) => string | null>): CommandMiddleware {
    return async (command, next) => {
      const validator = validators[command.type];
      if (validator) {
        const error = validator(command.payload);
        if (error) {
          return { success: false, error };
        }
      }
      return next();
    };
  },

  /**
   * Authorization middleware
   */
  authorization(
    checker: (command: Command) => Promise<boolean>
  ): CommandMiddleware {
    return async (command, next) => {
      const authorized = await checker(command);
      if (!authorized) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }
      return next();
    };
  },
};

/**
 * Create a command bus instance
 */
export function createCommandBus(options?: CommandBusOptions): CommandBus {
  return new CommandBus(options);
}
