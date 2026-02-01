# @intentos/stdlib-messaging

ISL Standard Library - Messaging

Provides messaging primitives: queues, topics, and pub/sub patterns for building distributed systems.

## Features

- **Message Queues**: FIFO, standard, priority, and delay queues
- **Pub/Sub Topics**: Fan-out message distribution with filtering
- **Visibility Timeouts**: At-least-once delivery with automatic retry
- **Dead Letter Queues**: Handle failed messages gracefully
- **Idempotency**: Prevent duplicate message processing
- **Batching**: Efficient bulk operations

## Installation

```bash
pnpm add @intentos/stdlib-messaging
```

## Quick Start

```typescript
import { 
  CreateQueue, 
  CreateTopic, 
  Subscribe, 
  Publish, 
  Consume, 
  Acknowledge 
} from '@intentos/stdlib-messaging';

// 1. Create infrastructure
await CreateQueue({ name: 'orders-queue' });
await CreateTopic({ name: 'order-events' });

// 2. Subscribe queue to topic
await Subscribe({ 
  topic: 'order-events', 
  queue: 'orders-queue' 
});

// 3. Publish a message
await Publish({
  topic: 'order-events',
  payload: JSON.stringify({ orderId: '123', status: 'created' }),
});

// 4. Consume messages
const result = await Consume({ 
  queue: 'orders-queue',
  maxMessages: 10,
  visibilityTimeout: 30000,
});

// 5. Process and acknowledge
for (const message of result.data) {
  // Process message...
  await Acknowledge({ messageId: message.id });
}
```

## ISL Specification

The messaging domain is fully specified in ISL. See the `intents/` directory for complete specifications:

- `domain.isl` - Main domain definition
- `message.isl` - Message entity
- `queue.isl` - Queue entity and operations
- `topic.isl` - Topic and subscription entities
- `behaviors/` - All behavior specifications

## API Reference

### Queue Operations

#### CreateQueue

Create a new message queue.

```typescript
await CreateQueue({
  name: 'my-queue',
  type: 'STANDARD',        // STANDARD | FIFO | PRIORITY | DELAY
  acknowledgeMode: 'MANUAL', // AUTO | MANUAL | TRANSACTIONAL
  deadLetterQueue: 'my-dlq',
  maxReceiveCount: 3,
  defaultVisibilityTimeout: 30000,
  delaySeconds: 0,
});
```

#### DeleteQueue

```typescript
await DeleteQueue({ 
  name: 'my-queue', 
  force: false  // Force delete even if not empty
});
```

#### PurgeQueue

Remove all messages from a queue.

```typescript
await PurgeQueue({ name: 'my-queue' });
```

#### GetQueueStats

```typescript
const stats = await GetQueueStats({ name: 'my-queue' });
// { messageCount, inFlightCount, oldestMessageAge }
```

### Topic Operations

#### CreateTopic

```typescript
await CreateTopic({
  name: 'my-topic',
  contentBasedDeduplication: false,
  deduplicationWindow: 300000, // 5 minutes
});
```

#### DeleteTopic

```typescript
await DeleteTopic({ 
  name: 'my-topic', 
  force: false 
});
```

### Subscription Operations

#### Subscribe

```typescript
await Subscribe({
  topic: 'my-topic',
  queue: 'my-queue',
  filter: '{"type": "order"}',  // Optional JSON filter
  enableBatching: true,
  batchSize: 10,
});
```

#### Unsubscribe

```typescript
await Unsubscribe({ 
  subscriptionId: 'sub-123' 
});
```

### Message Operations

#### Publish

```typescript
await Publish({
  topic: 'my-topic',
  payload: '{"data": "value"}',
  contentType: 'application/json',
  headers: { 'x-custom': 'value' },
  idempotencyKey: 'unique-key',  // Prevent duplicates
  delay: 5000,                    // Delay delivery
  expiresAt: new Date('2024-12-31'),
});
```

#### Consume

```typescript
const messages = await Consume({
  queue: 'my-queue',
  maxMessages: 10,
  visibilityTimeout: 30000,  // 30 seconds
  waitTime: 20000,           // Long polling
});
```

#### Peek

View messages without consuming.

```typescript
const messages = await Peek({
  queue: 'my-queue',
  maxMessages: 10,
});
```

#### Acknowledge

```typescript
await Acknowledge({ messageId: 'msg-123' });
```

#### AcknowledgeBatch

```typescript
await AcknowledgeBatch({ 
  messageIds: ['msg-1', 'msg-2', 'msg-3'] 
});
```

#### Reject

Return message to queue for retry.

```typescript
await Reject({ 
  messageId: 'msg-123',
  delay: 5000,  // Delay before retry
  reason: 'Processing failed',
});
```

#### DeadLetter

Move message to dead letter queue.

```typescript
await DeadLetter({ 
  messageId: 'msg-123',
  reason: 'Max retries exceeded',
});
```

#### ChangeMessageVisibility

Extend or reset visibility timeout.

```typescript
await ChangeMessageVisibility({
  messageId: 'msg-123',
  visibilityTimeout: 60000,  // Extend to 60s
});
```

## Message Structure

```typescript
interface Message {
  id: string;           // UUID
  topic: string;        // Source topic
  queue?: string;       // Current queue
  payload: string;      // Message content
  contentType: string;  // MIME type
  headers: Map<string, string>;
  
  // Correlation
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  
  // Timestamps
  createdAt: Date;
  scheduledAt?: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  expiresAt?: Date;
  
  // Delivery state
  status: 'PENDING' | 'DELIVERED' | 'ACKNOWLEDGED' | 'DEAD_LETTERED';
  retryCount: number;
  maxRetries: number;
  visibilityTimeout?: number;
  visibleAt?: Date;
  
  // Dead letter
  deadLetterReason?: string;
  deadLetterAt?: Date;
  originalQueue?: string;
}
```

## Queue Types

| Type | Description |
|------|-------------|
| `STANDARD` | At-least-once delivery, no ordering guarantee |
| `FIFO` | Exactly-once, strict ordering |
| `PRIORITY` | Priority-based message ordering |
| `DELAY` | All messages delayed by default |

## Delivery Guarantees

- **At-least-once**: Messages may be delivered multiple times
- **Visibility timeout**: Prevents duplicate processing
- **Dead letter**: Failed messages are preserved
- **Idempotency**: Duplicate publishes with same key are deduplicated

## Best Practices

### 1. Use Idempotency Keys

```typescript
await Publish({
  topic: 'payments',
  payload: '...',
  idempotencyKey: `payment-${paymentId}`,
});
```

### 2. Configure Dead Letter Queues

```typescript
await CreateQueue({ name: 'orders-dlq' });
await CreateQueue({ 
  name: 'orders',
  deadLetterQueue: 'orders-dlq',
  maxReceiveCount: 3,
});
```

### 3. Use Visibility Timeout Wisely

```typescript
// Extend timeout for long-running processing
const processing = processMessage(message);
const timeout = setInterval(async () => {
  await ChangeMessageVisibility({
    messageId: message.id,
    visibilityTimeout: 30000,
  });
}, 25000);

await processing;
clearInterval(timeout);
await Acknowledge({ messageId: message.id });
```

### 4. Handle Failures Gracefully

```typescript
try {
  await processMessage(message);
  await Acknowledge({ messageId: message.id });
} catch (error) {
  if (isRetryable(error)) {
    await Reject({ messageId: message.id, delay: 5000 });
  } else {
    await DeadLetter({ messageId: message.id, reason: error.message });
  }
}
```

## License

MIT
