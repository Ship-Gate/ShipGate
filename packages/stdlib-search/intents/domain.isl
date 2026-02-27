# Search Standard Library
# Full-text search, filtering, facets, and query DSL

domain Search {
  version: "1.0.0"
  description: "Universal search capabilities with multiple backend support"
  
  imports {
    core from "@intentos/stdlib-core"
  }
  
  # ============================================
  # Core Types
  # ============================================
  
  type IndexId = String
  type DocumentId = String
  type Score = Float [min: 0.0]
  
  # ============================================
  # Index Definition
  # ============================================
  
  entity SearchIndex {
    id: IndexId [immutable, unique]
    name: String
    
    # Schema
    mappings: List<FieldMapping>
    settings: IndexSettings
    
    # State
    document_count: Int
    size_bytes: Int
    
    # Timestamps
    created_at: Timestamp
    updated_at: Timestamp
    last_indexed_at: Timestamp?
  }
  
  type FieldMapping = {
    name: String
    type: FieldType
    
    # Indexing options
    index: Boolean = true
    store: Boolean = false
    
    # Text analysis
    analyzer: String?
    search_analyzer: String?
    
    # Nested/Object
    properties: List<FieldMapping>?
    
    # Options
    boost: Float?
    null_value: Any?
    
    # Faceting
    facetable: Boolean = false
    sortable: Boolean = false
    filterable: Boolean = true
  }
  
  enum FieldType {
    # Text
    TEXT        { analyzed: true }
    KEYWORD     { analyzed: false }
    
    # Numeric
    INTEGER
    LONG
    FLOAT
    DOUBLE
    
    # Date/Time
    DATE
    DATETIME
    
    # Boolean
    BOOLEAN
    
    # Complex
    OBJECT
    NESTED
    ARRAY
    
    # Geo
    GEO_POINT
    GEO_SHAPE
    
    # Special
    COMPLETION  # Autocomplete
    DENSE_VECTOR
    SPARSE_VECTOR
  }
  
  type IndexSettings = {
    number_of_shards: Int = 1
    number_of_replicas: Int = 1
    refresh_interval: Duration = 1.second
    
    analysis: {
      analyzers: Map<String, Analyzer>?
      tokenizers: Map<String, Tokenizer>?
      filters: Map<String, TokenFilter>?
    }?
  }
  
  type Analyzer = {
    type: String
    tokenizer: String?
    filters: List<String>?
    char_filters: List<String>?
  }
  
  type Tokenizer = {
    type: String
    pattern: String?
    min_gram: Int?
    max_gram: Int?
  }
  
  type TokenFilter = {
    type: String
    stopwords: List<String>?
    synonyms: List<String>?
  }
  
  # ============================================
  # Query DSL
  # ============================================
  
  abstract type Query {
    boost: Float?
  }
  
  # Full-text queries
  type MatchQuery extends Query {
    field: String
    query: String
    operator: MatchOperator = OR
    fuzziness: Fuzziness?
    minimum_should_match: String?
  }
  
  type MultiMatchQuery extends Query {
    fields: List<String>
    query: String
    type: MultiMatchType = BEST_FIELDS
    tie_breaker: Float?
  }
  
  type QueryStringQuery extends Query {
    query: String
    default_field: String?
    default_operator: MatchOperator = OR
    allow_leading_wildcard: Boolean = true
  }
  
  # Term-level queries
  type TermQuery extends Query {
    field: String
    value: Any
  }
  
  type TermsQuery extends Query {
    field: String
    values: List<Any>
  }
  
  type RangeQuery extends Query {
    field: String
    gt: Any?
    gte: Any?
    lt: Any?
    lte: Any?
  }
  
  type ExistsQuery extends Query {
    field: String
  }
  
  type PrefixQuery extends Query {
    field: String
    value: String
  }
  
  type WildcardQuery extends Query {
    field: String
    value: String  # * and ? wildcards
  }
  
  type FuzzyQuery extends Query {
    field: String
    value: String
    fuzziness: Fuzziness
  }
  
  type RegexpQuery extends Query {
    field: String
    value: String
    flags: String?
  }
  
  # Compound queries
  type BoolQuery extends Query {
    must: List<Query>?
    should: List<Query>?
    must_not: List<Query>?
    filter: List<Query>?
    minimum_should_match: Int?
  }
  
  type BoostingQuery extends Query {
    positive: Query
    negative: Query
    negative_boost: Float
  }
  
  type ConstantScoreQuery extends Query {
    filter: Query
    score: Float
  }
  
  type DisMaxQuery extends Query {
    queries: List<Query>
    tie_breaker: Float = 0.0
  }
  
  # Geo queries
  type GeoDistanceQuery extends Query {
    field: String
    location: GeoPoint
    distance: Distance
  }
  
  type GeoBoundingBoxQuery extends Query {
    field: String
    top_left: GeoPoint
    bottom_right: GeoPoint
  }
  
  # Vector queries (semantic search)
  type KnnQuery extends Query {
    field: String
    query_vector: List<Float>
    k: Int
    num_candidates: Int?
  }
  
  type GeoPoint = {
    lat: Float
    lon: Float
  }
  
  type Distance = {
    value: Float
    unit: DistanceUnit
  }
  
  enum DistanceUnit {
    METERS
    KILOMETERS
    MILES
    FEET
  }
  
  enum MatchOperator {
    AND
    OR
  }
  
  enum MultiMatchType {
    BEST_FIELDS
    MOST_FIELDS
    CROSS_FIELDS
    PHRASE
    PHRASE_PREFIX
  }
  
  enum Fuzziness {
    AUTO
    ZERO = 0
    ONE = 1
    TWO = 2
  }
  
  # ============================================
  # Search Request/Response
  # ============================================
  
  type SearchRequest = {
    index: IndexId
    query: Query
    
    # Pagination
    from: Int = 0
    size: Int = 10
    
    # Sorting
    sort: List<SortField>?
    
    # Aggregations/Facets
    aggregations: Map<String, Aggregation>?
    
    # Highlighting
    highlight: HighlightConfig?
    
    # Source filtering
    source: SourceFilter?
    
    # Suggestions
    suggest: Map<String, Suggester>?
    
    # Options
    track_total_hits: Boolean | Int = true
    explain: Boolean = false
    timeout: Duration?
  }
  
  type SearchResponse = {
    took_ms: Int
    timed_out: Boolean
    
    hits: {
      total: {
        value: Int
        relation: TotalRelation
      }
      max_score: Score?
      hits: List<SearchHit>
    }
    
    aggregations: Map<String, AggregationResult>?
    suggest: Map<String, List<Suggestion>>?
  }
  
  type SearchHit = {
    id: DocumentId
    index: IndexId
    score: Score?
    source: Map<String, Any>?
    highlight: Map<String, List<String>>?
    sort: List<Any>?
    explanation: Explanation?
  }
  
  enum TotalRelation {
    EQ   # Exact count
    GTE  # Lower bound (>= this many)
  }
  
  # ============================================
  # Sorting
  # ============================================
  
  type SortField = {
    field: String
    order: SortOrder = ASC
    mode: SortMode?
    missing: SortMissing?
    unmapped_type: FieldType?
  }
  
  enum SortOrder {
    ASC
    DESC
  }
  
  enum SortMode {
    MIN
    MAX
    SUM
    AVG
    MEDIAN
  }
  
  enum SortMissing {
    FIRST
    LAST
  }
  
  # ============================================
  # Aggregations (Facets)
  # ============================================
  
  abstract type Aggregation { }
  
  # Bucket aggregations
  type TermsAggregation extends Aggregation {
    field: String
    size: Int = 10
    min_doc_count: Int = 1
    order: Map<String, SortOrder>?
    include: String | List<String>?
    exclude: String | List<String>?
  }
  
  type RangeAggregation extends Aggregation {
    field: String
    ranges: List<{
      key: String?
      from: Any?
      to: Any?
    }>
  }
  
  type DateHistogramAggregation extends Aggregation {
    field: String
    calendar_interval: CalendarInterval?
    fixed_interval: Duration?
    format: String?
    time_zone: String?
    min_doc_count: Int = 0
  }
  
  type HistogramAggregation extends Aggregation {
    field: String
    interval: Float
    offset: Float?
    min_doc_count: Int = 0
  }
  
  type FilterAggregation extends Aggregation {
    filter: Query
  }
  
  type NestedAggregation extends Aggregation {
    path: String
  }
  
  # Metric aggregations
  type AvgAggregation extends Aggregation {
    field: String
  }
  
  type SumAggregation extends Aggregation {
    field: String
  }
  
  type MinAggregation extends Aggregation {
    field: String
  }
  
  type MaxAggregation extends Aggregation {
    field: String
  }
  
  type StatsAggregation extends Aggregation {
    field: String
  }
  
  type CardinalityAggregation extends Aggregation {
    field: String
    precision_threshold: Int?
  }
  
  enum CalendarInterval {
    MINUTE
    HOUR
    DAY
    WEEK
    MONTH
    QUARTER
    YEAR
  }
  
  type AggregationResult = {
    buckets: List<Bucket>?
    value: Any?
    doc_count: Int?
  }
  
  type Bucket = {
    key: Any
    key_as_string: String?
    doc_count: Int
    aggregations: Map<String, AggregationResult>?
  }
  
  # ============================================
  # Highlighting
  # ============================================
  
  type HighlightConfig = {
    fields: Map<String, HighlightField>
    pre_tags: List<String>?
    post_tags: List<String>?
    encoder: HighlightEncoder?
    type: HighlighterType?
    number_of_fragments: Int?
    fragment_size: Int?
  }
  
  type HighlightField = {
    pre_tags: List<String>?
    post_tags: List<String>?
    number_of_fragments: Int?
    fragment_size: Int?
  }
  
  enum HighlightEncoder {
    DEFAULT
    HTML
  }
  
  enum HighlighterType {
    UNIFIED
    PLAIN
    FVH
  }
  
  # ============================================
  # Suggestions (Autocomplete)
  # ============================================
  
  type Suggester = {
    text: String
    term: TermSuggester?
    phrase: PhraseSuggester?
    completion: CompletionSuggester?
  }
  
  type TermSuggester = {
    field: String
    size: Int?
    suggest_mode: SuggestMode?
  }
  
  type PhraseSuggester = {
    field: String
    size: Int?
    gram_size: Int?
    highlight: { pre_tag: String, post_tag: String }?
  }
  
  type CompletionSuggester = {
    field: String
    size: Int?
    skip_duplicates: Boolean?
    fuzzy: FuzzyConfig?
    contexts: Map<String, Any>?
  }
  
  type FuzzyConfig = {
    fuzziness: Fuzziness
    transpositions: Boolean?
    min_length: Int?
    prefix_length: Int?
  }
  
  enum SuggestMode {
    MISSING
    POPULAR
    ALWAYS
  }
  
  type Suggestion = {
    text: String
    offset: Int
    length: Int
    options: List<{
      text: String
      score: Score
      highlighted: String?
    }>
  }
  
  # ============================================
  # Source Filtering
  # ============================================
  
  type SourceFilter = {
    includes: List<String>?
    excludes: List<String>?
  } | Boolean
  
  type Explanation = {
    value: Float
    description: String
    details: List<Explanation>?
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior Search {
    description: "Execute a search query"
    
    input {
      request: SearchRequest
    }
    
    output {
      success: SearchResponse
      errors {
        INDEX_NOT_FOUND { }
        QUERY_PARSE_ERROR {
          fields { message: String, position: Int? }
        }
        TIMEOUT { }
      }
    }
    
    temporal {
      within 1.second (p95): search completes
    }
  }
  
  behavior IndexDocument {
    description: "Index a document"
    
    input {
      index: IndexId
      id: DocumentId?
      document: Map<String, Any>
      refresh: RefreshPolicy = FALSE
    }
    
    output {
      success: {
        id: DocumentId
        version: Int
        result: IndexResult
      }
      errors {
        INDEX_NOT_FOUND { }
        MAPPING_ERROR {
          when: "Document doesn't match index mapping"
        }
      }
    }
    
    effects {
      creates or updates document in index
    }
  }
  
  behavior BulkIndex {
    description: "Index multiple documents"
    
    input {
      operations: List<BulkOperation> [max_length: 10000]
      refresh: RefreshPolicy = FALSE
    }
    
    output {
      success: {
        took_ms: Int
        errors: Boolean
        items: List<BulkItemResponse>
      }
    }
  }
  
  behavior DeleteDocument {
    input {
      index: IndexId
      id: DocumentId
    }
    
    output {
      success: { result: DeleteResult }
      errors {
        NOT_FOUND { }
      }
    }
  }
  
  behavior CreateIndex {
    input {
      name: IndexId
      mappings: List<FieldMapping>
      settings: IndexSettings?
    }
    
    output {
      success: { index: SearchIndex }
      errors {
        INDEX_EXISTS { }
        INVALID_MAPPING { }
      }
    }
  }
  
  enum RefreshPolicy {
    TRUE
    FALSE
    WAIT_FOR
  }
  
  enum IndexResult {
    CREATED
    UPDATED
    NOOP
  }
  
  enum DeleteResult {
    DELETED
    NOT_FOUND
  }
  
  type BulkOperation = {
    action: BulkAction
    index: IndexId
    id: DocumentId?
    document: Map<String, Any>?
  }
  
  enum BulkAction {
    INDEX
    CREATE
    UPDATE
    DELETE
  }
  
  type BulkItemResponse = {
    action: BulkAction
    index: IndexId
    id: DocumentId
    status: Int
    error: String?
  }
}
