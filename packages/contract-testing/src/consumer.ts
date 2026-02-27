/**
 * Consumer Test
 *
 * Consumer-side contract testing utilities.
 */

import { Contract, Interaction, RequestSpec, ResponseSpec, BodyMatcher } from './types.js';
import { MockProvider } from './mock-provider.js';

// Re-export types for convenience
export type ContractRequest = RequestSpec;
export type ContractResponse = ResponseSpec;

export interface ConsumerTestOptions {
  /** Consumer service name */
  consumer: string;
  /** Provider service name */
  provider: string;
  /** ISL domain name */
  domain: string;
}

export interface InteractionBuilder {
  /** Set description */
  uponReceiving(description: string): InteractionBuilder;
  /** Set provider state */
  given(state: string, params?: Record<string, unknown>): InteractionBuilder;
  /** Set request */
  withRequest(request: Partial<RequestSpec>): InteractionBuilder;
  /** Set expected response */
  willRespondWith(response: Partial<ResponseSpec>): InteractionBuilder;
  /** Set behavior name */
  forBehavior(behavior: string): InteractionBuilder;
  /** Build the interaction */
  build(): Interaction;
}

export class ConsumerTest {
  private options: ConsumerTestOptions;
  private interactions: Interaction[];
  private mockProvider: MockProvider | null = null;
  private providerBaseUrl: string = '';

  constructor(options: ConsumerTestOptions) {
    this.options = options;
    this.interactions = [];
  }

  /**
   * Add an interaction
   */
  addInteraction(): InteractionBuilder {
    const interaction: Partial<Interaction> = {
      id: `interaction-${this.interactions.length + 1}`,
      description: '',
      behavior: '',
      request: {
        method: 'GET',
        path: '/',
      },
      response: {
        status: 200,
      },
    };

    const builder: InteractionBuilder = {
      uponReceiving: (description: string) => {
        interaction.description = description;
        return builder;
      },
      given: (state: string, params?: Record<string, unknown>) => {
        interaction.providerState = { name: state, params };
        return builder;
      },
      withRequest: (request: Partial<RequestSpec>) => {
        interaction.request = { ...interaction.request!, ...request } as RequestSpec;
        return builder;
      },
      willRespondWith: (response: Partial<ResponseSpec>) => {
        interaction.response = { ...interaction.response!, ...response } as ResponseSpec;
        return builder;
      },
      forBehavior: (behavior: string) => {
        interaction.behavior = behavior;
        return builder;
      },
      build: () => {
        const built = interaction as Interaction;
        this.interactions.push(built);
        return built;
      },
    };

    return builder;
  }

  /**
   * Start the mock provider
   */
  async setup(): Promise<string> {
    const contract = this.buildContract();
    this.mockProvider = new MockProvider(contract);
    this.providerBaseUrl = await this.mockProvider.start();
    return this.providerBaseUrl;
  }

  /**
   * Stop the mock provider
   */
  async teardown(): Promise<void> {
    if (this.mockProvider) {
      await this.mockProvider.stop();
      this.mockProvider = null;
    }
  }

  /**
   * Get the provider base URL
   */
  getProviderBaseUrl(): string {
    return this.providerBaseUrl;
  }

  /**
   * Verify all interactions were called
   */
  verify(): { passed: boolean; missing: string[]; unexpected: string[] } {
    if (!this.mockProvider) {
      throw new Error('Mock provider not started');
    }
    return this.mockProvider.verify();
  }

  /**
   * Build the contract from interactions
   */
  buildContract(): Contract {
    return new Contract(
      {
        version: '1.0.0',
        consumer: this.options.consumer,
        provider: this.options.provider,
        domain: this.options.domain,
        generatedAt: new Date().toISOString(),
        islVersion: '1.0.0',
      },
      this.interactions
    );
  }

  /**
   * Export contract for publishing
   */
  exportContract(): object {
    return this.buildContract().toJSON();
  }

  /**
   * Clear all interactions
   */
  clear(): void {
    this.interactions = [];
  }
}

/**
 * Fluent matchers for contract testing
 */
export const Matchers = {
  /**
   * Match any string
   */
  string(example: string = 'example'): { value: string; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'type', value: 'string' },
    };
  },

  /**
   * Match any integer
   */
  integer(example: number = 42): { value: number; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'type', value: 'integer' },
    };
  },

  /**
   * Match any number
   */
  number(example: number = 99.99): { value: number; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'type', value: 'number' },
    };
  },

  /**
   * Match any boolean
   */
  boolean(example: boolean = true): { value: boolean; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'type', value: 'boolean' },
    };
  },

  /**
   * Match UUID format
   */
  uuid(example: string = '550e8400-e29b-41d4-a716-446655440000'): { value: string; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'regex', value: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
    };
  },

  /**
   * Match email format
   */
  email(example: string = 'user@example.com'): { value: string; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'regex', value: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    };
  },

  /**
   * Match ISO datetime
   */
  datetime(example: string = '2024-01-15T10:30:00Z'): { value: string; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'regex', value: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' },
    };
  },

  /**
   * Match exact value
   */
  exact<T>(value: T): { value: T; matcher: BodyMatcher } {
    return {
      value,
      matcher: { path: '', type: 'equality', value },
    };
  },

  /**
   * Match array with minimum length
   */
  arrayContaining<T>(example: T[], min: number = 1): { value: T[]; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'arrayContains', min },
    };
  },

  /**
   * Match string containing substring
   */
  stringContaining(substring: string, example?: string): { value: string; matcher: BodyMatcher } {
    return {
      value: example ?? `example ${substring}`,
      matcher: { path: '', type: 'include', value: substring },
    };
  },

  /**
   * Match string with regex
   */
  regex(pattern: string, example: string): { value: string; matcher: BodyMatcher } {
    return {
      value: example,
      matcher: { path: '', type: 'regex', value: pattern },
    };
  },
};

/**
 * Create a consumer test instance
 */
export function consumerTest(options: ConsumerTestOptions): ConsumerTest {
  return new ConsumerTest(options);
}
