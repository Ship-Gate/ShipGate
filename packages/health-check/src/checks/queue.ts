/**
 * Queue Health Checks
 * 
 * Health check implementations for message queue systems.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  QueueCheckConfig,
  QueueConnection,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Queue Check Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a queue health check
 */
export function createQueueCheck(config: QueueCheckConfig): HealthCheckConfig {
  return {
    name: config.name,
    critical: config.critical ?? true,
    timeout: config.timeout ?? 5000,
    check: async () => performQueueCheck(config),
  };
}

/**
 * Perform the actual queue health check
 */
async function performQueueCheck(config: QueueCheckConfig): Promise<CheckResult> {
  const start = Date.now();

  try {
    switch (config.type) {
      case 'rabbitmq':
        return await checkRabbitMQ(config, start);
      case 'kafka':
        return await checkKafka(config, start);
      case 'sqs':
        return await checkSQS(config, start);
      case 'redis-queue':
        return await checkRedisQueue(config, start);
      default:
        return {
          status: 'unhealthy',
          message: `Unknown queue type: ${config.type}`,
          timestamp: Date.now(),
        };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RabbitMQ Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkRabbitMQ(config: QueueCheckConfig, start: number): Promise<CheckResult> {
  try {
    const amqp = await import('amqplib');
    const connection = await amqp.connect(config.connectionString ?? 'amqp://localhost');

    try {
      const channel = await connection.createChannel();
      
      // Check specific queue if provided
      let queueInfo: { messageCount: number; consumerCount: number } | undefined;
      if (config.queueName) {
        const queue = await channel.checkQueue(config.queueName);
        queueInfo = {
          messageCount: queue.messageCount,
          consumerCount: queue.consumerCount,
        };
      }

      const latency = Date.now() - start;

      await channel.close();

      return {
        status: 'healthy',
        latency,
        details: {
          type: 'rabbitmq',
          queue: config.queueName,
          ...(queueInfo && {
            messageCount: queueInfo.messageCount,
            consumerCount: queueInfo.consumerCount,
          }),
        },
        timestamp: Date.now(),
      };
    } finally {
      await connection.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'RabbitMQ driver (amqplib) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Kafka Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkKafka(config: QueueCheckConfig, start: number): Promise<CheckResult> {
  try {
    const { Kafka } = await import('kafkajs');
    const kafka = new Kafka({
      clientId: 'health-check',
      brokers: [config.connectionString ?? 'localhost:9092'],
      connectionTimeout: config.timeout ?? 5000,
    });

    const admin = kafka.admin();

    try {
      await admin.connect();
      const topics = await admin.listTopics();
      const latency = Date.now() - start;

      // Check specific topic if provided
      let topicInfo: { partitions: number } | undefined;
      if (config.queueName && topics.includes(config.queueName)) {
        const metadata = await admin.fetchTopicMetadata({ topics: [config.queueName] });
        topicInfo = {
          partitions: metadata.topics[0]?.partitions.length ?? 0,
        };
      }

      return {
        status: 'healthy',
        latency,
        details: {
          type: 'kafka',
          topicCount: topics.length,
          topic: config.queueName,
          ...(topicInfo && { partitions: topicInfo.partitions }),
        },
        timestamp: Date.now(),
      };
    } finally {
      await admin.disconnect();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'Kafka driver (kafkajs) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AWS SQS Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkSQS(config: QueueCheckConfig, start: number): Promise<CheckResult> {
  try {
    const { SQSClient, GetQueueAttributesCommand } = await import('@aws-sdk/client-sqs');
    const client = new SQSClient({});

    try {
      if (!config.queueName) {
        return {
          status: 'unhealthy',
          message: 'Queue URL required for SQS health check',
          timestamp: Date.now(),
        };
      }

      const command = new GetQueueAttributesCommand({
        QueueUrl: config.queueName,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
      });

      const response = await client.send(command);
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
        details: {
          type: 'sqs',
          queueUrl: config.queueName,
          approximateMessages: response.Attributes?.ApproximateNumberOfMessages,
          messagesInFlight: response.Attributes?.ApproximateNumberOfMessagesNotVisible,
        },
        timestamp: Date.now(),
      };
    } finally {
      client.destroy();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'AWS SDK (@aws-sdk/client-sqs) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Redis Queue Check (Bull/BullMQ)
// ═══════════════════════════════════════════════════════════════════════════

async function checkRedisQueue(config: QueueCheckConfig, start: number): Promise<CheckResult> {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(config.connectionString ?? 'redis://localhost:6379');

    try {
      await redis.ping();
      
      // Check specific queue if provided
      let queueInfo: Record<string, number> | undefined;
      if (config.queueName) {
        const [waiting, active, completed, failed] = await Promise.all([
          redis.llen(`bull:${config.queueName}:wait`),
          redis.llen(`bull:${config.queueName}:active`),
          redis.zcard(`bull:${config.queueName}:completed`),
          redis.zcard(`bull:${config.queueName}:failed`),
        ]);
        queueInfo = { waiting, active, completed, failed };
      }

      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
        details: {
          type: 'redis-queue',
          queue: config.queueName,
          ...queueInfo,
        },
        timestamp: Date.now(),
      };
    } finally {
      await redis.quit();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'Redis driver (ioredis) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic Queue Check with Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a queue check using an existing connection
 */
export function createQueueCheckWithConnection(
  name: string,
  connection: QueueConnection,
  options: {
    critical?: boolean;
    timeout?: number;
  } = {}
): HealthCheckConfig {
  return {
    name,
    critical: options.critical ?? true,
    timeout: options.timeout ?? 5000,
    check: async () => {
      const start = Date.now();

      try {
        let details: Record<string, unknown> = {};

        if (connection.checkQueue) {
          const result = await Promise.race([
            connection.checkQueue(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Queue check timeout')), options.timeout ?? 5000)
            ),
          ]);
          details = { messageCount: result.messageCount };
        }

        const latency = Date.now() - start;

        return {
          status: 'healthy',
          latency,
          details,
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Queue check failed',
          timestamp: Date.now(),
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Queue Backlog Check
// ═══════════════════════════════════════════════════════════════════════════

export interface QueueBacklogStats {
  pending: number;
  processing: number;
  failed: number;
  processRate?: number; // messages per second
}

/**
 * Create a check for queue backlog health
 */
export function createQueueBacklogCheck(
  name: string,
  getBacklogStats: () => QueueBacklogStats | Promise<QueueBacklogStats>,
  options: {
    maxPending?: number;
    maxFailed?: number;
    minProcessRate?: number;
    critical?: boolean;
  } = {}
): HealthCheckConfig {
  const maxPending = options.maxPending ?? 10000;
  const maxFailed = options.maxFailed ?? 100;
  const minProcessRate = options.minProcessRate ?? 0;

  return {
    name: `${name}-backlog`,
    critical: options.critical ?? false,
    check: async () => {
      const start = Date.now();

      try {
        const stats = await getBacklogStats();
        let status: CheckResult['status'] = 'healthy';
        const messages: string[] = [];

        if (stats.pending > maxPending) {
          status = 'degraded';
          messages.push(`High backlog: ${stats.pending} pending messages`);
        }

        if (stats.failed > maxFailed) {
          status = 'degraded';
          messages.push(`High failure count: ${stats.failed} failed messages`);
        }

        if (stats.processRate !== undefined && stats.processRate < minProcessRate) {
          status = 'degraded';
          messages.push(`Low process rate: ${stats.processRate}/s`);
        }

        return {
          status,
          latency: Date.now() - start,
          message: messages.join('; ') || undefined,
          details: {
            pending: stats.pending,
            processing: stats.processing,
            failed: stats.failed,
            processRate: stats.processRate,
          },
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Failed to get backlog stats',
          timestamp: Date.now(),
        };
      }
    },
  };
}
