/**
 * Contract Publisher
 * 
 * Publish contracts to a broker or CI/CD pipeline.
 */

import { Contract } from './types.js';
import type { ContractBroker } from './broker.js';

export interface PublishOptions {
  /** Broker instance */
  broker: ContractBroker;
  /** Contract version */
  version?: string;
  /** Git branch */
  branch?: string;
  /** Git commit hash */
  commitHash?: string;
  /** Environment tags */
  tags?: string[];
  /** Build URL */
  buildUrl?: string;
}

export interface PublishResult {
  /** Whether publish succeeded */
  success: boolean;
  /** Contract ID */
  contractId?: string;
  /** Version published */
  version?: string;
  /** Broker URL */
  brokerUrl?: string;
  /** Error message */
  error?: string;
}

/**
 * Contract Publisher
 */
export class ContractPublisher {
  private broker: ContractBroker;

  constructor(broker: ContractBroker) {
    this.broker = broker;
  }

  /**
   * Publish a contract
   */
  async publish(
    contract: Contract,
    options: Partial<PublishOptions> = {}
  ): Promise<PublishResult> {
    try {
      // Update metadata if provided
      if (contract.metadata) {
        if (options.version) {
          contract.metadata.version = options.version;
        }
        if (options.branch) {
          contract.metadata.branch = options.branch;
        }
        if (options.commitHash) {
          contract.metadata.commitHash = options.commitHash;
        }
        if (options.tags) {
          contract.metadata.tags = options.tags;
        }
      }

      // Publish to broker
      await this.broker.publish(contract, { version: options.version, tags: options.tags });

      // Generate contract ID
      const contractId = `${contract.metadata?.consumer ?? 'unknown'}-${contract.metadata?.provider ?? 'unknown'}-${contract.metadata?.version ?? '1.0.0'}`;

      return {
        success: true,
        contractId,
        version: contract.metadata?.version,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Publish multiple contracts
   */
  async publishAll(
    contracts: Contract[],
    options: Partial<PublishOptions> = {}
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const contract of contracts) {
      const result = await this.publish(contract, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Publish with verification
   */
  async publishWithVerification(
    contract: Contract,
    verifier: () => Promise<boolean>,
    options: Partial<PublishOptions> = {}
  ): Promise<PublishResult> {
    // Run verification first
    const verified = await verifier();

    if (!verified) {
      return {
        success: false,
        error: 'Contract verification failed',
      };
    }

    // Publish if verified
    return this.publish(contract, options);
  }

  /**
   * Check if publish would break existing consumers
   */
  async canPublish(
    contract: Contract
  ): Promise<{ canPublish: boolean; breakingChanges: string[] }> {
    const breakingChanges: string[] = [];

    // Get existing contract
    const consumer = contract.metadata?.consumer ?? '';
    const provider = contract.metadata?.provider ?? '';
    
    const existing = await this.broker.getLatest(consumer, provider);

    if (!existing) {
      return { canPublish: true, breakingChanges: [] };
    }

    // Check for removed behaviors
    for (const oldBehavior of existing.spec.behaviors) {
      const newBehavior = contract.spec.behaviors.find(
        (b: { name: string }) => b.name === oldBehavior.name
      );

      if (!newBehavior) {
        breakingChanges.push(`Removed behavior: ${oldBehavior.name}`);
        continue;
      }

      // Check for removed input fields
      if (oldBehavior.input && newBehavior.input) {
        for (const field of Object.keys(oldBehavior.input)) {
          if (!(field in (newBehavior.input as object))) {
            breakingChanges.push(
              `Removed input field '${field}' from ${oldBehavior.name}`
            );
          }
        }
      }

      // Check for removed output fields
      if (oldBehavior.output && newBehavior.output) {
        for (const field of Object.keys(oldBehavior.output)) {
          if (!(field in (newBehavior.output as object))) {
            breakingChanges.push(
              `Removed output field '${field}' from ${oldBehavior.name}`
            );
          }
        }
      }
    }

    return {
      canPublish: breakingChanges.length === 0,
      breakingChanges,
    };
  }
}

/**
 * Create contract from test interactions
 */
export function contractFromInteractions(
  consumer: string,
  provider: string,
  domain: string,
  interactions: Array<{
    behavior: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>,
  version = '1.0.0'
): Contract {
  // Extract unique behaviors
  const behaviorsMap = new Map<string, { input: Record<string, unknown>; output: Record<string, unknown> }>();

  for (const interaction of interactions) {
    if (!behaviorsMap.has(interaction.behavior)) {
      behaviorsMap.set(interaction.behavior, {
        input: interaction.input,
        output: interaction.output,
      });
    }
  }

  const contract = new Contract(
    {
      version,
      consumer,
      provider,
      domain,
      generatedAt: new Date().toISOString(),
      islVersion: '1.0.0',
    },
    []
  );

  contract.spec = {
    behaviors: Array.from(behaviorsMap.entries()).map(([name, data]) => ({
      name,
      input: data.input,
      output: data.output,
    })),
    types: [],
    interactions: interactions.map((i, idx) => ({
      id: `interaction-${idx}`,
      description: `${i.behavior} interaction`,
      request: {
        behavior: i.behavior,
        input: i.input,
      },
      response: {
        status: 'success' as const,
        output: i.output,
      },
    })),
  };

  return contract;
}
