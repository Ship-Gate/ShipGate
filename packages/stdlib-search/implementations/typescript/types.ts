// ============================================================================
// Search Standard Library - Type Definitions
// Generated from ISL specifications
// @isl-lang/stdlib-search
// ============================================================================

// ============================================================================
// Core Types
// ============================================================================

export type IndexId = string;
export type DocumentId = string;
export type Score = number;

// ============================================================================
// Enums
// ============================================================================

export enum FieldType {
  // Text
  TEXT = 'TEXT',
  KEYWORD = 'KEYWORD',
  // Numeric
  INTEGER = 'INTEGER',
  LONG = 'LONG',
  FLOAT = 'FLOAT',
  DOUBLE = 'DOUBLE',
  // Date/Time
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  // Boolean
  BOOLEAN = 'BOOLEAN',
  // Complex
  OBJECT = 'OBJECT',
  NESTED = 'NESTED',
  ARRAY = 'ARRAY',
  // Geo
  GEO_POINT = 'GEO_POINT',
  GEO_SHAPE = 'GEO_SHAPE',
  // Special
  COMPLETION = 'COMPLETION',
  DENSE_VECTOR = 'DENSE_VECTOR',
  SPARSE_VECTOR = 'SPARSE_VECTOR',
}

export enum MatchOperator {
  AND = 'AND',
  OR = 'OR',
}

export enum MultiMatchType {
  BEST_FIELDS = 'BEST_FIELDS',
  MOST_FIELDS = 'MOST_FIELDS',
  CROSS_FIELDS = 'CROSS_FIELDS',
  PHRASE = 'PHRASE',
  PHRASE_PREFIX = 'PHRASE_PREFIX',
}

export enum Fuzziness {
  AUTO = 'AUTO',
  ZERO = 0,
  ONE = 1,
  TWO = 2,
}

export enum DistanceUnit {
  METERS = 'METERS',
  KILOMETERS = 'KILOMETERS',
  MILES = 'MILES',
  FEET = 'FEET',
}

export enum TotalRelation {
  EQ = 'EQ',
  GTE = 'GTE',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortMode {
  MIN = 'MIN',
  MAX = 'MAX',
  SUM = 'SUM',
  AVG = 'AVG',
  MEDIAN = 'MEDIAN',
}

export enum SortMissing {
  FIRST = 'FIRST',
  LAST = 'LAST',
}

export enum CalendarInterval {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

export enum HighlightEncoder {
  DEFAULT = 'DEFAULT',
  HTML = 'HTML',
}

export enum HighlighterType {
  UNIFIED = 'UNIFIED',
  PLAIN = 'PLAIN',
  FVH = 'FVH',
}

export enum SuggestMode {
  MISSING = 'MISSING',
  POPULAR = 'POPULAR',
  ALWAYS = 'ALWAYS',
}

export enum RefreshPolicy {
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  WAIT_FOR = 'WAIT_FOR',
}

export enum IndexResult {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  NOOP = 'NOOP',
}

export enum DeleteResult {
  DELETED = 'DELETED',
  NOT_FOUND = 'NOT_FOUND',
}

export enum BulkAction {
  INDEX = 'INDEX',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// ============================================================================
// Index Types
// ============================================================================

export interface FieldMapping {
  name: string;
  type: FieldType;
  index?: boolean;
  store?: boolean;
  analyzer?: string;
  search_analyzer?: string;
  properties?: FieldMapping[];
  boost?: number;
  null_value?: unknown;
  facetable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
}

export interface Analyzer {
  type: string;
  tokenizer?: string;
  filters?: string[];
  char_filters?: string[];
}

export interface Tokenizer {
  type: string;
  pattern?: string;
  min_gram?: number;
  max_gram?: number;
}

export interface TokenFilter {
  type: string;
  stopwords?: string[];
  synonyms?: string[];
}

export interface IndexSettings {
  number_of_shards?: number;
  number_of_replicas?: number;
  refresh_interval?: number;
  analysis?: {
    analyzers?: Record<string, Analyzer>;
    tokenizers?: Record<string, Tokenizer>;
    filters?: Record<string, TokenFilter>;
  };
}

export interface SearchIndex {
  id: IndexId;
  name: string;
  mappings: FieldMapping[];
  settings: IndexSettings;
  document_count: number;
  size_bytes: number;
  created_at: Date;
  updated_at: Date;
  last_indexed_at?: Date;
}

// ============================================================================
// Query Types
// ============================================================================

export interface BaseQuery {
  boost?: number;
}

export interface MatchQuery extends BaseQuery {
  type: 'match';
  field: string;
  query: string;
  operator?: MatchOperator;
  fuzziness?: Fuzziness;
  minimum_should_match?: string;
}

export interface MultiMatchQuery extends BaseQuery {
  type: 'multi_match';
  fields: string[];
  query: string;
  match_type?: MultiMatchType;
  tie_breaker?: number;
}

export interface QueryStringQuery extends BaseQuery {
  type: 'query_string';
  query: string;
  default_field?: string;
  default_operator?: MatchOperator;
  allow_leading_wildcard?: boolean;
}

export interface TermQuery extends BaseQuery {
  type: 'term';
  field: string;
  value: unknown;
}

export interface TermsQuery extends BaseQuery {
  type: 'terms';
  field: string;
  values: unknown[];
}

export interface RangeQuery extends BaseQuery {
  type: 'range';
  field: string;
  gt?: unknown;
  gte?: unknown;
  lt?: unknown;
  lte?: unknown;
}

export interface ExistsQuery extends BaseQuery {
  type: 'exists';
  field: string;
}

export interface PrefixQuery extends BaseQuery {
  type: 'prefix';
  field: string;
  value: string;
}

export interface WildcardQuery extends BaseQuery {
  type: 'wildcard';
  field: string;
  value: string;
}

export interface FuzzyQuery extends BaseQuery {
  type: 'fuzzy';
  field: string;
  value: string;
  fuzziness: Fuzziness;
}

export interface RegexpQuery extends BaseQuery {
  type: 'regexp';
  field: string;
  value: string;
  flags?: string;
}

export interface BoolQuery extends BaseQuery {
  type: 'bool';
  must?: Query[];
  should?: Query[];
  must_not?: Query[];
  filter?: Query[];
  minimum_should_match?: number;
}

export interface BoostingQuery extends BaseQuery {
  type: 'boosting';
  positive: Query;
  negative: Query;
  negative_boost: number;
}

export interface ConstantScoreQuery extends BaseQuery {
  type: 'constant_score';
  filter: Query;
  score: number;
}

export interface DisMaxQuery extends BaseQuery {
  type: 'dis_max';
  queries: Query[];
  tie_breaker?: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Distance {
  value: number;
  unit: DistanceUnit;
}

export interface GeoDistanceQuery extends BaseQuery {
  type: 'geo_distance';
  field: string;
  location: GeoPoint;
  distance: Distance;
}

export interface GeoBoundingBoxQuery extends BaseQuery {
  type: 'geo_bounding_box';
  field: string;
  top_left: GeoPoint;
  bottom_right: GeoPoint;
}

export interface KnnQuery extends BaseQuery {
  type: 'knn';
  field: string;
  query_vector: number[];
  k: number;
  num_candidates?: number;
}

export interface MatchAllQuery extends BaseQuery {
  type: 'match_all';
}

export type Query =
  | MatchQuery
  | MultiMatchQuery
  | QueryStringQuery
  | TermQuery
  | TermsQuery
  | RangeQuery
  | ExistsQuery
  | PrefixQuery
  | WildcardQuery
  | FuzzyQuery
  | RegexpQuery
  | BoolQuery
  | BoostingQuery
  | ConstantScoreQuery
  | DisMaxQuery
  | GeoDistanceQuery
  | GeoBoundingBoxQuery
  | KnnQuery
  | MatchAllQuery;

// ============================================================================
// Sorting Types
// ============================================================================

export interface SortField {
  field: string;
  order?: SortOrder;
  mode?: SortMode;
  missing?: SortMissing;
  unmapped_type?: FieldType;
}

// ============================================================================
// Aggregation Types
// ============================================================================

export interface TermsAggregation {
  type: 'terms';
  field: string;
  size?: number;
  min_doc_count?: number;
  order?: Record<string, SortOrder>;
  include?: string | string[];
  exclude?: string | string[];
}

export interface RangeAggregation {
  type: 'range';
  field: string;
  ranges: Array<{
    key?: string;
    from?: unknown;
    to?: unknown;
  }>;
}

export interface DateHistogramAggregation {
  type: 'date_histogram';
  field: string;
  calendar_interval?: CalendarInterval;
  fixed_interval?: number;
  format?: string;
  time_zone?: string;
  min_doc_count?: number;
}

export interface HistogramAggregation {
  type: 'histogram';
  field: string;
  interval: number;
  offset?: number;
  min_doc_count?: number;
}

export interface FilterAggregation {
  type: 'filter';
  filter: Query;
}

export interface NestedAggregation {
  type: 'nested';
  path: string;
}

export interface AvgAggregation {
  type: 'avg';
  field: string;
}

export interface SumAggregation {
  type: 'sum';
  field: string;
}

export interface MinAggregation {
  type: 'min';
  field: string;
}

export interface MaxAggregation {
  type: 'max';
  field: string;
}

export interface StatsAggregation {
  type: 'stats';
  field: string;
}

export interface CardinalityAggregation {
  type: 'cardinality';
  field: string;
  precision_threshold?: number;
}

export type Aggregation =
  | TermsAggregation
  | RangeAggregation
  | DateHistogramAggregation
  | HistogramAggregation
  | FilterAggregation
  | NestedAggregation
  | AvgAggregation
  | SumAggregation
  | MinAggregation
  | MaxAggregation
  | StatsAggregation
  | CardinalityAggregation;

export interface AggregationResult {
  buckets?: Bucket[];
  value?: unknown;
  doc_count?: number;
}

export interface Bucket {
  key: unknown;
  key_as_string?: string;
  doc_count: number;
  aggregations?: Record<string, AggregationResult>;
}

// ============================================================================
// Highlighting Types
// ============================================================================

export interface HighlightField {
  pre_tags?: string[];
  post_tags?: string[];
  number_of_fragments?: number;
  fragment_size?: number;
}

export interface HighlightConfig {
  fields: Record<string, HighlightField>;
  pre_tags?: string[];
  post_tags?: string[];
  encoder?: HighlightEncoder;
  type?: HighlighterType;
  number_of_fragments?: number;
  fragment_size?: number;
}

// ============================================================================
// Suggestion Types
// ============================================================================

export interface TermSuggester {
  field: string;
  size?: number;
  suggest_mode?: SuggestMode;
}

export interface PhraseSuggester {
  field: string;
  size?: number;
  gram_size?: number;
  highlight?: {
    pre_tag: string;
    post_tag: string;
  };
}

export interface FuzzyConfig {
  fuzziness: Fuzziness;
  transpositions?: boolean;
  min_length?: number;
  prefix_length?: number;
}

export interface CompletionSuggester {
  field: string;
  size?: number;
  skip_duplicates?: boolean;
  fuzzy?: FuzzyConfig;
  contexts?: Record<string, unknown>;
}

export interface Suggester {
  text: string;
  term?: TermSuggester;
  phrase?: PhraseSuggester;
  completion?: CompletionSuggester;
}

export interface Suggestion {
  text: string;
  offset: number;
  length: number;
  options: Array<{
    text: string;
    score: Score;
    highlighted?: string;
  }>;
}

// ============================================================================
// Source Filtering
// ============================================================================

export type SourceFilter =
  | boolean
  | {
      includes?: string[];
      excludes?: string[];
    };

export interface Explanation {
  value: number;
  description: string;
  details?: Explanation[];
}

// ============================================================================
// Search Request/Response
// ============================================================================

export interface SearchRequest {
  index: IndexId;
  query: Query;
  from?: number;
  size?: number;
  sort?: SortField[];
  aggregations?: Record<string, Aggregation>;
  highlight?: HighlightConfig;
  source?: SourceFilter;
  suggest?: Record<string, Suggester>;
  track_total_hits?: boolean | number;
  explain?: boolean;
  timeout?: number;
}

export interface SearchHit {
  id: DocumentId;
  index: IndexId;
  score?: Score;
  source?: Record<string, unknown>;
  highlight?: Record<string, string[]>;
  sort?: unknown[];
  explanation?: Explanation;
}

export interface SearchResponse {
  took_ms: number;
  timed_out: boolean;
  hits: {
    total: {
      value: number;
      relation: TotalRelation;
    };
    max_score?: Score;
    hits: SearchHit[];
  };
  aggregations?: Record<string, AggregationResult>;
  suggest?: Record<string, Suggestion[]>;
}

// ============================================================================
// Index Operations
// ============================================================================

export interface IndexDocumentInput {
  index: IndexId;
  id?: DocumentId;
  document: Record<string, unknown>;
  refresh?: RefreshPolicy;
}

export interface IndexDocumentOutput {
  id: DocumentId;
  version: number;
  result: IndexResult;
}

export interface BulkOperation {
  action: BulkAction;
  index: IndexId;
  id?: DocumentId;
  document?: Record<string, unknown>;
}

export interface BulkItemResponse {
  action: BulkAction;
  index: IndexId;
  id: DocumentId;
  status: number;
  error?: string;
}

export interface BulkIndexInput {
  operations: BulkOperation[];
  refresh?: RefreshPolicy;
}

export interface BulkIndexOutput {
  took_ms: number;
  errors: boolean;
  items: BulkItemResponse[];
}

export interface DeleteDocumentInput {
  index: IndexId;
  id: DocumentId;
}

export interface DeleteDocumentOutput {
  result: DeleteResult;
}

export interface CreateIndexInput {
  name: IndexId;
  mappings: FieldMapping[];
  settings?: IndexSettings;
}

export interface CreateIndexOutput {
  index: SearchIndex;
}

// ============================================================================
// Error Types
// ============================================================================

export enum SearchErrorCode {
  INDEX_NOT_FOUND = 'INDEX_NOT_FOUND',
  QUERY_PARSE_ERROR = 'QUERY_PARSE_ERROR',
  TIMEOUT = 'TIMEOUT',
  MAPPING_ERROR = 'MAPPING_ERROR',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  INDEX_EXISTS = 'INDEX_EXISTS',
  INVALID_MAPPING = 'INVALID_MAPPING',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface SearchError {
  code: SearchErrorCode;
  message: string;
  position?: number;
  details?: Record<string, unknown>;
}

export class SearchException extends Error {
  constructor(
    public readonly code: SearchErrorCode,
    message: string,
    public readonly position?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SearchException';
  }

  toError(): SearchError {
    return {
      code: this.code,
      message: this.message,
      position: this.position,
      details: this.details,
    };
  }
}

// ============================================================================
// Result Type
// ============================================================================

export type Result<T, E = SearchError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<E = SearchError>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface SearchRepository {
  search(request: SearchRequest): Promise<Result<SearchResponse>>;
  indexDocument(input: IndexDocumentInput): Promise<Result<IndexDocumentOutput>>;
  bulkIndex(input: BulkIndexInput): Promise<Result<BulkIndexOutput>>;
  deleteDocument(input: DeleteDocumentInput): Promise<Result<DeleteDocumentOutput>>;
  createIndex(input: CreateIndexInput): Promise<Result<CreateIndexOutput>>;
  deleteIndex(indexId: IndexId): Promise<Result<void>>;
  getIndex(indexId: IndexId): Promise<Result<SearchIndex>>;
}
