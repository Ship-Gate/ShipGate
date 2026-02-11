/**
 * Routing pattern implementation
 */

import type { MessageEnvelope } from '../types.js';
import type { QueueAdapter } from '../queue/types.js';
import type { 
  RoutingPattern as IRoutingPattern,
  RoutingStrategy,
  RoutingResult,
} from './types.js';
import { MessageProducer } from '../queue/index.js';
import { RoutingError } from '../errors.js';

// ============================================================================
// ROUTING IMPLEMENTATION
// ============================================================================

export class RoutingPattern implements IRoutingPattern {
  private strategies = new Map<string, RoutingStrategy>();
  private producer: MessageProducer;
  
  constructor(private readonly adapter: QueueAdapter) {
    this.producer = new MessageProducer(adapter);
  }
  
  // -------------------------------------------------------------------------
  // ROUTING METHODS
  // -------------------------------------------------------------------------
  
  async route<T>(
    message: T,
    strategies?: RoutingStrategy[]
  ): Promise<RoutingResult> {
    // Create message envelope
    const envelope: MessageEnvelope<T> = {
      id: message.id || this.generateId(),
      payload: message,
      headers: {},
      contentType: 'application/json',
      timestamp: Date.now(),
      deliveryCount: 0,
      maxDeliveries: 10,
    };
    
    // Get available queues
    const availableQueues = await this.getAvailableQueues();
    
    if (availableQueues.length === 0) {
      throw new RoutingError('No queues available for routing');
    }
    
    // Use provided strategies or registered ones
    const strategiesToUse = strategies || Array.from(this.strategies.values());
    
    // Sort by priority
    strategiesToUse.sort((a, b) => b.priority - a.priority);
    
    // Try each strategy
    for (const strategy of strategiesToUse) {
      try {
        const selectedQueue = strategy.selectQueue(envelope, availableQueues);
        
        if (selectedQueue) {
          // Send message to selected queue
          await this.producer.produce(envelope.payload, {
            queue: selectedQueue,
            correlationId: envelope.correlationId,
            headers: {
              ...envelope.headers,
              'x-routing-strategy': strategy.name,
              'x-routed-at': Date.now().toString(),
            },
            priority: envelope.priority,
          });
          
          return {
            queue: selectedQueue,
            strategy: strategy.name,
            metadata: {
              timestamp: Date.now(),
              availableQueues: availableQueues.length,
              strategiesAttempted: strategiesToUse.indexOf(strategy) + 1,
            },
          };
        } else if (!strategy.continueOnNull) {
          // Strategy returned null and doesn't want to continue
          break;
        }
      } catch (error) {
        console.error(`Routing strategy '${strategy.name}' failed:`, error);
        // Continue to next strategy
      }
    }
    
    throw new RoutingError('No routing strategy could select a queue');
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY MANAGEMENT
  // -------------------------------------------------------------------------
  
  registerStrategy(strategy: RoutingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }
  
  unregisterStrategy(strategyName: string): void {
    this.strategies.delete(strategyName);
  }
  
  getStrategies(): RoutingStrategy[] {
    return Array.from(this.strategies.values());
  }
  
  /**
   * Get a specific strategy
   */
  getStrategy(name: string): RoutingStrategy | undefined {
    return this.strategies.get(name);
  }
  
  /**
   * Clear all strategies
   */
  clearStrategies(): void {
    this.strategies.clear();
  }
  
  // -------------------------------------------------------------------------
  // PRIVATE METHODS
  // -------------------------------------------------------------------------
  
  private async getAvailableQueues(): Promise<string[]> {
    // In a real implementation, this would query the adapter for available queues
    // For now, return a placeholder
    return [];
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  // -------------------------------------------------------------------------
  // CLOSE
  // -------------------------------------------------------------------------
  
  async close(): Promise<void> {
    await this.producer.close();
  }
}

// ============================================================================
// BUILT-IN ROUTING STRATEGIES
// ============================================================================

export class HeaderRoutingStrategy implements RoutingStrategy {
  name = 'header';
  priority = 100;
  continueOnNull = true;
  
  constructor(
    private readonly headerName: string,
    private readonly queueMapping: Record<string, string>,
    private readonly defaultQueue?: string
  ) {}
  
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null {
    const headerValue = message.headers[this.headerName];
    
    if (!headerValue) {
      return this.defaultQueue || null;
    }
    
    const mappedQueue = this.queueMapping[headerValue];
    
    if (!mappedQueue) {
      return this.defaultQueue || null;
    }
    
    // Check if queue is available
    if (availableQueues.includes(mappedQueue)) {
      return mappedQueue;
    }
    
    return this.defaultQueue || null;
  }
}

export class PayloadRoutingStrategy implements RoutingStrategy {
  name = 'payload';
  priority = 90;
  continueOnNull = true;
  
  constructor(
    private readonly propertyPath: string,
    private readonly queueMapping: Record<string, string>,
    private readonly defaultQueue?: string
  ) {}
  
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null {
    const payload = message.payload as any;
    const value = this.getNestedProperty(payload, this.propertyPath);
    
    if (value === undefined || value === null) {
      return this.defaultQueue || null;
    }
    
    const mappedQueue = this.queueMapping[String(value)];
    
    if (!mappedQueue) {
      return this.defaultQueue || null;
    }
    
    // Check if queue is available
    if (availableQueues.includes(mappedQueue)) {
      return mappedQueue;
    }
    
    return this.defaultQueue || null;
  }
  
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export class PriorityRoutingStrategy implements RoutingStrategy {
  name = 'priority';
  priority = 80;
  continueOnNull = false;
  
  constructor(
    private readonly queuePriorities: Record<string, number>,
    private readonly defaultQueue?: string
  ) {}
  
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null {
    const messagePriority = message.priority || 0;
    
    // Find queues with sufficient priority
    const candidateQueues = availableQueues.filter(queue => 
      (this.queuePriorities[queue] || 0) >= messagePriority
    );
    
    if (candidateQueues.length === 0) {
      return this.defaultQueue || null;
    }
    
    // Select queue with highest priority that meets requirement
    candidateQueues.sort((a, b) => 
      (this.queuePriorities[b] || 0) - (this.queuePriorities[a] || 0)
    );
    
    return candidateQueues[0];
  }
}

export class RoundRobinRoutingStrategy implements RoutingStrategy {
  name = 'round-robin';
  priority = 70;
  continueOnNull = false;
  
  private currentIndex = 0;
  
  constructor(private readonly queues: string[]) {}
  
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null {
    const validQueues = this.queues.filter(q => availableQueues.includes(q));
    
    if (validQueues.length === 0) {
      return null;
    }
    
    const selected = validQueues[this.currentIndex % validQueues.length];
    this.currentIndex++;
    
    return selected;
  }
}

export class LeastLoadedRoutingStrategy implements RoutingStrategy {
  name = 'least-loaded';
  priority = 60;
  continueOnNull = false;
  
  constructor(private readonly adapter: QueueAdapter) {}
  
  async selectQueue(message: MessageEnvelope, availableQueues: string[]): Promise<string | null> {
    let leastLoadedQueue: string | null = null;
    let minMessageCount = Infinity;
    
    for (const queue of availableQueues) {
      try {
        const stats = await this.adapter.getQueueStats(queue);
        
        if (stats.messageCount < minMessageCount) {
          minMessageCount = stats.messageCount;
          leastLoadedQueue = queue;
        }
      } catch (error) {
        // Skip queue if stats can't be retrieved
        continue;
      }
    }
    
    return leastLoadedQueue;
  }
}

export class HashRoutingStrategy implements RoutingStrategy {
  name = 'hash';
  priority = 50;
  continueOnNull = false;
  
  constructor(
    private readonly queues: string[],
    private readonly hashKey?: string
  ) {}
  
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null {
    const validQueues = this.queues.filter(q => availableQueues.includes(q));
    
    if (validQueues.length === 0) {
      return null;
    }
    
    // Calculate hash
    const hashInput = this.hashKey 
      ? message.headers[this.hashKey] || message.partitionKey || message.id
      : message.partitionKey || message.id;
    
    const hash = this.simpleHash(String(hashInput));
    const index = hash % validQueues.length;
    
    return validQueues[index];
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// ROUTING BUILDER
// ============================================================================

export class RoutingBuilder {
  private strategies: RoutingStrategy[] = [];
  
  constructor(private readonly adapter: QueueAdapter) {}
  
  /**
   * Add header-based routing
   */
  byHeader(
    headerName: string,
    mapping: Record<string, string>,
    defaultQueue?: string
  ): RoutingBuilder {
    this.strategies.push(
      new HeaderRoutingStrategy(headerName, mapping, defaultQueue)
    );
    return this;
  }
  
  /**
   * Add payload-based routing
   */
  byPayload(
    propertyPath: string,
    mapping: Record<string, string>,
    defaultQueue?: string
  ): RoutingBuilder {
    this.strategies.push(
      new PayloadRoutingStrategy(propertyPath, mapping, defaultQueue)
    );
    return this;
  }
  
  /**
   * Add priority-based routing
   */
  byPriority(
    queuePriorities: Record<string, number>,
    defaultQueue?: string
  ): RoutingBuilder {
    this.strategies.push(
      new PriorityRoutingStrategy(queuePriorities, defaultQueue)
    );
    return this;
  }
  
  /**
   * Add round-robin routing
   */
  roundRobin(queues: string[]): RoutingBuilder {
    this.strategies.push(new RoundRobinRoutingStrategy(queues));
    return this;
  }
  
  /**
   * Add least-loaded routing
   */
  leastLoaded(): RoutingBuilder {
    this.strategies.push(new LeastLoadedRoutingStrategy(this.adapter));
    return this;
  }
  
  /**
   * Add hash-based routing
   */
  byHash(queues: string[], hashKey?: string): RoutingBuilder {
    this.strategies.push(new HashRoutingStrategy(queues, hashKey));
    return this;
  }
  
  /**
   * Add custom strategy
   */
  custom(strategy: RoutingStrategy): RoutingBuilder {
    this.strategies.push(strategy);
    return this;
  }
  
  /**
   * Build the routing pattern
   */
  build(): RoutingPattern {
    const pattern = new RoutingPattern(this.adapter);
    
    for (const strategy of this.strategies) {
      pattern.registerStrategy(strategy);
    }
    
    return pattern;
  }
}
