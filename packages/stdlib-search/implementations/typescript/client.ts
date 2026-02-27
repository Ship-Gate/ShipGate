// ============================================================================
// Search Standard Library - Search Client
// @isl-lang/stdlib-search
// ============================================================================

import type {
  IndexId,
  DocumentId,
  Query,
  SearchRequest,
  SearchResponse,
  SearchIndex,
  FieldMapping,
  IndexSettings,
  IndexDocumentInput,
  IndexDocumentOutput,
  BulkIndexInput,
  BulkIndexOutput,
  DeleteDocumentInput,
  DeleteDocumentOutput,
  CreateIndexInput,
  CreateIndexOutput,
  SortField,
  Aggregation,
  HighlightConfig,
  SourceFilter,
  Suggester,
  SearchRepository,
  Result,
} from './types.js';

import {
  SearchErrorCode,
  SearchException,
  TotalRelation,
  IndexResult,
  DeleteResult,
  success,
  failure,
} from './types.js';

// ============================================================================
// Search Client Configuration
// ============================================================================

export interface SearchClientConfig {
  defaultIndex?: IndexId;
  defaultSize?: number;
  defaultTimeout?: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchClientConfig = {
  defaultSize: 10,
  defaultTimeout: 30000,
};

// ============================================================================
// Search Request Builder
// ============================================================================

export class SearchRequestBuilder {
  private request: Partial<SearchRequest>;

  constructor(index: IndexId) {
    this.request = {
      index,
      from: 0,
      size: 10,
    };
  }

  query(query: Query): this {
    this.request.query = query;
    return this;
  }

  from(offset: number): this {
    this.request.from = offset;
    return this;
  }

  size(limit: number): this {
    this.request.size = limit;
    return this;
  }

  sort(...fields: SortField[]): this {
    this.request.sort = fields;
    return this;
  }

  aggregations(aggs: Record<string, Aggregation>): this {
    this.request.aggregations = aggs;
    return this;
  }

  agg(name: string, aggregation: Aggregation): this {
    this.request.aggregations = {
      ...this.request.aggregations,
      [name]: aggregation,
    };
    return this;
  }

  highlight(config: HighlightConfig): this {
    this.request.highlight = config;
    return this;
  }

  source(filter: SourceFilter): this {
    this.request.source = filter;
    return this;
  }

  suggest(name: string, suggester: Suggester): this {
    this.request.suggest = {
      ...this.request.suggest,
      [name]: suggester,
    };
    return this;
  }

  trackTotalHits(value: boolean | number): this {
    this.request.track_total_hits = value;
    return this;
  }

  explain(value: boolean = true): this {
    this.request.explain = value;
    return this;
  }

  timeout(ms: number): this {
    this.request.timeout = ms;
    return this;
  }

  build(): SearchRequest {
    if (!this.request.query) {
      throw new SearchException(
        SearchErrorCode.QUERY_PARSE_ERROR,
        'Query is required'
      );
    }

    return this.request as SearchRequest;
  }
}

// ============================================================================
// In-Memory Search Repository (for testing)
// ============================================================================

interface IndexedDocument {
  id: DocumentId;
  document: Record<string, unknown>;
  version: number;
  indexedAt: Date;
}

interface InMemoryIndex {
  index: SearchIndex;
  documents: Map<DocumentId, IndexedDocument>;
}

export class InMemorySearchRepository implements SearchRepository {
  private indices: Map<IndexId, InMemoryIndex> = new Map();
  private documentCounter = 0;

  async search(request: SearchRequest): Promise<Result<SearchResponse>> {
    const index = this.indices.get(request.index);

    if (!index) {
      return failure({
        code: SearchErrorCode.INDEX_NOT_FOUND,
        message: `Index '${request.index}' not found`,
      });
    }

    const startTime = Date.now();
    const allDocs = Array.from(index.documents.values());

    // Simple filtering based on query type
    const matchedDocs = this.filterDocuments(allDocs, request.query);

    // Apply pagination
    const from = request.from ?? 0;
    const size = request.size ?? 10;
    const paginatedDocs = matchedDocs.slice(from, from + size);

    const hits = paginatedDocs.map((doc) => ({
      id: doc.id,
      index: request.index,
      score: 1.0,
      source: request.source === false ? undefined : doc.document,
    }));

    const response: SearchResponse = {
      took_ms: Date.now() - startTime,
      timed_out: false,
      hits: {
        total: {
          value: matchedDocs.length,
          relation: TotalRelation.EQ,
        },
        max_score: hits.length > 0 ? 1.0 : undefined,
        hits,
      },
    };

    return success(response);
  }

  private filterDocuments(
    docs: IndexedDocument[],
    query: Query
  ): IndexedDocument[] {
    switch (query.type) {
      case 'match_all':
        return docs;

      case 'term':
        return docs.filter(
          (doc) => doc.document[query.field] === query.value
        );

      case 'terms':
        return docs.filter((doc) =>
          query.values.includes(doc.document[query.field])
        );

      case 'match':
        return docs.filter((doc) => {
          const fieldValue = doc.document[query.field];
          if (typeof fieldValue !== 'string') return false;
          return fieldValue
            .toLowerCase()
            .includes(query.query.toLowerCase());
        });

      case 'prefix':
        return docs.filter((doc) => {
          const fieldValue = doc.document[query.field];
          if (typeof fieldValue !== 'string') return false;
          return fieldValue.toLowerCase().startsWith(query.value.toLowerCase());
        });

      case 'exists':
        return docs.filter(
          (doc) =>
            query.field in doc.document &&
            doc.document[query.field] !== null &&
            doc.document[query.field] !== undefined
        );

      case 'range':
        return docs.filter((doc) => {
          const value = doc.document[query.field];
          if (value === null || value === undefined) return false;

          if (query.gt != null && !(value > query.gt)) return false;
          if (query.gte != null && !(value >= query.gte)) return false;
          if (query.lt != null && !(value < query.lt)) return false;
          if (query.lte != null && !(value <= query.lte)) return false;

          return true;
        });

      case 'bool': {
        let result = docs;

        if (query.must && query.must.length > 0) {
          for (const subQuery of query.must) {
            result = this.filterDocuments(result, subQuery);
          }
        }

        if (query.filter && query.filter.length > 0) {
          for (const subQuery of query.filter) {
            result = this.filterDocuments(result, subQuery);
          }
        }

        if (query.must_not && query.must_not.length > 0) {
          for (const subQuery of query.must_not) {
            const excluded = new Set(
              this.filterDocuments(docs, subQuery).map((d) => d.id)
            );
            result = result.filter((d) => !excluded.has(d.id));
          }
        }

        if (query.should && query.should.length > 0) {
          const minMatch = query.minimum_should_match ?? 1;
          result = result.filter((doc) => {
            let matches = 0;
            for (const subQuery of query.should!) {
              if (this.filterDocuments([doc], subQuery).length > 0) {
                matches++;
              }
            }
            return matches >= minMatch;
          });
        }

        return result;
      }

      default:
        // For unimplemented query types, return all docs
        return docs;
    }
  }

  async indexDocument(
    input: IndexDocumentInput
  ): Promise<Result<IndexDocumentOutput>> {
    const index = this.indices.get(input.index);

    if (!index) {
      return failure({
        code: SearchErrorCode.INDEX_NOT_FOUND,
        message: `Index '${input.index}' not found`,
      });
    }

    const id = input.id ?? `doc_${++this.documentCounter}`;
    const existing = index.documents.get(id);
    const version = existing ? existing.version + 1 : 1;

    index.documents.set(id, {
      id,
      document: input.document,
      version,
      indexedAt: new Date(),
    });

    index.index.document_count = index.documents.size;
    index.index.updated_at = new Date();
    index.index.last_indexed_at = new Date();

    return success({
      id,
      version,
      result: existing ? IndexResult.UPDATED : IndexResult.CREATED,
    });
  }

  async bulkIndex(input: BulkIndexInput): Promise<Result<BulkIndexOutput>> {
    const startTime = Date.now();
    const items: BulkIndexOutput['items'] = [];
    let hasErrors = false;

    for (const op of input.operations) {
      const index = this.indices.get(op.index);

      if (!index) {
        items.push({
          action: op.action,
          index: op.index,
          id: op.id ?? '',
          status: 404,
          error: `Index '${op.index}' not found`,
        });
        hasErrors = true;
        continue;
      }

      switch (op.action) {
        case 'INDEX':
        case 'CREATE': {
          const id = op.id ?? `doc_${++this.documentCounter}`;
          const existing = index.documents.get(id);

          if (op.action === 'CREATE' && existing) {
            items.push({
              action: op.action,
              index: op.index,
              id,
              status: 409,
              error: 'Document already exists',
            });
            hasErrors = true;
            continue;
          }

          index.documents.set(id, {
            id,
            document: op.document ?? {},
            version: existing ? existing.version + 1 : 1,
            indexedAt: new Date(),
          });

          items.push({
            action: op.action,
            index: op.index,
            id,
            status: existing ? 200 : 201,
          });
          break;
        }

        case 'UPDATE': {
          if (!op.id) {
            items.push({
              action: op.action,
              index: op.index,
              id: '',
              status: 400,
              error: 'Document ID required for update',
            });
            hasErrors = true;
            continue;
          }

          const existing = index.documents.get(op.id);
          if (!existing) {
            items.push({
              action: op.action,
              index: op.index,
              id: op.id,
              status: 404,
              error: 'Document not found',
            });
            hasErrors = true;
            continue;
          }

          index.documents.set(op.id, {
            ...existing,
            document: { ...existing.document, ...op.document },
            version: existing.version + 1,
            indexedAt: new Date(),
          });

          items.push({
            action: op.action,
            index: op.index,
            id: op.id,
            status: 200,
          });
          break;
        }

        case 'DELETE': {
          if (!op.id) {
            items.push({
              action: op.action,
              index: op.index,
              id: '',
              status: 400,
              error: 'Document ID required for delete',
            });
            hasErrors = true;
            continue;
          }

          const deleted = index.documents.delete(op.id);
          items.push({
            action: op.action,
            index: op.index,
            id: op.id,
            status: deleted ? 200 : 404,
            error: deleted ? undefined : 'Document not found',
          });

          if (!deleted) hasErrors = true;
          break;
        }
      }
    }

    return success({
      took_ms: Date.now() - startTime,
      errors: hasErrors,
      items,
    });
  }

  async deleteDocument(
    input: DeleteDocumentInput
  ): Promise<Result<DeleteDocumentOutput>> {
    const index = this.indices.get(input.index);

    if (!index) {
      return failure({
        code: SearchErrorCode.INDEX_NOT_FOUND,
        message: `Index '${input.index}' not found`,
      });
    }

    const deleted = index.documents.delete(input.id);

    if (!deleted) {
      return failure({
        code: SearchErrorCode.DOCUMENT_NOT_FOUND,
        message: `Document '${input.id}' not found`,
      });
    }

    index.index.document_count = index.documents.size;
    index.index.updated_at = new Date();

    return success({
      result: DeleteResult.DELETED,
    });
  }

  async createIndex(input: CreateIndexInput): Promise<Result<CreateIndexOutput>> {
    if (this.indices.has(input.name)) {
      return failure({
        code: SearchErrorCode.INDEX_EXISTS,
        message: `Index '${input.name}' already exists`,
      });
    }

    const now = new Date();
    const index: SearchIndex = {
      id: input.name,
      name: input.name,
      mappings: input.mappings,
      settings: input.settings ?? {},
      document_count: 0,
      size_bytes: 0,
      created_at: now,
      updated_at: now,
    };

    this.indices.set(input.name, {
      index,
      documents: new Map(),
    });

    return success({ index });
  }

  async deleteIndex(indexId: IndexId): Promise<Result<void>> {
    if (!this.indices.has(indexId)) {
      return failure({
        code: SearchErrorCode.INDEX_NOT_FOUND,
        message: `Index '${indexId}' not found`,
      });
    }

    this.indices.delete(indexId);
    return success(undefined);
  }

  async getIndex(indexId: IndexId): Promise<Result<SearchIndex>> {
    const index = this.indices.get(indexId);

    if (!index) {
      return failure({
        code: SearchErrorCode.INDEX_NOT_FOUND,
        message: `Index '${indexId}' not found`,
      });
    }

    return success(index.index);
  }
}

// ============================================================================
// Search Service
// ============================================================================

export interface SearchServiceDependencies {
  repository: SearchRepository;
  config?: Partial<SearchClientConfig>;
}

export class SearchService {
  private readonly repo: SearchRepository;
  private readonly config: SearchClientConfig;

  constructor(deps: SearchServiceDependencies) {
    this.repo = deps.repository;
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...deps.config };
  }

  /**
   * Execute a search query
   */
  async search(request: SearchRequest): Promise<Result<SearchResponse>> {
    return this.repo.search({
      ...request,
      size: request.size ?? this.config.defaultSize,
      timeout: request.timeout ?? this.config.defaultTimeout,
    });
  }

  /**
   * Create a search request builder
   */
  builder(index: IndexId): SearchRequestBuilder {
    return new SearchRequestBuilder(index);
  }

  /**
   * Index a single document
   */
  async index(
    indexId: IndexId,
    document: Record<string, unknown>,
    id?: DocumentId
  ): Promise<Result<IndexDocumentOutput>> {
    return this.repo.indexDocument({
      index: indexId,
      id,
      document,
    });
  }

  /**
   * Index multiple documents in bulk
   */
  async bulkIndex(input: BulkIndexInput): Promise<Result<BulkIndexOutput>> {
    return this.repo.bulkIndex(input);
  }

  /**
   * Delete a document
   */
  async delete(
    indexId: IndexId,
    documentId: DocumentId
  ): Promise<Result<DeleteDocumentOutput>> {
    return this.repo.deleteDocument({
      index: indexId,
      id: documentId,
    });
  }

  /**
   * Create a new index
   */
  async createIndex(
    name: IndexId,
    mappings: FieldMapping[],
    settings?: IndexSettings
  ): Promise<Result<CreateIndexOutput>> {
    return this.repo.createIndex({
      name,
      mappings,
      settings,
    });
  }

  /**
   * Delete an index
   */
  async deleteIndex(indexId: IndexId): Promise<Result<void>> {
    return this.repo.deleteIndex(indexId);
  }

  /**
   * Get index information
   */
  async getIndex(indexId: IndexId): Promise<Result<SearchIndex>> {
    return this.repo.getIndex(indexId);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a search service with in-memory repository (for testing)
 */
export function createInMemorySearchService(
  config?: Partial<SearchClientConfig>
): SearchService {
  return new SearchService({
    repository: new InMemorySearchRepository(),
    config,
  });
}
