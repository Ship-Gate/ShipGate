/**
 * ISL CQRS Implementation
 * 
 * Command Query Responsibility Segregation pattern
 */

import type {
  Command,
  CommandHandler,
  CommandMetadata,
  Query,
  QueryHandler,
  QueryMetadata,
} from './types';

/**
 * Command bus for dispatching commands
 */
export class CommandBus {
  private handlers = new Map<string, CommandHandler<unknown, unknown>>();
  private middleware: CommandMiddleware[] = [];

  /**
   * Register a command handler
   */
  register<TPayload, TResult>(handler: CommandHandler<TPayload, TResult>): void {
    this.handlers.set(handler.commandType, handler as CommandHandler<unknown, unknown>);
  }

  /**
   * Add middleware
   */
  use(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Dispatch a command
   */
  async dispatch<TPayload, TResult>(command: Command<TPayload>): Promise<TResult> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command: ${command.type}`);
    }

    // Ensure metadata
    const commandWithMetadata: Command<TPayload> = {
      ...command,
      metadata: {
        commandId: crypto.randomUUID(),
        timestamp: Date.now(),
        ...command.metadata,
      },
    };

    // Run middleware
    let processedCommand = commandWithMetadata;
    for (const mw of this.middleware) {
      if (mw.before) {
        processedCommand = await mw.before(processedCommand) as Command<TPayload>;
      }
    }

    // Validate
    if (handler.validate) {
      const isValid = await handler.validate(processedCommand);
      if (!isValid) {
        throw new Error(`Command validation failed: ${command.type}`);
      }
    }

    // Execute
    let result = await handler.handle(processedCommand) as TResult;

    // Run after middleware
    for (const mw of [...this.middleware].reverse()) {
      if (mw.after) {
        result = await mw.after(processedCommand, result) as TResult;
      }
    }

    return result;
  }
}

/**
 * Command middleware
 */
export interface CommandMiddleware {
  before?: (command: Command<unknown>) => Promise<Command<unknown>>;
  after?: (command: Command<unknown>, result: unknown) => Promise<unknown>;
}

/**
 * Query bus for dispatching queries
 */
export class QueryBus {
  private handlers = new Map<string, QueryHandler<unknown, unknown>>();
  private middleware: QueryMiddleware[] = [];

  /**
   * Register a query handler
   */
  register<TParams, TResult>(handler: QueryHandler<TParams, TResult>): void {
    this.handlers.set(handler.queryType, handler as QueryHandler<unknown, unknown>);
  }

  /**
   * Add middleware
   */
  use(middleware: QueryMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Execute a query
   */
  async execute<TParams, TResult>(query: Query<TParams>): Promise<TResult> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for query: ${query.type}`);
    }

    // Ensure metadata
    const queryWithMetadata: Query<TParams> = {
      ...query,
      metadata: {
        queryId: crypto.randomUUID(),
        timestamp: Date.now(),
        ...query.metadata,
      },
    };

    // Run middleware
    let processedQuery = queryWithMetadata;
    for (const mw of this.middleware) {
      if (mw.before) {
        processedQuery = await mw.before(processedQuery) as Query<TParams>;
      }
    }

    // Execute
    let result = await handler.handle(processedQuery) as TResult;

    // Run after middleware
    for (const mw of [...this.middleware].reverse()) {
      if (mw.after) {
        result = await mw.after(processedQuery, result) as TResult;
      }
    }

    return result;
  }
}

/**
 * Query middleware
 */
export interface QueryMiddleware {
  before?: (query: Query<unknown>) => Promise<Query<unknown>>;
  after?: (query: Query<unknown>, result: unknown) => Promise<unknown>;
}

/**
 * Create a command
 */
export function createCommand<TPayload>(
  type: string,
  payload: TPayload,
  metadata?: Partial<CommandMetadata>
): Command<TPayload> {
  return {
    type,
    payload,
    metadata: {
      commandId: metadata?.commandId ?? crypto.randomUUID(),
      timestamp: metadata?.timestamp ?? Date.now(),
      ...metadata,
    },
  };
}

/**
 * Create a query
 */
export function createQuery<TParams>(
  type: string,
  params: TParams,
  metadata?: Partial<QueryMetadata>
): Query<TParams> {
  return {
    type,
    params,
    metadata: {
      queryId: metadata?.queryId ?? crypto.randomUUID(),
      timestamp: metadata?.timestamp ?? Date.now(),
      ...metadata,
    },
  };
}

/**
 * Command handler builder
 */
export function commandHandler<TPayload, TResult>(
  commandType: string,
  handle: CommandHandler<TPayload, TResult>['handle'],
  validate?: CommandHandler<TPayload, TResult>['validate']
): CommandHandler<TPayload, TResult> {
  return {
    commandType,
    handle,
    validate,
  };
}

/**
 * Query handler builder
 */
export function queryHandler<TParams, TResult>(
  queryType: string,
  handle: QueryHandler<TParams, TResult>['handle']
): QueryHandler<TParams, TResult> {
  return {
    queryType,
    handle,
  };
}

/**
 * Generate ISL specification for command
 */
export function commandToISL<TPayload>(type: string, payloadType: string): string {
  return `
command ${type} {
  payload: ${payloadType};
  
  preconditions {
    // Add preconditions
  }
  
  postconditions {
    // Add postconditions
  }
  
  invariants {
    // Add invariants
  }
}
`.trim();
}

/**
 * Generate ISL specification for query
 */
export function queryToISL<TParams, TResult>(
  type: string,
  paramsType: string,
  resultType: string
): string {
  return `
query ${type} {
  params: ${paramsType};
  returns: ${resultType};
  
  properties {
    idempotent;
    cacheable;
  }
}
`.trim();
}

/**
 * Logging middleware for commands
 */
export const loggingCommandMiddleware: CommandMiddleware = {
  before: async (command) => {
    console.log(`[Command] Dispatching: ${command.type}`, command.metadata);
    return command;
  },
  after: async (command, result) => {
    console.log(`[Command] Completed: ${command.type}`, result);
    return result;
  },
};

/**
 * Logging middleware for queries
 */
export const loggingQueryMiddleware: QueryMiddleware = {
  before: async (query) => {
    console.log(`[Query] Executing: ${query.type}`, query.metadata);
    return query;
  },
  after: async (query, result) => {
    console.log(`[Query] Completed: ${query.type}`, result);
    return result;
  },
};
