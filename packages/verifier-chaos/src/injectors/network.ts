/**
 * Network Failure Injector
 * 
 * Simulates network failures: timeouts, connection refused, DNS failures, etc.
 */

import type { Timeline } from '../timeline.js';

export interface NetworkInjectorConfig {
  /** Type of network failure to inject */
  failureType: 'timeout' | 'connection_refused' | 'dns_failure' | 'reset' | 'partial';
  /** Target URL pattern to intercept (regex) */
  targetPattern?: string;
  /** Failure probability (0-1) */
  probability?: number;
  /** Whether to retry should succeed */
  retrySucceeds?: boolean;
  /** Number of retries before success */
  retriesBeforeSuccess?: number;
}

export interface NetworkInjectorState {
  active: boolean;
  interceptedRequests: number;
  failedRequests: number;
  successfulRetries: number;
}

/**
 * Network failure injector for chaos testing
 */
export class NetworkInjector {
  private config: Required<NetworkInjectorConfig>;
  private state: NetworkInjectorState;
  private originalFetch: typeof fetch | null = null;
  private retryCount: Map<string, number> = new Map();
  private timeline: Timeline | null = null;

  constructor(config: NetworkInjectorConfig) {
    this.config = {
      failureType: config.failureType,
      targetPattern: config.targetPattern ?? '.*',
      probability: config.probability ?? 1.0,
      retrySucceeds: config.retrySucceeds ?? false,
      retriesBeforeSuccess: config.retriesBeforeSuccess ?? 3,
    };
    this.state = {
      active: false,
      interceptedRequests: 0,
      failedRequests: 0,
      successfulRetries: 0,
    };
  }

  /**
   * Attach a timeline for event recording
   */
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  /**
   * Activate the network injector
   */
  activate(): void {
    if (this.state.active) return;

    // Store original fetch
    if (typeof globalThis.fetch !== 'undefined') {
      this.originalFetch = globalThis.fetch;
      globalThis.fetch = this.createInterceptedFetch();
    }

    this.state.active = true;
    this.timeline?.record('injection_start', {
      injector: 'network',
      config: this.config,
    });
  }

  /**
   * Deactivate the network injector
   */
  deactivate(): void {
    if (!this.state.active) return;

    // Restore original fetch
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    this.state.active = false;
    this.retryCount.clear();
    this.timeline?.record('injection_end', {
      injector: 'network',
      state: { ...this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): NetworkInjectorState {
    return { ...this.state };
  }

  /**
   * Check if a URL matches the target pattern
   */
  private matchesTarget(url: string): boolean {
    try {
      const regex = new RegExp(this.config.targetPattern);
      return regex.test(url);
    } catch {
      return true;
    }
  }

  /**
   * Determine if this request should fail
   */
  private shouldFail(url: string): boolean {
    // Check probability
    if (Math.random() > this.config.probability) {
      return false;
    }

    // Check retry logic
    if (this.config.retrySucceeds) {
      const currentRetries = this.retryCount.get(url) ?? 0;
      if (currentRetries >= this.config.retriesBeforeSuccess) {
        this.state.successfulRetries++;
        this.retryCount.delete(url);
        return false;
      }
      this.retryCount.set(url, currentRetries + 1);
    }

    return true;
  }

  /**
   * Create the network error based on failure type
   */
  private createError(): Error {
    switch (this.config.failureType) {
      case 'timeout':
        return new Error('Network timeout: request took too long');
      case 'connection_refused':
        return new Error('Connection refused: ECONNREFUSED');
      case 'dns_failure':
        return new Error('DNS lookup failed: ENOTFOUND');
      case 'reset':
        return new Error('Connection reset by peer: ECONNRESET');
      case 'partial':
        return new Error('Incomplete response: connection closed');
      default:
        return new Error('Network failure');
    }
  }

  /**
   * Create intercepted fetch function
   */
  private createInterceptedFetch(): typeof fetch {
    const self = this;
    const original = this.originalFetch!;

    return async function interceptedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
          ? input.toString() 
          : input.url;

      self.state.interceptedRequests++;

      if (self.matchesTarget(url) && self.shouldFail(url)) {
        self.state.failedRequests++;
        self.timeline?.record('error', {
          injector: 'network',
          failureType: self.config.failureType,
          url,
        });
        
        // Simulate delay for timeout
        if (self.config.failureType === 'timeout') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw self.createError();
      }

      return original(input, init);
    };
  }
}

/**
 * Create a network timeout injector
 */
export function createNetworkTimeout(targetPattern?: string, probability?: number): NetworkInjector {
  return new NetworkInjector({
    failureType: 'timeout',
    targetPattern,
    probability,
  });
}

/**
 * Create a connection refused injector
 */
export function createConnectionRefused(targetPattern?: string, probability?: number): NetworkInjector {
  return new NetworkInjector({
    failureType: 'connection_refused',
    targetPattern,
    probability,
  });
}

/**
 * Create a retryable network failure injector
 */
export function createRetryableNetworkFailure(
  failureType: NetworkInjectorConfig['failureType'],
  retriesBeforeSuccess: number = 3
): NetworkInjector {
  return new NetworkInjector({
    failureType,
    retrySucceeds: true,
    retriesBeforeSuccess,
  });
}
