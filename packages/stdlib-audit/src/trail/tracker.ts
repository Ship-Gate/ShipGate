// ============================================================================
// ISL Standard Library - Audit Tracker (record + query facade)
// @stdlib/audit/trail/tracker
// ============================================================================

import type {
  AuditEntry,
  AuditEntryId,
  AuditStore,
  RecordInput,
  Result,
  RecordError,
  EventCategory,
} from '../types.js';
import { Ok, Err } from '../types.js';
import { createEntry, type EntryOptions } from './entry.js';
import { AuditQueryBuilder } from './query.js';
import { storageError, rateLimited, duplicateEntry } from '../errors.js';

// ============================================================================
// TRACKER OPTIONS
// ============================================================================

export interface TrackerOptions {
  store: AuditStore;
  source: {
    service: string;
    version?: string;
    environment?: string;
    instance_id?: string;
  };
  enableHashing?: boolean;
  enableChaining?: boolean;
  rateLimitPerSecond?: number;
  retentionDays?: Partial<Record<EventCategory, number>>;
  beforeRecord?: (input: RecordInput) => RecordInput | Promise<RecordInput>;
  afterRecord?: (entry: AuditEntry) => void | Promise<void>;
}

// ============================================================================
// AUDIT TRACKER
// ============================================================================

export class AuditTracker {
  private store: AuditStore;
  private options: TrackerOptions;
  private lastHash: string | undefined;
  private idempotencyCache = new Map<string, AuditEntryId>();
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(options: TrackerOptions) {
    this.store = options.store;
    this.options = options;
  }

  // ========================================================================
  // RECORD
  // ========================================================================

  async record(input: RecordInput): Promise<Result<AuditEntry, RecordError>> {
    // Rate limiting
    if (!this.checkRateLimit()) {
      return Err(rateLimited());
    }

    // Idempotency check
    if (input.idempotency_key) {
      const existing = this.idempotencyCache.get(input.idempotency_key);
      if (existing) {
        return Err(duplicateEntry(input.idempotency_key));
      }
    }

    // Apply default source fields
    const enrichedInput: RecordInput = {
      ...input,
      source: {
        ...this.options.source,
        ...input.source,
        service: input.source.service || this.options.source.service,
      },
    };

    // beforeRecord hook
    let processedInput = enrichedInput;
    if (this.options.beforeRecord) {
      processedInput = await this.options.beforeRecord(enrichedInput);
    }

    // Build entry options
    const entryOpts: EntryOptions = {
      enableHashing: this.options.enableHashing ?? true,
      previousHash: this.options.enableChaining ? this.lastHash : undefined,
      retentionUntil: this.calculateRetention(processedInput.category),
    };

    // Create entry
    const result = createEntry(processedInput, entryOpts);
    if (!result.ok) return result;

    const entry = result.value;

    // Persist
    try {
      await this.store.insert(entry);
    } catch (err) {
      return Err(storageError((err as Error).message));
    }

    // Update chain
    if (this.options.enableChaining && entry.hash) {
      this.lastHash = entry.hash;
    }

    // Cache idempotency key
    if (input.idempotency_key) {
      this.idempotencyCache.set(input.idempotency_key, entry.id);
    }

    // afterRecord hook
    if (this.options.afterRecord) {
      await this.options.afterRecord(entry);
    }

    return Ok(entry);
  }

  async recordBatch(
    inputs: RecordInput[],
    allOrNothing = false,
  ): Promise<Result<AuditEntry[], RecordError>> {
    const entries: AuditEntry[] = [];

    for (const input of inputs) {
      const result = await this.record(input);
      if (!result.ok) {
        if (allOrNothing) return result as Result<AuditEntry[], RecordError>;
        continue;
      }
      entries.push(result.value);
    }

    return Ok(entries);
  }

  // ========================================================================
  // QUERY
  // ========================================================================

  query(): AuditQueryBuilder {
    return new AuditQueryBuilder(this.store);
  }

  async getById(id: string): Promise<AuditEntry | null> {
    return this.store.findById(id as AuditEntryId);
  }

  // ========================================================================
  // PRIVATE
  // ========================================================================

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.windowStart > 1000) {
      this.requestCount = 0;
      this.windowStart = now;
    }
    this.requestCount++;
    const limit = this.options.rateLimitPerSecond ?? 10000;
    return this.requestCount <= limit;
  }

  private calculateRetention(category: EventCategory): Date | undefined {
    const days = this.options.retentionDays?.[category];
    if (days === undefined) return undefined;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
}
