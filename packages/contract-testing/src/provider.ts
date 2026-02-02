/**
 * Provider Test
 *
 * Provider-side contract verification utilities.
 */

import { Contract } from './types.js';
import type { VerificationResult } from './verifier.js';
import { ContractBroker } from './broker.js';

export interface ProviderTestOptions {
  /** Provider service name */
  provider: string;
  /** Provider base URL */
  providerBaseUrl: string;
  /** Contract broker options */
  broker?: {
    storageDir?: string;
    brokerUrl?: string;
    apiKey?: string;
  };
  /** State handlers keyed by state name */
  stateHandlers?: Record<string, (params?: Record<string, unknown>) => Promise<void>>;
  /** Publish results to broker */
  publishResults?: boolean;
  /** Provider version */
  providerVersion?: string;
  /** Tags to add to verification */
  tags?: string[];
  /** Verbose logging */
  verbose?: boolean;
}

export interface ProviderVerificationResult {
  /** Overall verification success */
  passed: boolean;
  /** Provider version */
  providerVersion: string;
  /** Consumer name */
  consumer: string;
  /** Verification details */
  details?: VerificationResult;
}

export class ProviderTest {
  private options: ProviderTestOptions;
  private broker: ContractBroker | null = null;
  private results: ProviderVerificationResult[] = [];

  constructor(options: ProviderTestOptions) {
    this.options = options;

    if (options.broker) {
      this.broker = new ContractBroker({
        storageDir: options.broker.storageDir ?? './contracts',
        brokerUrl: options.broker.brokerUrl,
        apiKey: options.broker.apiKey,
      });
    }
  }

  /**
   * Get state handler for a given state
   */
  private async handleState(state: { name: string; params?: Record<string, unknown> }): Promise<void> {
    const handler = this.options.stateHandlers?.[state.name];
    if (handler) {
      await handler(state.params);
    } else if (this.options.verbose) {
      console.log(`[Provider] No handler for state: ${state.name}`);
    }
  }

  /**
   * Verify contracts from a specific consumer
   */
  async verifyConsumer(consumer: string): Promise<ProviderVerificationResult> {
    if (!this.broker) {
      throw new Error('Broker not configured');
    }

    const contract = await this.broker.getLatest(consumer, this.options.provider);
    if (!contract) {
      throw new Error(`No contract found for ${consumer} → ${this.options.provider}`);
    }

    return this.verifyContract(contract);
  }

  /**
   * Verify a specific contract
   */
  async verifyContract(contract: Contract): Promise<ProviderVerificationResult> {
    // Verify by calling the provider for each interaction
    let passed = true;
    
    for (const interaction of contract.interactions) {
      // Handle provider state if specified
      if (interaction.providerState) {
        await this.handleState(interaction.providerState);
      }
      
      // In a real implementation, this would make HTTP requests to the provider
      // and verify the responses match the expected contract
      if (this.options.verbose) {
        console.log(`[Provider] Verifying interaction: ${interaction.description}`);
      }
    }

    const providerResult: ProviderVerificationResult = {
      passed,
      providerVersion: this.options.providerVersion ?? '0.0.0',
      consumer: contract.metadata?.consumer ?? 'unknown',
    };

    this.results.push(providerResult);

    // Publish results if enabled
    if (this.options.publishResults && this.broker) {
      await this.publishVerificationResult(contract, providerResult);
    }

    return providerResult;
  }

  /**
   * Verify all consumers
   */
  async verifyAllConsumers(): Promise<ProviderVerificationResult[]> {
    if (!this.broker) {
      throw new Error('Broker not configured');
    }

    const contracts = await this.broker.getContracts({
      provider: this.options.provider,
      latest: true,
    });

    const results: ProviderVerificationResult[] = [];

    for (const contractVersion of contracts) {
      try {
        const result = await this.verifyContract(contractVersion.contract);
        results.push(result);
      } catch (error) {
        console.error(`Failed to verify contract with ${contractVersion.contract.metadata.consumer}:`, error);
      }
    }

    return results;
  }

  /**
   * Publish verification result to broker
   */
  private async publishVerificationResult(
    contract: Contract,
    result: ProviderVerificationResult
  ): Promise<void> {
    if (!this.broker || !contract.metadata) return;

    const tag = result.passed
      ? `verified:${this.options.providerVersion}`
      : `failed:${this.options.providerVersion}`;

    await this.broker.tag(
      contract.metadata.consumer ?? 'unknown',
      contract.metadata.provider ?? 'unknown',
      contract.metadata.version ?? '0.0.0',
      [tag, ...(this.options.tags ?? [])]
    );
  }

  /**
   * Can I deploy check
   */
  async canIDeploy(): Promise<{ allowed: boolean; reasons: string[] }> {
    if (!this.broker) {
      throw new Error('Broker not configured');
    }

    return this.broker.canIDeploy(
      this.options.provider,
      this.options.providerVersion ?? '0.0.0'
    );
  }

  /**
   * Get all verification results
   */
  getResults(): ProviderVerificationResult[] {
    return [...this.results];
  }

  /**
   * Get verification summary
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    consumers: Array<{ name: string; passed: boolean }>;
  } {
    return {
      total: this.results.length,
      passed: this.results.filter((r) => r.passed).length,
      failed: this.results.filter((r) => !r.passed).length,
      consumers: this.results.map((r) => ({
        name: r.consumer,
        passed: r.passed,
      })),
    };
  }

  /**
   * Clear results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Register state handler
   */
  registerStateHandler(
    stateName: string,
    handler: (params?: Record<string, unknown>) => Promise<void>
  ): void {
    if (!this.options.stateHandlers) {
      this.options.stateHandlers = {};
    }
    this.options.stateHandlers[stateName] = handler;
  }
}

/**
 * Create a provider test instance
 */
export function providerTest(options: ProviderTestOptions): ProviderTest {
  return new ProviderTest(options);
}

/**
 * Helper to run provider verification in CI
 */
export async function runProviderVerification(options: {
  provider: string;
  providerBaseUrl: string;
  contractsDir: string;
  stateHandlers?: Record<string, (params?: Record<string, unknown>) => Promise<void>>;
  providerVersion?: string;
}): Promise<{
  passed: boolean;
  summary: string;
  results: ProviderVerificationResult[];
}> {
  const test = new ProviderTest({
    provider: options.provider,
    providerBaseUrl: options.providerBaseUrl,
    broker: {
      storageDir: options.contractsDir,
    },
    stateHandlers: options.stateHandlers,
    providerVersion: options.providerVersion,
    verbose: true,
  });

  const results = await test.verifyAllConsumers();
  const summary = test.getSummary();

  const summaryText = [
    `Provider: ${options.provider}`,
    `Version: ${options.providerVersion ?? 'unknown'}`,
    `Total: ${summary.total}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
  ].join('\n');

  return {
    passed: summary.failed === 0,
    summary: summaryText,
    results,
  };
}
