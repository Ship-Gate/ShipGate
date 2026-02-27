/**
 * Mock Server
 * 
 * Create mock servers from contracts for consumer testing.
 */

import { Contract, ContractInteraction } from './types.js';
import { ContractMatcher, type MatcherOptions } from './matcher.js';

export interface MockServerOptions {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Matcher options for request matching */
  matcherOptions?: MatcherOptions;
  /** Enable request logging */
  logRequests?: boolean;
  /** Enable CORS */
  cors?: boolean;
  /** Response delay in ms */
  responseDelay?: number;
}

export interface MockEndpoint {
  /** Behavior name */
  behavior: string;
  /** Request matcher */
  requestMatcher: (input: Record<string, unknown>) => boolean;
  /** Response generator */
  responseGenerator: (input: Record<string, unknown>) => MockResponse;
  /** Times this can be called (undefined = unlimited) */
  times?: number;
  /** Current call count */
  callCount: number;
}

export interface MockResponse {
  status: 'success' | 'failure';
  output?: Record<string, unknown>;
  error?: { code: string; message: string };
  delay?: number;
}

export interface MockRequest {
  behavior: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Mock Server
 * 
 * Simulates a provider based on contract definitions.
 */
export class MockServer {
  private options: Required<MockServerOptions>;
  private endpoints: MockEndpoint[] = [];
  private requestLog: MockRequest[] = [];
  private states = new Map<string, Record<string, unknown>>();
  private matcher: ContractMatcher;
  private running = false;

  constructor(options: MockServerOptions = {}) {
    this.options = {
      port: options.port ?? 3000,
      host: options.host ?? 'localhost',
      matcherOptions: options.matcherOptions ?? {},
      logRequests: options.logRequests ?? true,
      cors: options.cors ?? true,
      responseDelay: options.responseDelay ?? 0,
    };
    this.matcher = new ContractMatcher(this.options.matcherOptions);
  }

  /**
   * Load endpoints from a contract
   */
  loadContract(contract: Contract): MockServer {
    for (const interaction of contract.spec.interactions) {
      this.addEndpointFromInteraction(interaction);
    }
    return this;
  }

  /**
   * Add endpoint from interaction
   */
  private addEndpointFromInteraction(interaction: ContractInteraction): void {
    this.endpoints.push({
      behavior: interaction.request.behavior,
      requestMatcher: (input) => {
        const result = this.matcher.match(interaction.request.input, input);
        return result.matched;
      },
      responseGenerator: () => ({
        status: interaction.response.status,
        output: interaction.response.output,
        error: interaction.response.error,
      }),
      callCount: 0,
    });
  }

  /**
   * Add a custom endpoint
   */
  addEndpoint(
    behavior: string,
    requestMatcher: (input: Record<string, unknown>) => boolean,
    responseGenerator: (input: Record<string, unknown>) => MockResponse,
    times?: number
  ): MockServer {
    this.endpoints.push({
      behavior,
      requestMatcher,
      responseGenerator,
      times,
      callCount: 0,
    });
    return this;
  }

  /**
   * Set a provider state
   */
  setState(name: string, data: Record<string, unknown> = {}): MockServer {
    this.states.set(name, data);
    return this;
  }

  /**
   * Get a provider state
   */
  getState(name: string): Record<string, unknown> | undefined {
    return this.states.get(name);
  }

  /**
   * Clear all states
   */
  clearStates(): MockServer {
    this.states.clear();
    return this;
  }

  /**
   * Handle a request
   */
  async handleRequest(
    behavior: string,
    input: Record<string, unknown>
  ): Promise<MockResponse> {
    // Log request
    if (this.options.logRequests) {
      this.requestLog.push({
        behavior,
        input,
        timestamp: new Date(),
      });
    }

    // Find matching endpoint
    const endpoint = this.endpoints.find(
      (e) =>
        e.behavior === behavior &&
        e.requestMatcher(input) &&
        (e.times === undefined || e.callCount < e.times)
    );

    if (!endpoint) {
      return {
        status: 'failure',
        error: {
          code: 'NOT_FOUND',
          message: `No matching endpoint for behavior '${behavior}'`,
        },
      };
    }

    // Increment call count
    endpoint.callCount++;

    // Generate response
    const response = endpoint.responseGenerator(input);

    // Apply delay
    const delay = response.delay ?? this.options.responseDelay;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return response;
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Mock server is already running');
    }

    // In a real implementation, this would start an HTTP server
    // For now, we just mark it as running
    this.running = true;
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get request log
   */
  getRequestLog(): MockRequest[] {
    return [...this.requestLog];
  }

  /**
   * Clear request log
   */
  clearRequestLog(): MockServer {
    this.requestLog = [];
    return this;
  }

  /**
   * Get endpoint call counts
   */
  getCallCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const endpoint of this.endpoints) {
      const key = endpoint.behavior;
      counts[key] = (counts[key] ?? 0) + endpoint.callCount;
    }

    return counts;
  }

  /**
   * Verify all expected calls were made
   */
  verifyExpectations(): { success: boolean; unmatched: string[] } {
    const unmatched: string[] = [];

    for (const endpoint of this.endpoints) {
      if (endpoint.times !== undefined && endpoint.callCount < endpoint.times) {
        unmatched.push(
          `${endpoint.behavior}: expected ${endpoint.times} calls, got ${endpoint.callCount}`
        );
      }
    }

    return {
      success: unmatched.length === 0,
      unmatched,
    };
  }

  /**
   * Reset all endpoint call counts
   */
  resetCallCounts(): MockServer {
    for (const endpoint of this.endpoints) {
      endpoint.callCount = 0;
    }
    return this;
  }

  /**
   * Get server URL
   */
  getUrl(): string {
    return `http://${this.options.host}:${this.options.port}`;
  }
}

/**
 * Create a mock server from contract
 */
export function createMockServer(
  contract: Contract,
  options?: MockServerOptions
): MockServer {
  return new MockServer(options).loadContract(contract);
}

/**
 * Create an in-memory mock executor
 */
export function createMockExecutor(contract: Contract): {
  execute: (behavior: string, input: Record<string, unknown>) => Promise<unknown>;
  setState: (state: string, params?: Record<string, unknown>) => Promise<void>;
} {
  const server = new MockServer().loadContract(contract);

  return {
    execute: async (behavior, input) => {
      const response = await server.handleRequest(behavior, input);
      
      if (response.status === 'failure') {
        throw new Error(response.error?.message ?? 'Request failed');
      }
      
      return response.output;
    },
    setState: async (state, params) => {
      server.setState(state, params);
    },
  };
}
