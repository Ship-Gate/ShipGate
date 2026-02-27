# Search and Query Module
# Provides full-text search and advanced query patterns

module StorageSearch version "1.0.0"

# ============================================
# Types
# ============================================

type SearchQuery = String {
  description: "Full-text search query"
  max_length: 1024
}

type SearchScoreMode = enum {
  RELEVANCE
  RECENCY
  POPULARITY
  CUSTOM
}

type IndexType = enum {
  FULL_TEXT
  KEYWORD
  NUMERIC
  DATE
  GEO
  VECTOR
}

type FacetType = enum {
  TERMS
  RANGE
  DATE_HISTOGRAM
  NESTED
}

# ============================================
# Entities
# ============================================

entity SearchResult {
  id: String
  score: Decimal { min: 0 }
  highlights: Map<String, List<String>>?
  source: Map<String, String>

  invariants {
    score >= 0
  }
}

entity SearchFacet {
  field: String
  type: FacetType
  buckets: List<FacetBucket>
}

entity FacetBucket {
  key: String
  count: Int { min: 0 }
  label: String?
}

entity SearchSuggestion {
  text: String
  score: Decimal { min: 0 }
  source: String?
}

entity SearchIndex {
  name: String { max_length: 128 }
  fields: List<SearchIndexField>
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  document_count: Int { min: 0 }
}

entity SearchIndexField {
  name: String { max_length: 64 }
  type: IndexType
  searchable: Boolean [default: true]
  sortable: Boolean [default: false]
  filterable: Boolean [default: true]
  boost: Decimal { min: 0, default: 1.0 }
}

# ============================================
# Behaviors
# ============================================

behavior Search {
  description: "Execute a full-text search query"

  input {
    query: SearchQuery
    index: String?
    filters: List<Map<String, String>>?
    facets: List<String>?
    sort_by: SearchScoreMode [default: RELEVANCE]
    limit: Int { min: 1, max: 100, default: 20 }
    offset: Int { min: 0, default: 0 }
    highlight: Boolean [default: true]
  }

  output {
    success: {
      results: List<SearchResult>
      total_count: Int
      facets: List<SearchFacet>?
      query_time_ms: Int
    }

    errors {
      INVALID_QUERY {
        when: "Search query syntax is invalid"
        retriable: false
      }
      INDEX_NOT_FOUND {
        when: "Search index does not exist"
        retriable: false
      }
      QUERY_TIMEOUT {
        when: "Search query exceeded time limit"
        retriable: true
        retry_after: 2s
      }
    }
  }

  pre {
    query.length > 0
    limit >= 1 and limit <= 100
  }

  post success {
    result.results.length <= input.limit
    result.total_count >= result.results.length
    result.query_time_ms >= 0
    input.highlight implies forall r in result.results:
      r.score >= 0
  }

  temporal {
    within 500ms (p99): response returned
  }
}

behavior Suggest {
  description: "Get search suggestions (autocomplete)"

  input {
    prefix: String { min_length: 1, max_length: 256 }
    index: String?
    limit: Int { min: 1, max: 20, default: 5 }
  }

  output {
    success: List<SearchSuggestion>
  }

  pre {
    prefix.length >= 1
  }

  post success {
    result.length <= input.limit
    forall s in result:
      s.score >= 0
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior IndexDocument {
  description: "Index a document for search"

  input {
    index: String
    id: String
    document: Map<String, String>
    refresh: Boolean [default: false]
  }

  output {
    success: {
      indexed: Boolean
      version: Int
    }

    errors {
      INDEX_NOT_FOUND {
        when: "Target index does not exist"
        retriable: false
      }
      VALIDATION_ERROR {
        when: "Document does not match index schema"
        retriable: false
      }
    }
  }

  post success {
    result.indexed == true
    result.version >= 1
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior DeleteFromIndex {
  description: "Remove a document from search index"

  input {
    index: String
    id: String
    refresh: Boolean [default: false]
  }

  output {
    success: Boolean

    errors {
      NOT_FOUND {
        when: "Document not found in index"
        retriable: false
      }
    }
  }

  post success {
    result == true
  }
}

behavior ReindexAll {
  description: "Rebuild search index from source data"

  input {
    index: String
    batch_size: Int { min: 100, max: 10000, default: 1000 }
  }

  output {
    success: {
      indexed_count: Int
      error_count: Int
      duration_ms: Int
    }

    errors {
      INDEX_NOT_FOUND {
        when: "Target index does not exist"
        retriable: false
      }
      REINDEX_IN_PROGRESS {
        when: "Another reindex is already running"
        retriable: true
        retry_after: 60s
      }
    }
  }

  post success {
    result.indexed_count >= 0
    result.error_count >= 0
    result.duration_ms >= 0
  }
}
