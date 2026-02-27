/**
 * Feature flag store interface
 */

import { FeatureFlag } from './types';

export interface FeatureFlagStore {
  save(flag: FeatureFlag): Promise<FeatureFlag>;
  findByKey(key: string): Promise<FeatureFlag | null>;
  findAll(): Promise<FeatureFlag[]>;
  delete(key: string): Promise<void>;
}
