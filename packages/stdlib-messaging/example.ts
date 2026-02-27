/**
 * Minimal example of using the stdlib-messaging package
 */

import {
  createMemoryQueueAdapter,
  createProducer,
  createConsumer,
  createJsonSerializer,
  HandlerResult,
  createLoggingMiddleware,
  createMetricsMiddleware,
  QueueType,
  AcknowledgeMode,
} from './src/index.js';

async function main() {
  // Create an in-memory queue adapter
  const adapter = createMemoryQueueAdapter();
  
  // Create queues
  await adapter.createQueue({
    name: 'orders',
    type: QueueType.STANDARD,
    acknowledgeMode: AcknowledgeMode.MANUAL,
    defaultVisibilityTimeout: 30000,
    messageRetention: 1209600000, // 14 days
    delaySeconds: 0,
    maxMessageSize: 262144, // 256KB
    maxReceiveCount: 5,
    tags: { environment: 'dev' },
  });
  
  await adapter.createQueue({
    name: 'orders-dlq',
    type: QueueType.STANDARD,
    acknowledgeMode: AcknowledgeMode.MANUAL,
    defaultVisibilityTimeout: 30000,
    messageRetention: 1209600000,
    delaySeconds: 0,
    maxMessageSize: 262144,
    maxReceiveCount: 5,
    tags: { environment: 'dev' },
  });
  
  // Create middleware
  const loggingMiddleware = createLoggingMiddleware();
  const metricsMiddleware = createMetricsMiddleware();
  
  // Create a producer with middleware
  const producer = createProducer(adapter, {
    defaultQueue: 'orders',
    middleware: [loggingMiddleware, metricsMiddleware],
  });
  
  // Create a consumer
  const consumer = createConsumer(adapter, {
    queue: 'orders',
    maxMessages: 10,
    visibilityTimeout: 30000,
    waitTime: 1000,
    handler: async (message) => {
      console.log('Processing order:', message.payload);
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Acknowledge the message
      return HandlerResult.ACK;
    },
    middleware: [loggingMiddleware, metricsMiddleware],
  });
  
  // Start the consumer
  await consumer.start();
  
  // Produce some messages
  for (let i = 1; i <= 5; i++) {
    await producer.produce({
      id: `order-${i}`,
      customerId: `customer-${i % 3 + 1}`,
      amount: i * 100,
      items: [`item-${i}`],
    });
    
    console.log(`Sent order ${i}`);
  }
  
  // Wait for messages to be processed
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Stop the consumer
  await consumer.stop();
  
  // Close the producer
  await producer.close();
  
  // Get queue stats
  const stats = await adapter.getQueueStats('orders');
  console.log('Queue stats:', stats);
  
  // Close the adapter
  await adapter.close();
}

// Run the example
main().catch(console.error);
