// ============================================================================
// ISL Standard Library - Retention Enforcer
// @stdlib/audit/retention/enforcer
// ============================================================================

import type { AuditStore, EventCategory, Result, RetentionError } from '../types.js';
import { Ok, Err } from '../types.js';
import { purgeFailed, invalidPolicy } from '../errors.js';
import type { RetentionPolicy, PurgeResult, PurgeCategoryError } from './types.js';
import { DEFAULT_RETENTION_POLICIES } from './policy.js';

// ============================================================================
// RETENTION ENFORCER
// ============================================================================

export class RetentionEnforcer {
  private store: AuditStore;
  private policies: Map<EventCategory, RetentionPolicy>;

  constructor(store: AuditStore, policies?: RetentionPolicy[]) {
    this.store = store;
    this.policies = new Map();
    for (const p of policies ?? DEFAULT_RETENTION_POLICIES) {
      this.policies.set(p.category, p);
    }
  }

  // ========================================================================
  // POLICY MANAGEMENT
  // ========================================================================

  setPolicy(policy: RetentionPolicy): Result<void, RetentionError> {
    if (policy.retention_days < 1) {
      return Err(invalidPolicy('retention_days must be >= 1'));
    }
    if (policy.archive_after_days !== undefined && policy.archive_after_days >= policy.retention_days) {
      return Err(invalidPolicy('archive_after_days must be less than retention_days'));
    }
    this.policies.set(policy.category, policy);
    return Ok(undefined as void);
  }

  getPolicy(category: EventCategory): RetentionPolicy | undefined {
    return this.policies.get(category);
  }

  getAllPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  // ========================================================================
  // PURGE
  // ========================================================================

  async purge(): Promise<Result<PurgeResult, RetentionError>> {
    const startedAt = new Date();
    let totalDeleted = 0;
    const categoriesProcessed: EventCategory[] = [];
    const errors: PurgeCategoryError[] = [];

    for (const [category, policy] of this.policies) {
      try {
        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - policy.retention_days);

        const deleted = await this.store.deleteOlderThan(cutoff, category);
        totalDeleted += deleted;
        categoriesProcessed.push(category);
      } catch (err) {
        errors.push({
          category,
          message: (err as Error).message,
        });
      }
    }

    if (errors.length > 0 && categoriesProcessed.length === 0) {
      return Err(purgeFailed(`All categories failed: ${errors.map((e) => e.message).join('; ')}`));
    }

    return Ok({
      deleted: totalDeleted,
      categories_processed: categoriesProcessed,
      errors,
      started_at: startedAt,
      completed_at: new Date(),
    });
  }

  async purgeCategory(category: EventCategory): Promise<Result<number, RetentionError>> {
    const policy = this.policies.get(category);
    if (!policy) {
      return Err(invalidPolicy(`No policy for category: ${category}`));
    }

    try {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - policy.retention_days);
      const deleted = await this.store.deleteOlderThan(cutoff, category);
      return Ok(deleted);
    } catch (err) {
      return Err(purgeFailed((err as Error).message));
    }
  }
}
