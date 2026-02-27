/**
 * Backpressure Controller Implementation
 */

import type { Queue } from '../types.js';
import type { 
  BackpressureController,
  BackpressureStrategy,
  BackpressureAction,
  BackpressureOptions,
  BackpressureResult,
  BackpressureMetrics,
  BackpressureState,
  BackpressureEvent
} from './types.js';
import { BackpressureError } from '../errors.js';

export class BackpressureController implements BackpressureController {
  private strategies: Map<string, { strategy: BackpressureStrategy; threshold: number; options?: BackpressureOptions }> = new Map();
  private activeStates: Map<string, BackpressureState> = new Map();
  private eventListeners: Map<BackpressureEvent, Function[]> = new Map();
  private metrics: BackpressureMetrics = {
    activeControllers: new Map(),
    totalBlocked: 0,
    totalRejected: 0,
    totalThrottled: 0,
    totalRedirected: 0,
    averageResponseTime: 0,
  };
  private responseTimes: number[] = [];

  configure(strategy: BackpressureStrategy, threshold: number, options?: BackpressureOptions): void {
    this.strategies.set(strategy.name, { strategy, threshold, options });
  }

  async check(queue: Queue): Promise<BackpressureResult> {
    const result: BackpressureResult = {
      shouldApply: false,
      action: 'reject',
      reason: '',
      metrics: {
        queueSize: queue.size,
        processingRate: 0,
        arrivalRate: 0,
        utilization: queue.size > 0 ? (queue.processing / queue.size) * 100 : 0,
      },
    };

    for (const [name, config] of this.strategies) {
      if (config.strategy.shouldTrigger(queue)) {
        result.shouldApply = true;
        result.action = await config.strategy.apply(queue, config.options);
        result.reason = `${name} strategy triggered: ${this.getReason(queue, config)}`;
        break;
      }
    }

    return result;
  }

  async apply(queue: Queue): Promise<void> {
    const result = await this.check(queue);
    
    if (!result.shouldApply) {
      return;
    }

    const existingState = this.activeStates.get(queue.id);
    if (existingState) {
      return; // Already applied
    }

    // Find the strategy that triggered
    let triggeredStrategy: { strategy: BackpressureStrategy; threshold: number; options?: BackpressureOptions } | undefined;
    for (const config of this.strategies.values()) {
      if (config.strategy.shouldTrigger(queue)) {
        triggeredStrategy = config;
        break;
      }
    }

    if (!triggeredStrategy) {
      return;
    }

    const state: BackpressureState = {
      queueId: queue.id,
      strategy: triggeredStrategy.strategy.name,
      action: result.action,
      appliedAt: new Date(),
      metrics: {
        blockedJobs: 0,
        rejectedJobs: 0,
        throttledJobs: 0,
        redirectedJobs: 0,
      },
    };

    this.activeStates.set(queue.id, state);
    this.metrics.activeControllers.set(queue.id, state);
    this.emit('backpressure:applied', queue, state);

    // Apply the specific action
    switch (result.action) {
      case 'reject':
        // Reject is handled at enqueue time
        break;
      case 'block':
        await this.applyBlocking(queue, triggeredStrategy.options);
        break;
      case 'throttle':
        await this.applyThrottling(queue, triggeredStrategy.options);
        break;
      case 'redirect':
        await this.applyRedirect(queue, triggeredStrategy.options);
        break;
      case 'dead_letter':
        await this.applyDeadLetter(queue, triggeredStrategy.options);
        break;
    }
  }

  async release(queue: Queue): Promise<void> {
    const state = this.activeStates.get(queue.id);
    if (!state) {
      return; // No backpressure active
    }

    const config = this.strategies.get(state.strategy);
    if (config) {
      await config.strategy.release(queue);
    }

    this.activeStates.delete(queue.id);
    this.metrics.activeControllers.delete(queue.id);
    this.emit('backpressure:released', queue, state);
  }

  isActive(queueId: string): boolean {
    return this.activeStates.has(queueId);
  }

  getMetrics(): BackpressureMetrics {
    // Update totals
    let totalBlocked = 0;
    let totalRejected = 0;
    let totalThrottled = 0;
    let totalRedirected = 0;

    for (const state of this.activeStates.values()) {
      totalBlocked += state.metrics.blockedJobs;
      totalRejected += state.metrics.rejectedJobs;
      totalThrottled += state.metrics.throttledJobs;
      totalRedirected += state.metrics.redirectedJobs;
    }

    this.metrics.totalBlocked = totalBlocked;
    this.metrics.totalRejected = totalRejected;
    this.metrics.totalThrottled = totalThrottled;
    this.metrics.totalRedirected = totalRedirected;

    // Calculate average response time
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
      this.metrics.averageResponseTime = sum / this.responseTimes.length;
    }

    return { ...this.metrics };
  }

  // Event handling
  on(event: BackpressureEvent, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: BackpressureEvent, listener: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Handle enqueue attempts
  async handleEnqueue(queue: Queue): Promise<void> {
    const state = this.activeStates.get(queue.id);
    if (!state) {
      return;
    }

    switch (state.action) {
      case 'reject':
        state.metrics.rejectedJobs++;
        this.emit('backpressure:rejected', queue);
        throw new BackpressureError(queue.id, 'Queue is rejecting new jobs due to backpressure');
      
      case 'block':
        state.metrics.blockedJobs++;
        this.emit('backpressure:blocked', queue);
        await this.blockEnqueue(queue);
        break;
      
      case 'throttle':
        state.metrics.throttledJobs++;
        this.emit('backpressure:throttled', queue);
        await this.throttleEnqueue(queue);
        break;
      
      case 'redirect':
        state.metrics.redirectedJobs++;
        this.emit('backpressure:redirected', queue);
        await this.redirectEnqueue(queue);
        break;
      
      case 'dead_letter':
        // Handled by the queue implementation
        break;
    }
  }

  // Record response time for metrics
  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  private emit(event: BackpressureEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in backpressure event listener for ${event}:`, error);
        }
      });
    }
  }

  private getReason(queue: Queue, config: { strategy: BackpressureStrategy; threshold: number }): string {
    switch (config.strategy.name) {
      case 'size-based':
        return `Queue size ${queue.size} exceeds threshold ${config.threshold}`;
      case 'utilization-based':
        const utilization = queue.size > 0 ? (queue.processing / queue.size) * 100 : 0;
        return `Utilization ${utilization.toFixed(2)}% exceeds threshold ${config.threshold}%`;
      case 'rate-based':
        return `Arrival rate exceeds processing rate by factor ${config.threshold}`;
      case 'latency-based':
        return `Processing latency exceeds threshold ${config.threshold}ms`;
      default:
        return 'Threshold exceeded';
    }
  }

  private async applyBlocking(queue: Queue, options?: BackpressureOptions): Promise<void> {
    // Blocking is handled at enqueue time
    // This is a placeholder for any setup needed
  }

  private async applyThrottling(queue: Queue, options?: BackpressureOptions): Promise<void> {
    // Throttling is handled at enqueue time
    // This is a placeholder for any setup needed
  }

  private async applyRedirect(queue: Queue, options?: BackpressureOptions): Promise<void> {
    // Redirect is handled at enqueue time
    // This is a placeholder for any setup needed
  }

  private async applyDeadLetter(queue: Queue, options?: BackpressureOptions): Promise<void> {
    // Dead letter is handled at enqueue time
    // This is a placeholder for any setup needed
  }

  private async blockEnqueue(queue: Queue): Promise<void> {
    // Block until backpressure is released
    const checkInterval = 100;
    const maxWait = 30000; // 30 seconds max
    const startTime = Date.now();

    while (this.isActive(queue.id) && Date.now() - startTime < maxWait) {
      await this.sleep(checkInterval);
    }

    if (this.isActive(queue.id)) {
      throw new BackpressureError(queue.id, 'Backpressure block timeout');
    }
  }

  private async throttleEnqueue(queue: Queue): Promise<void> {
    // Simple delay for throttling
    const delay = 100; // 100ms delay
    await this.sleep(delay);
  }

  private async redirectEnqueue(queue: Queue): Promise<void> {
    // Redirect logic would be implemented by the queue
    // This is a placeholder
    throw new BackpressureError(queue.id, 'Job redirection not implemented');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
