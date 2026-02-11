// ============================================================================
// ISL Standard Library - Aggregator (convenience facade)
// @stdlib/audit/aggregation/aggregator
// ============================================================================

import type { AuditEntry, AuditStore, Result, AuditError, StoreQueryFilters } from '../types.js';
import { AggregationPipeline } from './pipeline.js';
import type { AggregationResult, TimeWindow } from './types.js';

// ============================================================================
// AGGREGATOR
// ============================================================================

export class Aggregator {
  private store: AuditStore;

  constructor(store: AuditStore) {
    this.store = store;
  }

  pipeline(): AggregationPipeline {
    return new AggregationPipeline();
  }

  async countByCategory(filters?: StoreQueryFilters): Promise<Result<AggregationResult, AuditError>> {
    const entries = await this.collect(filters);
    return new AggregationPipeline()
      .groupByField('category')
      .sortByCount()
      .execute(entries);
  }

  async countByOutcome(filters?: StoreQueryFilters): Promise<Result<AggregationResult, AuditError>> {
    const entries = await this.collect(filters);
    return new AggregationPipeline()
      .groupByField('outcome')
      .sortByCount()
      .execute(entries);
  }

  async countByTimeWindow(
    window: TimeWindow,
    filters?: StoreQueryFilters,
  ): Promise<Result<AggregationResult, AuditError>> {
    const entries = await this.collect(filters);
    return new AggregationPipeline()
      .groupByTimeWindow(window)
      .sortByKey()
      .execute(entries);
  }

  async topActors(
    n: number,
    filters?: StoreQueryFilters,
  ): Promise<Result<AggregationResult, AuditError>> {
    const entries = await this.collect(filters);
    return new AggregationPipeline()
      .group((e) => e.actor.id)
      .sortByCount()
      .limit(n)
      .execute(entries);
  }

  async topActions(
    n: number,
    filters?: StoreQueryFilters,
  ): Promise<Result<AggregationResult, AuditError>> {
    const entries = await this.collect(filters);
    return new AggregationPipeline()
      .group((e) => e.action)
      .sortByCount()
      .limit(n)
      .execute(entries);
  }

  private async collect(filters?: StoreQueryFilters): Promise<AuditEntry[]> {
    const entries: AuditEntry[] = [];
    for await (const entry of this.store.query(filters ?? {})) {
      entries.push(entry);
    }
    return entries;
  }
}
