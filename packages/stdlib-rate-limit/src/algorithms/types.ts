/**
 * Types and interfaces for rate limiting algorithms
 */

import { RateLimitConfig, BucketState, CheckResult, Clock, RateLimitAction } from '../types';

// ============================================================================
// ALGORITHM STATE INTERFACES
// ============================================================================

export interface AlgorithmState {
  key: string;
  configName: string;
  lastUpdated: Date;
  [key: string]: any;
}

export interface TokenBucketState extends AlgorithmState {
  tokens: number;
  lastRefill: Date;
}

export interface SlidingWindowState extends AlgorithmState {
  requests: Array<{
    timestamp: Date;
    weight: number;
  }>;
}

export interface FixedWindowState extends AlgorithmState {
  count: number;
  windowStart: Date;
}

export interface LeakyBucketState extends AlgorithmState {
  currentVolume: number;
  lastLeak: Date;
}

// ============================================================================
// ALGORITHM CONFIGURATION
// ============================================================================

export interface TokenBucketConfig {
  bucketSize: number;
  refillRate: number;
  refillIntervalMs: number;
}

export interface SlidingWindowConfig {
  windowSizeMs: number;
  maxRequests: number;
}

export interface FixedWindowConfig {
  windowSizeMs: number;
  maxRequests: number;
}

export interface LeakyBucketConfig {
  capacity: number;
  leakRate: number;
  leakIntervalMs: number;
}

// ============================================================================
// ALGORITHM INPUT/OUTPUT
// ============================================================================

export interface AlgorithmInput {
  key: string;
  weight: number;
  timestamp: Date;
  config: RateLimitConfig;
  currentState?: AlgorithmState;
}

export interface AlgorithmOutput {
  allowed: boolean;
  action: RateLimitAction;
  newState: AlgorithmState;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// ALGORITHM INTERFACE
// ============================================================================

export interface RateLimitAlgorithm<TState extends AlgorithmState = AlgorithmState> {
  /**
   * The type/name of the algorithm
   */
  readonly type: string;
  
  /**
   * Initialize state for a new key
   */
  initializeState(input: AlgorithmInput): TState;
  
  /**
   * Check if a request should be allowed
   */
  check(input: AlgorithmInput): AlgorithmOutput;
  
  /**
   * Reset the state for a key
   */
  resetState(key: string, config: RateLimitConfig): TState;
  
  /**
   * Get the default configuration for the algorithm
   */
  getDefaultConfig(): Record<string, any>;
  
  /**
   * Validate configuration parameters
   */
  validateConfig(config: RateLimitConfig): void;
}

// ============================================================================
// ALGORITHM FACTORY
// ============================================================================

export interface AlgorithmFactory {
  create(config: RateLimitConfig, clock: Clock): RateLimitAlgorithm;
  getSupportedTypes(): string[];
  register(type: string, constructor: new (config: RateLimitConfig, clock: Clock) => RateLimitAlgorithm): void;
}

// ============================================================================
// ALGORITHM REGISTRY
// ============================================================================

export interface AlgorithmRegistry {
  register(type: string, algorithm: RateLimitAlgorithm): void;
  get(type: string): RateLimitAlgorithm | undefined;
  has(type: string): boolean;
  list(): string[];
}

// ============================================================================
// ALGORITHM UTILITIES
// ============================================================================

export interface AlgorithmMetrics {
  totalChecks: number;
  allowedRequests: number;
  deniedRequests: number;
  averageCheckTime: number;
  lastCheckTime: Date;
}

export interface AlgorithmDebugInfo {
  type: string;
  key: string;
  state: AlgorithmState;
  input: AlgorithmInput;
  output: AlgorithmOutput;
  timestamp: Date;
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

export interface MathUtils {
  /**
   * Calculate tokens to add based on elapsed time
   */
  calculateRefill(
    lastRefill: Date,
    currentTime: Date,
    refillRate: number,
    refillIntervalMs: number,
    maxTokens: number
  ): number;
  
  /**
   * Calculate leak amount based on elapsed time
   */
  calculateLeak(
    lastLeak: Date,
    currentTime: Date,
    leakRate: number,
    leakIntervalMs: number,
    currentVolume: number
  ): number;
  
  /**
   * Calculate sliding window request count
   */
  calculateSlidingWindowCount(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date,
    windowEnd: Date
  ): number;
  
  /**
   * Prune old requests from sliding window
   */
  pruneSlidingWindow(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date
  ): Array<{ timestamp: Date; weight: number }>;
}

// ============================================================================
// ALGORITHM OPTIONS
// ============================================================================

export interface AlgorithmOptions {
  /**
   * Enable debug mode for detailed logging
   */
  debug?: boolean;
  
  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;
  
  /**
   * Maximum number of requests to track in sliding window
   */
  maxTrackedRequests?: number;
  
  /**
   * Precision for time calculations (milliseconds)
   */
  timePrecision?: number;
  
  /**
   * Custom clock implementation (for testing)
   */
  clock?: Clock;
}
