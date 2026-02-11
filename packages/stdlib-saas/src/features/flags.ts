/**
 * Feature flag storage interface and implementation
 */

import { FeatureFlag, FeatureFlagCreateInput, FeatureFlagUpdateInput } from './types';

export interface FeatureFlagStore {
  save(flag: FeatureFlag): Promise<FeatureFlag>;
  findByKey(key: string): Promise<FeatureFlag | null>;
  findAll(): Promise<FeatureFlag[]>;
  delete(key: string): Promise<void>;
}

export class InMemoryFeatureFlagStore implements FeatureFlagStore {
  private flags: Map<string, FeatureFlag> = new Map();

  async save(flag: FeatureFlag): Promise<FeatureFlag> {
    this.flags.set(flag.key, flag);
    return flag;
  }

  async findByKey(key: string): Promise<FeatureFlag | null> {
    return this.flags.get(key) || null;
  }

  async findAll(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  async delete(key: string): Promise<void> {
    this.flags.delete(key);
  }
}

export class FeatureFlagService {
  constructor(private store: FeatureFlagStore) {}

  /**
   * Create a new feature flag
   */
  async create(input: FeatureFlagCreateInput): Promise<FeatureFlag> {
    const existing = await this.store.findByKey(input.key);
    if (existing) {
      throw new Error(`Feature flag already exists: ${input.key}`);
    }

    const flag: FeatureFlag = {
      key: input.key,
      enabled: input.enabled ?? false,
      rules: (input.rules || []).map((rule, index) => ({
        ...rule,
        id: `rule_${Date.now()}_${index}`,
        priority: index + 1
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.store.save(flag);
  }

  /**
   * Update an existing feature flag
   */
  async update(key: string, input: FeatureFlagUpdateInput): Promise<FeatureFlag> {
    const existing = await this.store.findByKey(key);
    if (!existing) {
      throw new Error(`Feature flag not found: ${key}`);
    }

    const updated: FeatureFlag = {
      ...existing,
      ...input,
      rules: input.rules ? 
        input.rules.map((rule, index) => ({
          ...rule,
          id: `rule_${Date.now()}_${index}`,
          priority: index + 1
        })) : 
        existing.rules,
      updatedAt: new Date()
    };

    return await this.store.save(updated);
  }

  /**
   * Delete a feature flag
   */
  async delete(key: string): Promise<void> {
    const existing = await this.store.findByKey(key);
    if (!existing) {
      throw new Error(`Feature flag not found: ${key}`);
    }

    await this.store.delete(key);
  }

  /**
   * Get all feature flags
   */
  async list(): Promise<FeatureFlag[]> {
    return await this.store.findAll();
  }

  /**
   * Get a feature flag by key
   */
  async get(key: string): Promise<FeatureFlag | null> {
    return await this.store.findByKey(key);
  }
}
