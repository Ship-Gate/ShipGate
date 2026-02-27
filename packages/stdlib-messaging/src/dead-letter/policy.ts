/**
 * Dead letter policy implementation
 */

import type { MessageEnvelope } from '../types.js';
import type { DeadLetterPolicy, BackoffPolicy, BackoffType } from './types.js';

// ============================================================================
// BACKOFF CALCULATOR
// ============================================================================

export class BackoffCalculator {
  /**
   * Calculate delay for a given attempt
   */
  static calculateDelay(
    policy: BackoffPolicy,
    attempt: number
  ): number {
    let delay: number;
    
    switch (policy.type) {
      case BackoffType.LINEAR:
        delay = policy.initialDelay + (attempt * (policy.multiplier || 1000));
        break;
        
      case BackoffType.EXPONENTIAL:
        delay = policy.initialDelay * Math.pow(policy.multiplier || 2, attempt);
        break;
        
      case BackoffType.FIXED:
        delay = policy.initialDelay;
        break;
        
      default:
        delay = policy.initialDelay;
    }
    
    // Apply maximum delay
    delay = Math.min(delay, policy.maxDelay);
    
    // Apply jitter if configured
    if (policy.jitter && policy.jitter > 0) {
      const jitterRange = delay * policy.jitter;
      delay = delay - (jitterRange / 2) + (Math.random() * jitterRange);
    }
    
    // Ensure non-negative
    return Math.max(0, Math.floor(delay));
  }
  
  /**
   * Check if should retry based on policy
   */
  static shouldRetry(
    policy: BackoffPolicy,
    attempt: number
  ): boolean {
    if (policy.maxAttempts !== undefined) {
      return attempt < policy.maxAttempts;
    }
    return true;
  }
}

// ============================================================================
// DEFAULT DEAD LETTER POLICIES
// ============================================================================

export const DefaultDeadLetterPolicies = {
  /**
   * Exponential backoff with jitter
   */
  exponentialBackoff: (overrides: Partial<DeadLetterPolicy> = {}): DeadLetterPolicy => ({
    maxRetries: 10,
    backoffPolicy: {
      type: BackoffType.EXPONENTIAL,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: 0.1,
    },
    deadLetterQueue: 'dead-letter',
    preserveHeaders: true,
    ...overrides,
  }),
  
  /**
   * Linear backoff
   */
  linearBackoff: (overrides: Partial<DeadLetterPolicy> = {}): DeadLetterPolicy => ({
    maxRetries: 5,
    backoffPolicy: {
      type: BackoffType.LINEAR,
      initialDelay: 5000,
      maxDelay: 60000,
      multiplier: 5000,
      jitter: 0.05,
    },
    deadLetterQueue: 'dead-letter',
    preserveHeaders: true,
    ...overrides,
  }),
  
  /**
   * Fixed delay
   */
  fixedDelay: (overrides: Partial<DeadLetterPolicy> = {}): DeadLetterPolicy => ({
    maxRetries: 3,
    backoffPolicy: {
      type: BackoffType.FIXED,
      initialDelay: 10000,
      maxDelay: 10000,
    },
    deadLetterQueue: 'dead-letter',
    preserveHeaders: true,
    ...overrides,
  }),
  
  /**
   * No retry - immediate dead letter
   */
  noRetry: (overrides: Partial<DeadLetterPolicy> = {}): DeadLetterPolicy => ({
    maxRetries: 0,
    backoffPolicy: {
      type: BackoffType.FIXED,
      initialDelay: 0,
      maxDelay: 0,
    },
    deadLetterQueue: 'dead-letter',
    preserveHeaders: true,
    ...overrides,
  }),
};

// ============================================================================
// DEAD LETTER POLICY BUILDER
// ============================================================================

export class DeadLetterPolicyBuilder {
  private policy: Partial<DeadLetterPolicy> = {
    preserveHeaders: true,
  };
  
  maxRetries(count: number): DeadLetterPolicyBuilder {
    this.policy.maxRetries = count;
    return this;
  }
  
  deadLetterQueue(name: string): DeadLetterPolicyBuilder {
    this.policy.deadLetterQueue = name;
    return this;
  }
  
  exponentialBackoff(config: {
    initialDelay?: number;
    maxDelay?: number;
    multiplier?: number;
    jitter?: number;
  }): DeadLetterPolicyBuilder {
    this.policy.backoffPolicy = {
      type: BackoffType.EXPONENTIAL,
      initialDelay: config.initialDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      multiplier: config.multiplier || 2,
      jitter: config.jitter || 0.1,
    };
    return this;
  }
  
  linearBackoff(config: {
    initialDelay?: number;
    maxDelay?: number;
    step?: number;
    jitter?: number;
  }): DeadLetterPolicyBuilder {
    this.policy.backoffPolicy = {
      type: BackoffType.LINEAR,
      initialDelay: config.initialDelay || 5000,
      maxDelay: config.maxDelay || 60000,
      multiplier: config.step || 5000,
      jitter: config.jitter || 0.05,
    };
    return this;
  }
  
  fixedDelay(delay: number): DeadLetterPolicyBuilder {
    this.policy.backoffPolicy = {
      type: BackoffType.FIXED,
      initialDelay: delay,
      maxDelay: delay,
    };
    return this;
  }
  
  preserveHeaders(preserve: boolean): DeadLetterPolicyBuilder {
    this.policy.preserveHeaders = preserve;
    return this;
  }
  
  addMetadata(metadata: Record<string, string>): DeadLetterPolicyBuilder {
    this.policy.additionalMetadata = {
      ...this.policy.additionalMetadata,
      ...metadata,
    };
    return this;
  }
  
  build(): DeadLetterPolicy {
    if (!this.policy.deadLetterQueue) {
      throw new Error('Dead letter queue name is required');
    }
    
    if (!this.policy.backoffPolicy) {
      this.policy.backoffPolicy = {
        type: BackoffType.EXPONENTIAL,
        initialDelay: 1000,
        maxDelay: 30000,
        multiplier: 2,
        jitter: 0.1,
      };
    }
    
    if (this.policy.maxRetries === undefined) {
      this.policy.maxRetries = 10;
    }
    
    return this.policy as DeadLetterPolicy;
  }
}

// ============================================================================
// POLICY VALIDATOR
// ============================================================================

export class DeadLetterPolicyValidator {
  /**
   * Validate a dead letter policy
   */
  static validate(policy: DeadLetterPolicy): void {
    // Validate max retries
    if (policy.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }
    
    // Validate dead letter queue
    if (!policy.deadLetterQueue || policy.deadLetterQueue.trim() === '') {
      throw new Error('deadLetterQueue is required');
    }
    
    // Validate backoff policy
    this.validateBackoffPolicy(policy.backoffPolicy);
  }
  
  /**
   * Validate a backoff policy
   */
  private static validateBackoffPolicy(policy: BackoffPolicy): void {
    // Validate initial delay
    if (policy.initialDelay < 0) {
      throw new Error('initialDelay must be non-negative');
    }
    
    // Validate max delay
    if (policy.maxDelay < 0) {
      throw new Error('maxDelay must be non-negative');
    }
    
    // Validate max delay is not less than initial delay
    if (policy.maxDelay < policy.initialDelay) {
      throw new Error('maxDelay must be greater than or equal to initialDelay');
    }
    
    // Validate multiplier
    if (policy.multiplier !== undefined && policy.multiplier <= 0) {
      throw new Error('multiplier must be positive');
    }
    
    // Validate jitter
    if (policy.jitter !== undefined && (policy.jitter < 0 || policy.jitter > 1)) {
      throw new Error('jitter must be between 0 and 1');
    }
    
    // Validate max attempts
    if (policy.maxAttempts !== undefined && policy.maxAttempts < 0) {
      throw new Error('maxAttempts must be non-negative');
    }
  }
}
