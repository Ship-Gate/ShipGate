// ============================================================================
// ISL Standard Library - Audit Query Builder
// @stdlib/audit/trail/query
// ============================================================================

import type {
  AuditEntry,
  AuditStore,
  ActorType,
  EventCategory,
  EventOutcome,
  StoreQueryFilters,
  Result,
  QueryError,
} from '../types.js';
import { Ok, Err } from '../types.js';
import { invalidQuery, invalidDateRange } from '../errors.js';

// ============================================================================
// QUERY BUILDER
// ============================================================================

export class AuditQueryBuilder {
  private filters: StoreQueryFilters = {};
  private store: AuditStore;

  constructor(store: AuditStore) {
    this.store = store;
  }

  byActor(actorId: string): this {
    this.filters.actor_id = actorId;
    return this;
  }

  byActorType(type: ActorType): this {
    this.filters.actor_type = type;
    return this;
  }

  byAction(action: string): this {
    this.filters.action = action;
    return this;
  }

  byActionPrefix(prefix: string): this {
    this.filters.action_prefix = prefix;
    return this;
  }

  byResource(resourceId: string): this {
    this.filters.resource_id = resourceId;
    return this;
  }

  byResourceType(type: string): this {
    this.filters.resource_type = type;
    return this;
  }

  byCategory(category: EventCategory): this {
    this.filters.category = category;
    return this;
  }

  byCategories(categories: EventCategory[]): this {
    this.filters.categories = categories;
    return this;
  }

  byOutcome(outcome: EventOutcome): this {
    this.filters.outcome = outcome;
    return this;
  }

  byService(service: string): this {
    this.filters.service = service;
    return this;
  }

  byTags(tags: string[]): this {
    this.filters.tags = tags;
    return this;
  }

  since(date: Date): this {
    this.filters.since = date;
    return this;
  }

  until(date: Date): this {
    this.filters.until = date;
    return this;
  }

  limit(n: number): this {
    this.filters.limit = n;
    return this;
  }

  offset(n: number): this {
    this.filters.offset = n;
    return this;
  }

  // ========================================================================
  // EXECUTION
  // ========================================================================

  validate(): Result<void, QueryError> {
    if (this.filters.limit !== undefined && this.filters.limit < 0) {
      return Err(invalidQuery('limit', 'Limit must be >= 0'));
    }
    if (this.filters.offset !== undefined && this.filters.offset < 0) {
      return Err(invalidQuery('offset', 'Offset must be >= 0'));
    }
    if (this.filters.since && this.filters.until) {
      if (this.filters.since > this.filters.until) {
        return Err(invalidDateRange('since must be before until'));
      }
    }
    return Ok(undefined as void);
  }

  async execute(): Promise<Result<AuditEntry[], QueryError>> {
    const validation = this.validate();
    if (!validation.ok) return validation;

    try {
      const results: AuditEntry[] = [];
      for await (const entry of this.store.query(this.filters)) {
        results.push(entry);
      }
      return Ok(results);
    } catch (err) {
      return Err({
        code: 'QUERY_TIMEOUT',
        message: (err as Error).message,
        retriable: true,
      });
    }
  }

  async *stream(): AsyncIterable<AuditEntry> {
    yield* this.store.query(this.filters);
  }

  async count(): Promise<Result<number, QueryError>> {
    const validation = this.validate();
    if (!validation.ok) return validation;

    try {
      const n = await this.store.count(this.filters);
      return Ok(n);
    } catch (err) {
      return Err({
        code: 'QUERY_TIMEOUT',
        message: (err as Error).message,
        retriable: true,
      });
    }
  }

  getFilters(): Readonly<StoreQueryFilters> {
    return { ...this.filters };
  }
}
