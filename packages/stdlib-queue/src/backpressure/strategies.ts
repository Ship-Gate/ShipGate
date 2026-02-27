/**
 * Backpressure Strategy Implementations
 */

import type { Queue, QueueStatus } from '../types.js';
import type { 
  BackpressureStrategy, 
  BackpressureAction, 
  BackpressureOptions,
  ThrottleConfig,
  BlockConfig,
  RedirectConfig,
  DeadLetterConfig 
} from './types.js';
import { BackpressureError } from '../errors.js';

/**
 * Size-based backpressure strategy
 * Triggers when queue size exceeds threshold
 */
export class SizeBasedStrategy implements BackpressureStrategy {
  name = 'size-based';
  description = 'Triggers backpressure when queue size exceeds threshold';

  constructor(private threshold: number) {}

  shouldTrigger(queue: Queue): boolean {
    return queue.size > this.threshold;
  }

  async apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction> {
    // Default to reject for size-based strategy
    return 'reject';
  }

  async release(queue: Queue): Promise<void> {
    // No special release logic needed
  }

  shouldRelease(queue: Queue): boolean {
    return queue.size <= this.threshold * 0.8; // Release at 80% of threshold
  }
}

/**
 * Utilization-based backpressure strategy
 * Triggers when queue utilization (processing/total) is too high
 */
export class UtilizationBasedStrategy implements BackpressureStrategy {
  name = 'utilization-based';
  description = 'Triggers backpressure when queue utilization is too high';

  constructor(private threshold: number) {} // threshold as percentage (0-100)

  shouldTrigger(queue: Queue): boolean {
    if (queue.size === 0) return false;
    
    const utilization = (queue.processing / queue.size) * 100;
    return utilization > this.threshold;
  }

  async apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction> {
    // Default to blocking for high utilization
    return 'block';
  }

  async release(queue: Queue): Promise<void> {
    // No special release logic needed
  }

  shouldRelease(queue: Queue): boolean {
    if (queue.size === 0) return true;
    
    const utilization = (queue.processing / queue.size) * 100;
    return utilization <= this.threshold * 0.8;
  }
}

/**
 * Rate-based backpressure strategy
 * Triggers when job arrival rate exceeds processing rate
 */
export class RateBasedStrategy implements BackpressureStrategy {
  name = 'rate-based';
  description = 'Triggers backpressure when arrival rate exceeds processing rate';
  
  private arrivalRates: Map<string, number[]> = new Map();
  private processingRates: Map<string, number[]> = new Map();
  private windowSize = 60000; // 1 minute window

  constructor(private threshold: number) {} // threshold as ratio (arrival/processing)

  shouldTrigger(queue: Queue): boolean {
    const arrivalRate = this.getArrivalRate(queue.id);
    const processingRate = this.getProcessingRate(queue.id);
    
    if (processingRate === 0) return arrivalRate > 0;
    
    return (arrivalRate / processingRate) > this.threshold;
  }

  async apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction> {
    // Default to throttling for rate-based strategy
    return 'throttle';
  }

  async release(queue: Queue): Promise<void> {
    // Clear rate history
    this.arrivalRates.delete(queue.id);
    this.processingRates.delete(queue.id);
  }

  shouldRelease(queue: Queue): boolean {
    const arrivalRate = this.getArrivalRate(queue.id);
    const processingRate = this.getProcessingRate(queue.id);
    
    if (processingRate === 0) return arrivalRate === 0;
    
    return (arrivalRate / processingRate) <= this.threshold * 0.8;
  }

  recordArrival(queueId: string): void {
    const now = Date.now();
    const rates = this.arrivalRates.get(queueId) || [];
    rates.push(now);
    
    // Keep only recent arrivals
    const cutoff = now - this.windowSize;
    for (let i = 0; i < rates.length; i++) {
      if (rates[i] > cutoff) {
        this.arrivalRates.set(queueId, rates.slice(i));
        break;
      }
    }
  }

  recordProcessing(queueId: string): void {
    const now = Date.now();
    const rates = this.processingRates.get(queueId) || [];
    rates.push(now);
    
    // Keep only recent processing
    const cutoff = now - this.windowSize;
    for (let i = 0; i < rates.length; i++) {
      if (rates[i] > cutoff) {
        this.processingRates.set(queueId, rates.slice(i));
        break;
      }
    }
  }

  private getArrivalRate(queueId: string): number {
    const rates = this.arrivalRates.get(queueId) || [];
    return rates.length / (this.windowSize / 1000); // per second
  }

  private getProcessingRate(queueId: string): number {
    const rates = this.processingRates.get(queueId) || [];
    return rates.length / (this.windowSize / 1000); // per second
  }
}

/**
 * Latency-based backpressure strategy
 * Triggers when job processing latency exceeds threshold
 */
export class LatencyBasedStrategy implements BackpressureStrategy {
  name = 'latency-based';
  description = 'Triggers backpressure when processing latency is too high';
  
  private latencies: Map<string, number[]> = new Map();
  private maxSamples = 100;

  constructor(private threshold: number) {} // threshold in milliseconds

  shouldTrigger(queue: Queue): boolean {
    const avgLatency = this.getAverageLatency(queue.id);
    return avgLatency > this.threshold;
  }

  async apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction> {
    // Default to rejecting for high latency
    return 'reject';
  }

  async release(queue: Queue): Promise<void> {
    // Clear latency history
    this.latencies.delete(queue.id);
  }

  shouldRelease(queue: Queue): boolean {
    const avgLatency = this.getAverageLatency(queue.id);
    return avgLatency <= this.threshold * 0.8;
  }

  recordLatency(queueId: string, latency: number): void {
    const latencies = this.latencies.get(queueId) || [];
    latencies.push(latency);
    
    // Keep only recent samples
    if (latencies.length > this.maxSamples) {
      latencies.shift();
    }
    
    this.latencies.set(queueId, latencies);
  }

  private getAverageLatency(queueId: string): number {
    const latencies = this.latencies.get(queueId) || [];
    if (latencies.length === 0) return 0;
    
    const sum = latencies.reduce((acc, lat) => acc + lat, 0);
    return sum / latencies.length;
  }
}

/**
 * Composite strategy that combines multiple strategies
 */
export class CompositeStrategy implements BackpressureStrategy {
  name = 'composite';
  description = 'Combines multiple backpressure strategies';

  constructor(private strategies: BackpressureStrategy[]) {}

  shouldTrigger(queue: Queue): boolean {
    return this.strategies.some(strategy => strategy.shouldTrigger(queue));
  }

  async apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction> {
    // Use the first triggered strategy's action
    for (const strategy of this.strategies) {
      if (strategy.shouldTrigger(queue)) {
        return strategy.apply(queue, options);
      }
    }
    return 'reject';
  }

  async release(queue: Queue): Promise<void> {
    await Promise.all(
      this.strategies.map(strategy => strategy.release(queue))
    );
  }

  shouldRelease(queue: Queue): boolean {
    return this.strategies.every(strategy => strategy.shouldRelease(queue));
  }
}

/**
 * Adaptive strategy that adjusts threshold based on historical data
 */
export class AdaptiveStrategy implements BackpressureStrategy {
  name = 'adaptive';
  description = 'Adapts threshold based on historical performance';
  
  private history: Map<string, number[]> = new Map();
  private currentThreshold: Map<string, number> = new Map();
  private maxHistory = 1000;
  private adjustmentFactor = 0.1;

  constructor(private baseThreshold: number) {}

  shouldTrigger(queue: Queue): boolean {
    const threshold = this.getThreshold(queue.id);
    return queue.size > threshold;
  }

  async apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction> {
    // Adjust threshold based on current conditions
    this.adjustThreshold(queue.id, queue.size);
    return 'block';
  }

  async release(queue: Queue): Promise<void> {
    // Gradually increase threshold when backpressure is released
    const current = this.getThreshold(queue.id);
    this.currentThreshold.set(queue.id, Math.min(current * 1.1, this.baseThreshold * 2));
  }

  shouldRelease(queue: Queue): boolean {
    const threshold = this.getThreshold(queue.id);
    return queue.size <= threshold * 0.8;
  }

  private getThreshold(queueId: string): number {
    return this.currentThreshold.get(queueId) || this.baseThreshold;
  }

  private adjustThreshold(queueId: string, currentSize: number): void {
    const history = this.history.get(queueId) || [];
    history.push(currentSize);
    
    if (history.length > this.maxHistory) {
      history.shift();
    }
    
    this.history.set(queueId, history);
    
    // Calculate new threshold based on history
    const avgSize = history.reduce((acc, size) => acc + size, 0) / history.length;
    const newThreshold = avgSize * (1 + this.adjustmentFactor);
    
    this.currentThreshold.set(queueId, Math.max(newThreshold, this.baseThreshold * 0.5));
  }
}
