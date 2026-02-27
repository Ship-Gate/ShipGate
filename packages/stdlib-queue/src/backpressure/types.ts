/**
 * Backpressure-specific types
 */

import type { Queue, QueueStatus } from '../types.js';

export interface BackpressureController {
  // Configuration
  configure(strategy: BackpressureStrategy, threshold: number, options?: BackpressureOptions): void;
  
  // Control
  check(queue: Queue): BackpressureResult;
  apply(queue: Queue): Promise<void>;
  release(queue: Queue): Promise<void>;
  
  // Status
  isActive(queueId: string): boolean;
  getMetrics(): BackpressureMetrics;
  
  // Events
  on(event: BackpressureEvent, listener: (...args: any[]) => void): void;
  off(event: BackpressureEvent, listener: (...args: any[]) => void): void;
}

export interface BackpressureStrategy {
  name: string;
  description?: string;
  
  // Check if backpressure should be applied
  shouldTrigger(queue: Queue): boolean;
  
  // Apply backpressure
  apply(queue: Queue, options?: BackpressureOptions): Promise<BackpressureAction>;
  
  // Release backpressure
  release(queue: Queue): Promise<void>;
  
  // Check if backpressure can be released
  shouldRelease(queue: Queue): boolean;
}

export type BackpressureAction = 
  | 'reject'
  | 'block'
  | 'throttle'
  | 'redirect'
  | 'dead_letter';

export interface BackpressureOptions {
  timeout?: number;
  retryDelay?: number;
  maxRetries?: number;
  redirectQueue?: string;
  deadLetterQueue?: string;
  throttleRate?: number;
  blockTimeout?: number;
}

export interface BackpressureResult {
  shouldApply: boolean;
  action: BackpressureAction;
  reason: string;
  metrics: {
    queueSize: number;
    processingRate: number;
    arrivalRate: number;
    utilization: number;
  };
}

export interface BackpressureMetrics {
  activeControllers: Map<string, BackpressureState>;
  totalBlocked: number;
  totalRejected: number;
  totalThrottled: number;
  totalRedirected: number;
  averageResponseTime: number;
}

export interface BackpressureState {
  queueId: string;
  strategy: string;
  action: BackpressureAction;
  appliedAt: Date;
  metrics: {
    blockedJobs: number;
    rejectedJobs: number;
    throttledJobs: number;
    redirectedJobs: number;
  };
}

export type BackpressureEvent = 
  | 'backpressure:applied'
  | 'backpressure:released'
  | 'backpressure:rejected'
  | 'backpressure:blocked'
  | 'backpressure:throttled'
  | 'backpressure:redirected'
  | 'error';

export interface BackpressureConfig {
  strategy: BackpressureStrategy;
  threshold: number;
  options?: BackpressureOptions;
  autoRelease?: boolean;
  releaseThreshold?: number;
}

export interface ThrottleConfig {
  rate: number; // jobs per second
  burst: number;
  window: number; // in milliseconds
}

export interface BlockConfig {
  timeout?: number;
  maxSize?: number;
  fullStrategy?: 'reject' | 'drop';
}

export interface RedirectConfig {
  targetQueue: string;
  maxRedirects?: number;
}

export interface DeadLetterConfig {
  queue: string;
  reason: string;
  includeMetadata?: boolean;
}
