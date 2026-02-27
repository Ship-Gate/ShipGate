/**
 * Type declarations for optional dependencies
 * These modules are optional peer dependencies and may not be installed
 */

// Database drivers
declare module 'pg' {
  export class Pool {
    constructor(config: {
      connectionString?: string;
      connectionTimeoutMillis?: number;
    });
    query(sql: string): Promise<{ rowCount: number | null }>;
    end(): Promise<void>;
  }
}

declare module 'mysql2/promise' {
  export function createConnection(config: {
    uri?: string;
    connectTimeout?: number;
  }): Promise<{
    query(sql: string): Promise<unknown>;
    end(): Promise<void>;
  }>;
}

declare module 'mongodb' {
  export class MongoClient {
    constructor(uri: string, options?: { serverSelectionTimeoutMS?: number });
    connect(): Promise<void>;
    db(): { admin(): { ping(): Promise<unknown> } };
    close(): Promise<void>;
  }
}

declare module 'better-sqlite3' {
  interface Database {
    exec(sql: string): void;
    close(): void;
  }
  function betterSqlite3(filename: string): Database;
  export default betterSqlite3;
}

// Cache drivers
declare module 'memcached' {
  class Memcached {
    constructor(server: string, options?: { timeout?: number });
    stats(callback: (err: Error | null, stats: unknown[]) => void): void;
    end(): void;
  }
  export default Memcached;
}

// Queue drivers
declare module 'amqplib' {
  export function connect(url: string): Promise<{
    createChannel(): Promise<{
      checkQueue(queue: string): Promise<{ messageCount: number; consumerCount: number }>;
      close(): Promise<void>;
    }>;
    close(): Promise<void>;
  }>;
}

declare module 'kafkajs' {
  export class Kafka {
    constructor(config: {
      clientId: string;
      brokers: string[];
      connectionTimeout?: number;
    });
    admin(): {
      connect(): Promise<void>;
      listTopics(): Promise<string[]>;
      fetchTopicMetadata(options: { topics: string[] }): Promise<{
        topics: Array<{ partitions: unknown[] }>;
      }>;
      disconnect(): Promise<void>;
    };
  }
}

declare module '@aws-sdk/client-sqs' {
  export class SQSClient {
    constructor(config?: object);
    send(command: GetQueueAttributesCommand): Promise<{
      Attributes?: Record<string, string>;
    }>;
    destroy(): void;
  }
  export class GetQueueAttributesCommand {
    constructor(input: {
      QueueUrl: string;
      AttributeNames: string[];
    });
  }
}

// gRPC
declare module '@grpc/grpc-js' {
  // Minimal type declaration for health check verification
  const grpc: unknown;
  export = grpc;
}

declare module '@grpc/proto-loader' {
  // Minimal type declaration for health check verification
  export function loadSync(path: string, options?: object): unknown;
}
