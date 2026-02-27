/**
 * Contract Broker
 *
 * Centralized storage and retrieval of contracts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Contract, ContractDiff, compareContracts } from './types.js';

export { Contract, ContractDiff, compareContracts };

export interface BrokerOptions {
  /** Storage directory for contracts */
  storageDir: string;
  /** Remote broker URL (optional) */
  brokerUrl?: string;
  /** API key for remote broker */
  apiKey?: string;
}

export interface ContractVersion {
  version: string;
  contract: Contract;
  publishedAt: string;
  tags: string[];
}

export interface ContractQuery {
  consumer?: string;
  provider?: string;
  version?: string;
  tag?: string;
  latest?: boolean;
}

export class ContractBroker {
  private options: BrokerOptions;
  private contracts: Map<string, ContractVersion[]>;

  constructor(options: BrokerOptions) {
    this.options = options;
    this.contracts = new Map();
    this.loadContracts();
  }

  /**
   * Load contracts from storage
   */
  private loadContracts(): void {
    if (!fs.existsSync(this.options.storageDir)) {
      fs.mkdirSync(this.options.storageDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(this.options.storageDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(
            path.join(this.options.storageDir, file),
            'utf-8'
          );
          const data = JSON.parse(content) as { version: string; contract: Record<string, unknown>; publishedAt: string; tags?: string[] };
          const contract = Contract.fromJSON(data.contract);
          const key = this.getKey(contract.metadata.consumer, contract.metadata.provider);
          
          if (!this.contracts.has(key)) {
            this.contracts.set(key, []);
          }
          
          this.contracts.get(key)!.push({
            version: data.version,
            contract,
            publishedAt: data.publishedAt,
            tags: data.tags ?? [],
          });
        } catch {
          // Skip invalid files
        }
      }
    }
  }

  private getKey(consumer: string, provider: string): string {
    return `${consumer}:${provider}`;
  }

  /**
   * Publish a contract
   */
  async publish(
    contract: Contract,
    options?: { tags?: string[]; version?: string }
  ): Promise<void> {
    const validation = contract.validate();
    if (!validation.valid) {
      throw new Error(`Invalid contract: ${validation.errors.join(', ')}`);
    }

    const key = this.getKey(contract.metadata.consumer, contract.metadata.provider);
    const version = options?.version ?? contract.metadata.version ?? '1.0.0';
    const tags = options?.tags ?? [];

    const contractVersion: ContractVersion = {
      version: String(version),
      contract,
      publishedAt: new Date().toISOString(),
      tags,
    };

    if (!this.contracts.has(key)) {
      this.contracts.set(key, []);
    }

    // Check for existing version
    const existing = this.contracts.get(key)!;
    const existingIndex = existing.findIndex((v) => v.version === version);
    
    if (existingIndex >= 0) {
      existing[existingIndex] = contractVersion;
    } else {
      existing.push(contractVersion);
    }

    // Save to storage
    await this.saveContract(contractVersion);
  }

  /**
   * Save contract to storage
   */
  private async saveContract(contractVersion: ContractVersion): Promise<void> {
    const filename = `${contractVersion.contract.metadata.consumer}-${contractVersion.contract.metadata.provider}-${contractVersion.version}.json`;
    const filepath = path.join(this.options.storageDir, filename);

    await fs.promises.writeFile(
      filepath,
      JSON.stringify({
        version: contractVersion.version,
        contract: contractVersion.contract.toJSON(),
        publishedAt: contractVersion.publishedAt,
        tags: contractVersion.tags,
      }, null, 2),
      'utf-8'
    );
  }

  /**
   * Get contracts matching query
   */
  async getContracts(query: ContractQuery): Promise<ContractVersion[]> {
    let results: ContractVersion[] = [];

    if (query.consumer && query.provider) {
      const key = this.getKey(query.consumer, query.provider);
      results = this.contracts.get(key) ?? [];
    } else if (query.consumer) {
      for (const [key, versions] of this.contracts) {
        if (key.startsWith(`${query.consumer}:`)) {
          results.push(...versions);
        }
      }
    } else if (query.provider) {
      for (const [key, versions] of this.contracts) {
        if (key.endsWith(`:${query.provider}`)) {
          results.push(...versions);
        }
      }
    } else {
      for (const versions of this.contracts.values()) {
        results.push(...versions);
      }
    }

    // Filter by version
    if (query.version) {
      results = results.filter((v) => v.version === query.version);
    }

    // Filter by tag
    if (query.tag) {
      results = results.filter((v) => v.tags.includes(query.tag!));
    }

    // Get latest only
    if (query.latest) {
      const grouped = new Map<string, ContractVersion>();
      for (const v of results) {
        const key = this.getKey(v.contract.metadata.consumer, v.contract.metadata.provider);
        const existing = grouped.get(key);
        if (!existing || new Date(v.publishedAt) > new Date(existing.publishedAt)) {
          grouped.set(key, v);
        }
      }
      results = Array.from(grouped.values());
    }

    return results;
  }

  /**
   * Get latest contract for consumer/provider pair
   */
  async getLatest(consumer: string, provider: string): Promise<Contract | null> {
    const versions = await this.getContracts({ consumer, provider, latest: true });
    return versions.length > 0 ? versions[0].contract : null;
  }

  /**
   * Tag a contract version
   */
  async tag(
    consumer: string,
    provider: string,
    version: string,
    tags: string[]
  ): Promise<void> {
    const key = this.getKey(consumer, provider);
    const versions = this.contracts.get(key);
    
    if (!versions) {
      throw new Error(`No contracts found for ${consumer} → ${provider}`);
    }

    const contractVersion = versions.find((v) => v.version === version);
    if (!contractVersion) {
      throw new Error(`Version ${version} not found`);
    }

    // Add new tags
    for (const tag of tags) {
      if (!contractVersion.tags.includes(tag)) {
        contractVersion.tags.push(tag);
      }
    }

    await this.saveContract(contractVersion);
  }

  /**
   * Compare two versions of a contract
   */
  async compare(
    consumer: string,
    provider: string,
    oldVersion: string,
    newVersion: string
  ): Promise<ContractDiff> {
    const key = this.getKey(consumer, provider);
    const versions = this.contracts.get(key);
    
    if (!versions) {
      throw new Error(`No contracts found for ${consumer} → ${provider}`);
    }

    const oldContract = versions.find((v) => v.version === oldVersion)?.contract;
    const newContract = versions.find((v) => v.version === newVersion)?.contract;

    if (!oldContract || !newContract) {
      throw new Error('One or both versions not found');
    }

    return compareContracts(oldContract, newContract);
  }

  /**
   * Delete a contract version
   */
  async delete(consumer: string, provider: string, version: string): Promise<boolean> {
    const key = this.getKey(consumer, provider);
    const versions = this.contracts.get(key);
    
    if (!versions) {
      return false;
    }

    const index = versions.findIndex((v) => v.version === version);
    if (index < 0) {
      return false;
    }

    const removed = versions.splice(index, 1)[0];
    
    // Remove file
    const filename = `${consumer}-${provider}-${version}.json`;
    const filepath = path.join(this.options.storageDir, filename);
    
    try {
      await fs.promises.unlink(filepath);
    } catch {
      // File may not exist
    }

    return true;
  }

  /**
   * List all consumer/provider pairs
   */
  async listPairs(): Promise<Array<{ consumer: string; provider: string }>> {
    return Array.from(this.contracts.keys()).map((key) => {
      const [consumer, provider] = key.split(':');
      return { consumer, provider };
    });
  }

  /**
   * Can I deploy check - verify if deploying a version would break any consumers
   */
  async canIDeploy(
    provider: string,
    version: string
  ): Promise<{ allowed: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    const consumers = await this.getContracts({ provider, latest: true });

    for (const contractVersion of consumers) {
      // Check if the contract has been verified against this version
      // In a real implementation, this would check verification results
      const hasVerification = contractVersion.tags.includes(`verified:${version}`);
      
      if (!hasVerification) {
        reasons.push(
          `Contract with ${contractVersion.contract.metadata.consumer} not verified against version ${version}`
        );
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Get verification matrix
   */
  async getMatrix(provider: string): Promise<VerificationMatrix> {
    const matrix: VerificationMatrix = {
      provider,
      consumers: [],
    };

    const contracts = await this.getContracts({ provider });
    const consumers = new Set(contracts.map((c) => c.contract.metadata.consumer));

    for (const consumer of consumers) {
      const consumerVersions = contracts.filter(
        (c) => c.contract.metadata.consumer === consumer
      );
      
      matrix.consumers.push({
        name: consumer,
        versions: consumerVersions.map((v) => ({
          version: String(v.version),
          publishedAt: v.publishedAt,
          tags: v.tags,
        })),
      });
    }

    return matrix;
  }
}

interface VerificationMatrix {
  provider: string;
  consumers: Array<{
    name: string;
    versions: Array<{
      version: string;
      publishedAt: string;
      tags: string[];
    }>;
  }>;
}
