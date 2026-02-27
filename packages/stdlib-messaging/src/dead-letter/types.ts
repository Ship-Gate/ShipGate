/**
 * Dead letter queue types
 */

import type { MessageEnvelope } from '../types.js';
import type { QueueAdapter } from '../queue/types.js';

// ============================================================================
// DEAD LETTER HANDLER INTERFACE
// ============================================================================

export interface DeadLetterHandler {
  /**
   * Handle a dead-lettered message
   */
  handle(message: MessageEnvelope, reason: string, retries: number): Promise<void>;
  
  /**
   * Handler name
   */
  readonly name: string;
}

// ============================================================================
// DEAD LETTER POLICY
// ============================================================================

export interface DeadLetterPolicy {
  /**
   * Maximum number of retry attempts before dead-lettering
   */
  maxRetries: number;
  
  /**
   * Backoff policy for retries
   */
  backoffPolicy: BackoffPolicy;
  
  /**
   * Dead letter queue name
   */
  deadLetterQueue: string;
  
  /**
   * Custom dead letter handler
   */
  handler?: DeadLetterHandler;
  
  /**
   * Whether to include original message headers
   */
  preserveHeaders: boolean;
  
  /**
   * Additional metadata to add to dead-lettered messages
   */
  additionalMetadata?: Record<string, string>;
}

// ============================================================================
// BACKOFF POLICY
// ============================================================================

export interface BackoffPolicy {
  /**
   * Type of backoff strategy
   */
  type: BackoffType;
  
  /**
   * Initial delay in milliseconds
   */
  initialDelay: number;
  
  /**
   * Maximum delay in milliseconds
   */
  maxDelay: number;
  
  /**
   * Multiplier for exponential backoff
   */
  multiplier?: number;
  
  /**
   * Jitter factor (0-1) to add randomness
   */
  jitter?: number;
  
  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;
}

export enum BackoffType {
  /** Linear backoff: delay = initialDelay + (attempt * step) */
  LINEAR = 'LINEAR',
  
  /** Exponential backoff: delay = initialDelay * (multiplier ^ attempt) */
  EXPONENTIAL = 'EXPONENTIAL',
  
  /** Fixed delay: delay = initialDelay */
  FIXED = 'FIXED',
  
  /** Custom backoff strategy */
  CUSTOM = 'CUSTOM',
}

// ============================================================================
// DEAD LETTER PROCESSOR
// ============================================================================

export interface DeadLetterProcessor {
  /**
   * Process a message that failed processing
   */
  processFailedMessage(
    message: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<DeadLetterAction>;
  
  /**
   * Start the processor
   */
  start(): Promise<void>;
  
  /**
   * Stop the processor
   */
  stop(): Promise<void>;
}

export enum DeadLetterAction {
  /** Retry the message */
  RETRY = 'RETRY',
  
  /** Dead-letter the message */
  DEAD_LETTER = 'DEAD_LETTER',
  
  /** Discard the message */
  DISCARD = 'DISCARD',
}

// ============================================================================
// DEAD LETTER INSPECTOR
// ============================================================================

export interface DeadLetterInspector {
  /**
   * Get dead-lettered messages
   */
  getDeadLetters(
    queue: string,
    options?: DeadLetterQueryOptions
  ): Promise<DeadLetterMessage[]>;
  
  /**
   * Get statistics about dead-lettered messages
   */
  getDeadLetterStats(queue: string): Promise<DeadLetterStats>;
  
  /**
   * Requeue a dead-lettered message
   */
  requeue(messageId: string, targetQueue?: string): Promise<void>;
  
  /**
   * Delete a dead-lettered message
   */
  delete(messageId: string): Promise<void>;
}

export interface DeadLetterQueryOptions {
  /**
   * Filter by reason
   */
  reason?: string;
  
  /**
   * Filter by time range
   */
  timeRange?: {
    start: number;
    end: number;
  };
  
  /**
   * Maximum number of messages to return
   */
  limit?: number;
  
  /**
   * Pagination cursor
   */
  cursor?: string;
}

export interface DeadLetterMessage extends MessageEnvelope {
  /**
   * Original queue the message was from
   */
  originalQueue: string;
  
  /**
   * Reason for dead-lettering
   */
  deadLetterReason: string;
  
  /**
   * Timestamp when dead-lettered
   */
  deadLetterAt: number;
  
  /**
   * Number of retry attempts
   */
  retryCount: number;
  
  /**
   * Last error that caused dead-lettering
   */
  lastError?: string;
}

export interface DeadLetterStats {
  /**
   * Total number of dead-lettered messages
   */
  totalDeadLetters: number;
  
  /**
   * Number of dead-lettered messages by reason
   */
  deadLettersByReason: Record<string, number>;
  
  /**
   * Number of dead-lettered messages by original queue
   */
  deadLettersByQueue: Record<string, number>;
  
  /**
   * Oldest dead-lettered message timestamp
   */
  oldestDeadLetter?: number;
  
  /**
   * Newest dead-lettered message timestamp
   */
  newestDeadLetter?: number;
}

// ============================================================================
// DEAD LETTER MANAGER
// ============================================================================

export interface DeadLetterManager {
  /**
   * Configure dead letter policy for a queue
   */
  configurePolicy(queue: string, policy: DeadLetterPolicy): Promise<void>;
  
  /**
   * Get dead letter policy for a queue
   */
  getPolicy(queue: string): Promise<DeadLetterPolicy | null>;
  
  /**
   * Remove dead letter policy for a queue
   */
  removePolicy(queue: string): Promise<void>;
  
  /**
   * Get the dead letter processor
   */
  getProcessor(): DeadLetterProcessor;
  
  /**
   * Get the dead letter inspector
   */
  getInspector(): DeadLetterInspector;
}
