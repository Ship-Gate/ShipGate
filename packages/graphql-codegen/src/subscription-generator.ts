/**
 * GraphQL Subscription Generator
 *
 * Generate real-time subscription infrastructure from ISL specifications.
 */

export interface SubscriptionOptions {
  /** Pub/Sub implementation */
  pubsub?: 'redis' | 'memory' | 'kafka' | 'rabbitmq';
  /** Include filtering */
  includeFiltering?: boolean;
  /** Include authorization */
  includeAuth?: boolean;
}

export class SubscriptionGenerator {
  private options: Required<SubscriptionOptions>;

  constructor(options: SubscriptionOptions = {}) {
    this.options = {
      pubsub: options.pubsub ?? 'redis',
      includeFiltering: options.includeFiltering ?? true,
      includeAuth: options.includeAuth ?? true,
    };
  }

  /**
   * Generate subscription infrastructure
   */
  generate(islContent: string): string {
    const domain = this.parseISL(islContent);
    const parts: string[] = [];

    // Imports based on pubsub type
    parts.push(this.generateImports());

    // PubSub setup
    parts.push(this.generatePubSubSetup());

    // Event types
    parts.push(this.generateEventTypes(domain));

    // Subscription handlers
    parts.push(this.generateSubscriptionHandlers(domain));

    // Event publishers
    parts.push(this.generateEventPublishers(domain));

    return parts.join('\n\n');
  }

  private generateImports(): string {
    switch (this.options.pubsub) {
      case 'redis':
        return `
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';`;
      case 'kafka':
        return `
import { KafkaPubSub } from 'graphql-kafka-subscriptions';`;
      case 'rabbitmq':
        return `
import { AmqpPubSub } from 'graphql-rabbitmq-subscriptions';`;
      default:
        return `
import { PubSub } from 'graphql-subscriptions';`;
    }
  }

  private generatePubSubSetup(): string {
    switch (this.options.pubsub) {
      case 'redis':
        return `
const redisOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const pubsub = new RedisPubSub({
  publisher: new Redis(redisOptions),
  subscriber: new Redis(redisOptions),
});`;
      case 'kafka':
        return `
export const pubsub = new KafkaPubSub({
  topic: 'graphql-subscriptions',
  host: process.env.KAFKA_HOST ?? 'localhost',
  port: process.env.KAFKA_PORT ?? '9092',
  globalConfig: {
    'client.id': 'graphql-server',
    'group.id': 'graphql-subscriptions',
  },
});`;
      default:
        return `
export const pubsub = new PubSub();`;
    }
  }

  private generateEventTypes(domain: { entities: Array<{ name: string }> }): string {
    const events: string[] = [];

    for (const entity of domain.entities) {
      events.push(`
export enum ${entity.name}EventType {
  CREATED = '${entity.name.toUpperCase()}_CREATED',
  UPDATED = '${entity.name.toUpperCase()}_UPDATED',
  DELETED = '${entity.name.toUpperCase()}_DELETED',
}

export interface ${entity.name}CreatedEvent {
  type: ${entity.name}EventType.CREATED;
  payload: ${entity.name};
  timestamp: string;
}

export interface ${entity.name}UpdatedEvent {
  type: ${entity.name}EventType.UPDATED;
  payload: ${entity.name};
  changes: Partial<${entity.name}>;
  timestamp: string;
}

export interface ${entity.name}DeletedEvent {
  type: ${entity.name}EventType.DELETED;
  id: string;
  timestamp: string;
}`);
    }

    return events.join('\n');
  }

  private generateSubscriptionHandlers(domain: { entities: Array<{ name: string }> }): string {
    const handlers: string[] = [];

    for (const entity of domain.entities) {
      const nameLower = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);

      handlers.push(`
export const ${nameLower}Subscriptions = {
  ${nameLower}Created: {
    subscribe: withFilter(
      () => pubsub.asyncIterator(${entity.name}EventType.CREATED),
      ${this.options.includeFiltering ? `
      (payload, variables, context) => {
        // Apply filtering logic
        if (variables.filter) {
          return applyFilter(payload.${nameLower}Created, variables.filter);
        }
        return true;
      }` : '() => true'}
    ),
    ${this.options.includeAuth ? `
    resolve: (payload: any, args: any, context: any) => {
      // Authorization check
      if (!context.user) {
        throw new Error('Unauthorized');
      }
      return payload.${nameLower}Created;
    },` : ''}
  },

  ${nameLower}Updated: {
    subscribe: withFilter(
      () => pubsub.asyncIterator(${entity.name}EventType.UPDATED),
      (payload, variables) => {
        if (variables.id) {
          return payload.${nameLower}Updated.id === variables.id;
        }
        return true;
      }
    ),
  },

  ${nameLower}Deleted: {
    subscribe: withFilter(
      () => pubsub.asyncIterator(${entity.name}EventType.DELETED),
      (payload, variables) => {
        if (variables.id) {
          return payload.${nameLower}Deleted === variables.id;
        }
        return true;
      }
    ),
  },
};`);
    }

    return `
import { withFilter } from 'graphql-subscriptions';

function applyFilter(entity: any, filter: any): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (key === 'AND') {
      if (!Array.isArray(value) || !value.every(f => applyFilter(entity, f))) {
        return false;
      }
    } else if (key === 'OR') {
      if (!Array.isArray(value) || !value.some(f => applyFilter(entity, f))) {
        return false;
      }
    } else if (entity[key] !== value) {
      return false;
    }
  }
  return true;
}

${handlers.join('\n')}`;
  }

  private generateEventPublishers(domain: { entities: Array<{ name: string }> }): string {
    const publishers: string[] = [];

    for (const entity of domain.entities) {
      const nameLower = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);

      publishers.push(`
export const ${nameLower}Events = {
  publishCreated: (entity: ${entity.name}) => {
    pubsub.publish(${entity.name}EventType.CREATED, {
      ${nameLower}Created: entity,
    });
  },

  publishUpdated: (entity: ${entity.name}, changes: Partial<${entity.name}>) => {
    pubsub.publish(${entity.name}EventType.UPDATED, {
      ${nameLower}Updated: entity,
      changes,
    });
  },

  publishDeleted: (id: string) => {
    pubsub.publish(${entity.name}EventType.DELETED, {
      ${nameLower}Deleted: id,
    });
  },
};`);
    }

    return publishers.join('\n');
  }

  private parseISL(content: string): { entities: Array<{ name: string }> } {
    const entities: Array<{ name: string }> = [];
    const entityRegex = /entity\s+(\w+)\s*\{/g;
    let match;
    while ((match = entityRegex.exec(content)) !== null) {
      entities.push({ name: match[1] });
    }
    return { entities };
  }
}

export function generateSubscriptions(
  islContent: string,
  options?: SubscriptionOptions
): string {
  const generator = new SubscriptionGenerator(options);
  return generator.generate(islContent);
}
