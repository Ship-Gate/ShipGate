// ============================================================================
// ISL Standard Library - Elasticsearch Audit Storage
// @stdlib/audit/storage/elasticsearch
// ============================================================================

import {
  SortDirection,
  type AuditStorage,
  type AuditEvent,
  type AuditEventId,
  type QueryInput,
  type AuditQueryResult,
  type StatsInput,
  type AuditStats,
  type AuditFilters,
  type EventCategory,
  type EventOutcome,
  type Pagination,
} from '../types';

// ============================================================================
// ELASTICSEARCH CLIENT INTERFACE
// ============================================================================

export interface ElasticsearchClient {
  index(params: { index: string; id: string; body: unknown; refresh?: boolean | 'wait_for' }): Promise<any>;
  bulk(params: { body: unknown[]; refresh?: boolean | 'wait_for' }): Promise<any>;
  get(params: { index: string; id: string }): Promise<{ _source: any } | null>;
  search(params: { index: string; body: unknown }): Promise<{
    hits: {
      total: { value: number };
      hits: Array<{ _id: string; _source: any; _score?: number; highlight?: Record<string, string[]> }>;
    };
    aggregations?: Record<string, any>;
  }>;
  delete(params: { index: string; id: string }): Promise<any>;
  deleteByQuery(params: { index: string; body: unknown }): Promise<{ deleted: number }>;
  indices: {
    create(params: { index: string; body: unknown }): Promise<any>;
    exists(params: { index: string }): Promise<boolean>;
    putMapping(params: { index: string; body: unknown }): Promise<any>;
  };
  ping(): Promise<boolean>;
}

// ============================================================================
// ELASTICSEARCH STORAGE OPTIONS
// ============================================================================

export interface ElasticsearchAuditStorageOptions {
  client: ElasticsearchClient;
  indexPrefix?: string;
  
  // Index settings
  numberOfShards?: number;
  numberOfReplicas?: number;
  
  // Index lifecycle
  useDataStreams?: boolean;
  rolloverByMonth?: boolean;
  
  // Search settings
  defaultSearchFields?: string[];
}

// ============================================================================
// ELASTICSEARCH AUDIT STORAGE
// ============================================================================

export class ElasticsearchAuditStorage implements AuditStorage {
  private client: ElasticsearchClient;
  private indexPrefix: string;
  private options: ElasticsearchAuditStorageOptions;

  constructor(options: ElasticsearchAuditStorageOptions) {
    this.client = options.client;
    this.indexPrefix = options.indexPrefix ?? 'audit-events';
    this.options = options;
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async initialize(): Promise<void> {
    const indexName = this.getIndexName();
    const exists = await this.client.indices.exists({ index: indexName });

    if (!exists) {
      await this.client.indices.create({
        index: indexName,
        body: {
          settings: {
            number_of_shards: this.options.numberOfShards ?? 3,
            number_of_replicas: this.options.numberOfReplicas ?? 1,
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              action: { type: 'keyword' },
              category: { type: 'keyword' },
              outcome: { type: 'keyword' },
              description: { type: 'text' },
              
              actor: {
                properties: {
                  id: { type: 'keyword' },
                  type: { type: 'keyword' },
                  name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  email: { type: 'keyword' },
                  ip_address: { type: 'ip' },
                  user_agent: { type: 'text' },
                  session_id: { type: 'keyword' },
                  roles: { type: 'keyword' },
                  organization_id: { type: 'keyword' },
                },
              },
              
              resource: {
                properties: {
                  type: { type: 'keyword' },
                  id: { type: 'keyword' },
                  name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  owner_id: { type: 'keyword' },
                  parent_type: { type: 'keyword' },
                  parent_id: { type: 'keyword' },
                },
              },
              
              source: {
                properties: {
                  service: { type: 'keyword' },
                  version: { type: 'keyword' },
                  environment: { type: 'keyword' },
                  instance_id: { type: 'keyword' },
                  request_id: { type: 'keyword' },
                  host: { type: 'keyword' },
                  port: { type: 'integer' },
                },
              },
              
              metadata: { type: 'object', enabled: true },
              tags: { type: 'keyword' },
              changes: { type: 'nested' },
              
              error_code: { type: 'keyword' },
              error_message: { type: 'text' },
              
              timestamp: { type: 'date' },
              duration_ms: { type: 'integer' },
              
              retention_until: { type: 'date' },
              compliance_flags: { type: 'keyword' },
              
              hash: { type: 'keyword' },
              previous_hash: { type: 'keyword' },
            },
          },
        },
      });
    }
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  async insert(event: AuditEvent): Promise<void> {
    await this.client.index({
      index: this.getIndexName(event.timestamp),
      id: event.id,
      body: this.eventToDocument(event),
      refresh: 'wait_for',
    });
  }

  async insertBatch(events: AuditEvent[]): Promise<void> {
    if (events.length === 0) return;

    const body: unknown[] = [];
    for (const event of events) {
      body.push({ index: { _index: this.getIndexName(event.timestamp), _id: event.id } });
      body.push(this.eventToDocument(event));
    }

    await this.client.bulk({ body, refresh: 'wait_for' });
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  async findById(id: AuditEventId): Promise<AuditEvent | null> {
    try {
      const result = await this.client.get({
        index: `${this.indexPrefix}-*`,
        id,
      });
      return result ? this.documentToEvent(result._source, id) : null;
    } catch {
      return null;
    }
  }

  async query(input: QueryInput): Promise<AuditQueryResult> {
    const query = this.buildQuery(input.filters);
    const from = (input.pagination.page - 1) * input.pagination.page_size;

    const sortField = input.sort?.field ?? 'timestamp';
    const sortOrder = input.sort?.direction === SortDirection.ASC ? 'asc' : 'desc';

    const result = await this.client.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query,
        from,
        size: input.pagination.page_size,
        sort: [{ [sortField]: { order: sortOrder } }],
        _source: input.fields ?? true,
      },
    });

    const events = result.hits.hits.map(hit => 
      this.documentToEvent(hit._source, hit._id as AuditEventId)
    );

    return {
      events,
      total_count: result.hits.total.value,
      page: input.pagination.page,
      page_size: input.pagination.page_size,
      has_more: from + events.length < result.hits.total.value,
    };
  }

  async search(
    queryString: string,
    filters?: AuditFilters,
    pagination?: Pagination
  ): Promise<AuditQueryResult> {
    const must: unknown[] = [
      {
        multi_match: {
          query: queryString,
          fields: this.options.defaultSearchFields ?? [
            'action',
            'description',
            'actor.name',
            'resource.name',
            'error_message',
          ],
          fuzziness: 'AUTO',
        },
      },
    ];

    if (filters) {
      const filterQuery = this.buildQuery(filters);
      if (filterQuery.bool?.filter) {
        must.push(...filterQuery.bool.filter);
      }
    }

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.page_size ?? 20;
    const from = (page - 1) * pageSize;

    const result = await this.client.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query: { bool: { must } },
        from,
        size: pageSize,
        sort: [{ _score: 'desc' }, { timestamp: 'desc' }],
        highlight: {
          fields: {
            description: {},
            'actor.name': {},
            'resource.name': {},
            error_message: {},
          },
        },
      },
    });

    const events = result.hits.hits.map(hit =>
      this.documentToEvent(hit._source, hit._id as AuditEventId)
    );

    return {
      events,
      total_count: result.hits.total.value,
      page,
      page_size: pageSize,
      has_more: from + events.length < result.hits.total.value,
    };
  }

  async getStats(input: StatsInput): Promise<AuditStats> {
    const query = this.buildQuery(input.filters);

    const aggs: Record<string, unknown> = {
      by_category: { terms: { field: 'category', size: 20 } },
      by_outcome: { terms: { field: 'outcome', size: 10 } },
      by_actor_type: { terms: { field: 'actor.type', size: 10 } },
      by_service: { terms: { field: 'source.service', size: 50 } },
    };

    if (input.time_bucket) {
      const interval = this.getDateHistogramInterval(input.time_bucket);
      aggs.time_series = {
        date_histogram: {
          field: 'timestamp',
          calendar_interval: interval,
        },
        aggs: {
          by_category: { terms: { field: 'category' } },
          by_outcome: { terms: { field: 'outcome' } },
        },
      };
    }

    const result = await this.client.search({
      index: `${this.indexPrefix}-*`,
      body: {
        query,
        size: 0,
        aggs,
      },
    });

    const stats: AuditStats = {
      total_events: result.hits.total.value,
    };

    if (result.aggregations?.by_category) {
      stats.by_category = {} as Record<EventCategory, number>;
      for (const bucket of result.aggregations.by_category.buckets) {
        stats.by_category[bucket.key as EventCategory] = bucket.doc_count;
      }
    }

    if (result.aggregations?.by_outcome) {
      stats.by_outcome = {} as Record<EventOutcome, number>;
      for (const bucket of result.aggregations.by_outcome.buckets) {
        stats.by_outcome[bucket.key as EventOutcome] = bucket.doc_count;
      }
    }

    if (result.aggregations?.by_service) {
      stats.by_service = {};
      for (const bucket of result.aggregations.by_service.buckets) {
        stats.by_service[bucket.key] = bucket.doc_count;
      }
    }

    if (result.aggregations?.time_series) {
      stats.time_series = result.aggregations.time_series.buckets.map((bucket: any) => ({
        timestamp: new Date(bucket.key_as_string),
        count: bucket.doc_count,
        by_category: bucket.by_category?.buckets?.reduce((acc: any, b: any) => {
          acc[b.key] = b.doc_count;
          return acc;
        }, {}),
        by_outcome: bucket.by_outcome?.buckets?.reduce((acc: any, b: any) => {
          acc[b.key] = b.doc_count;
          return acc;
        }, {}),
      }));
    }

    return stats;
  }

  // ==========================================================================
  // MAINTENANCE
  // ==========================================================================

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.client.deleteByQuery({
      index: `${this.indexPrefix}-*`,
      body: {
        query: {
          bool: {
            filter: [
              { range: { retention_until: { lt: date.toISOString() } } },
            ],
          },
        },
      },
    });
    return result.deleted;
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.client.ping();
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private getIndexName(timestamp?: Date): string {
    if (this.options.rolloverByMonth && timestamp) {
      const year = timestamp.getFullYear();
      const month = String(timestamp.getMonth() + 1).padStart(2, '0');
      return `${this.indexPrefix}-${year}.${month}`;
    }
    return this.indexPrefix;
  }

  private buildQuery(filters?: AuditFilters): { bool: { filter: unknown[] } } {
    const filter: unknown[] = [];

    if (!filters) return { bool: { filter } };

    if (filters.actor_id) {
      filter.push({ term: { 'actor.id': filters.actor_id } });
    }
    if (filters.actor_type) {
      filter.push({ term: { 'actor.type': filters.actor_type } });
    }
    if (filters.resource_type) {
      filter.push({ term: { 'resource.type': filters.resource_type } });
    }
    if (filters.resource_id) {
      filter.push({ term: { 'resource.id': filters.resource_id } });
    }
    if (filters.action) {
      filter.push({ term: { action: filters.action } });
    }
    if (filters.action_prefix) {
      filter.push({ prefix: { action: filters.action_prefix } });
    }
    if (filters.category) {
      filter.push({ term: { category: filters.category } });
    }
    if (filters.categories && filters.categories.length > 0) {
      filter.push({ terms: { category: filters.categories } });
    }
    if (filters.outcome) {
      filter.push({ term: { outcome: filters.outcome } });
    }
    if (filters.service) {
      filter.push({ term: { 'source.service': filters.service } });
    }
    if (filters.environment) {
      filter.push({ term: { 'source.environment': filters.environment } });
    }
    if (filters.request_id) {
      filter.push({ term: { 'source.request_id': filters.request_id } });
    }
    if (filters.timestamp_start || filters.timestamp_end) {
      const range: Record<string, string> = {};
      if (filters.timestamp_start) {
        range.gte = filters.timestamp_start.toISOString();
      }
      if (filters.timestamp_end) {
        range.lte = filters.timestamp_end.toISOString();
      }
      filter.push({ range: { timestamp: range } });
    }
    if (filters.tags && filters.tags.length > 0) {
      if (filters.tags_match === 'ALL') {
        for (const tag of filters.tags) {
          filter.push({ term: { tags: tag } });
        }
      } else {
        filter.push({ terms: { tags: filters.tags } });
      }
    }

    return { bool: { filter } };
  }

  private eventToDocument(event: AuditEvent): Record<string, unknown> {
    return {
      id: event.id,
      action: event.action,
      category: event.category,
      outcome: event.outcome,
      description: event.description,
      actor: event.actor,
      resource: event.resource,
      source: event.source,
      metadata: event.metadata,
      tags: event.tags,
      changes: event.changes,
      error_code: event.error_code,
      error_message: event.error_message,
      timestamp: event.timestamp.toISOString(),
      duration_ms: event.duration_ms,
      retention_until: event.retention_until?.toISOString(),
      compliance_flags: event.compliance_flags,
      hash: event.hash,
      previous_hash: event.previous_hash,
    };
  }

  private documentToEvent(doc: any, id: AuditEventId): AuditEvent {
    return {
      id,
      action: doc.action,
      category: doc.category,
      outcome: doc.outcome,
      description: doc.description,
      actor: doc.actor,
      resource: doc.resource,
      source: doc.source,
      metadata: doc.metadata,
      tags: doc.tags,
      changes: doc.changes,
      error_code: doc.error_code,
      error_message: doc.error_message,
      timestamp: new Date(doc.timestamp),
      duration_ms: doc.duration_ms,
      retention_until: doc.retention_until ? new Date(doc.retention_until) : undefined,
      compliance_flags: doc.compliance_flags,
      hash: doc.hash,
      previous_hash: doc.previous_hash,
    };
  }

  private getDateHistogramInterval(bucket: string): string {
    switch (bucket) {
      case 'MINUTE': return 'minute';
      case 'HOUR': return 'hour';
      case 'DAY': return 'day';
      case 'WEEK': return 'week';
      case 'MONTH': return 'month';
      default: return 'day';
    }
  }
}
