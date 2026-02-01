# Search Domain
# Full-text search with filters, facets, and suggestions

domain Search {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type SearchQuery = String { max_length: 500 }
  
  enum SortOrder {
    RELEVANCE
    DATE_ASC
    DATE_DESC
    POPULARITY
    ALPHABETICAL
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity SearchIndex {
    id: UUID [immutable, unique]
    name: String [unique, indexed]
    document_type: String
    mappings: Map<String, {
      type: String
      searchable: Boolean
      filterable: Boolean
      sortable: Boolean
      boost: Decimal?
    }>
    settings: Map<String, Any>
    document_count: Int [default: 0]
    last_indexed_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity SearchDocument {
    id: UUID [immutable, unique]
    index_name: String [indexed]
    document_id: String [indexed]
    content: Map<String, Any>
    indexed_at: Timestamp [indexed]
    updated_at: Timestamp
    
    invariants {
      (index_name, document_id) is unique
    }
  }
  
  entity SearchLog {
    id: UUID [immutable, unique]
    user_id: UUID? [indexed]
    query: SearchQuery [indexed]
    index_name: String
    filters: Map<String, Any>?
    results_count: Int
    clicked_result: String?
    session_id: UUID?
    created_at: Timestamp [immutable, indexed]
  }
  
  entity SavedSearch {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    name: String
    query: SearchQuery
    filters: Map<String, Any>?
    notify_on_new: Boolean [default: false]
    last_notified_at: Timestamp?
    created_at: Timestamp [immutable]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior Search {
    description: "Execute a search query"
    
    actors {
      Anonymous { }
      User { must: authenticated }
    }
    
    input {
      query: SearchQuery
      index: String?
      filters: Map<String, Any>?
      facets: List<String>?
      sort: SortOrder [default: RELEVANCE]
      page: Int [default: 1]
      per_page: Int [default: 20, max: 100]
      highlight: Boolean [default: true]
      min_score: Decimal?
    }
    
    output {
      success: {
        results: List<{
          id: String
          score: Decimal
          document: Map<String, Any>
          highlights: Map<String, List<String>>?
        }>
        total_count: Int
        page: Int
        total_pages: Int
        facets: Map<String, List<{
          value: String
          count: Int
        }>>?
        suggestions: List<String>?
        took_ms: Int
      }
    }
    
    postconditions {
      success implies {
        SearchLog.created
      }
    }
    
    temporal {
      response within 100ms (p50)
      response within 500ms (p99)
    }
  }
  
  behavior Autocomplete {
    description: "Get search suggestions as user types"
    
    actors {
      Anonymous { }
      User { must: authenticated }
    }
    
    input {
      prefix: String { min_length: 2 }
      index: String?
      limit: Int [default: 10]
    }
    
    output {
      success: {
        suggestions: List<{
          text: String
          type: String?
          metadata: Map<String, Any>?
        }>
      }
    }
    
    temporal {
      response within 50ms (p99)
    }
  }
  
  behavior IndexDocument {
    description: "Add or update a document in the search index"
    
    actors {
      System { }
    }
    
    input {
      index: String
      document_id: String
      content: Map<String, Any>
    }
    
    output {
      success: SearchDocument
      
      errors {
        INDEX_NOT_FOUND {
          when: "Search index does not exist"
          retriable: false
        }
        INVALID_DOCUMENT {
          when: "Document does not match index mappings"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        SearchDocument.exists(index_name: input.index, document_id: input.document_id)
      }
    }
  }
  
  behavior BulkIndex {
    description: "Index multiple documents at once"
    
    actors {
      System { }
    }
    
    input {
      index: String
      documents: List<{
        id: String
        content: Map<String, Any>
      }>
    }
    
    output {
      success: {
        indexed: Int
        failed: Int
        errors: List<{
          id: String
          error: String
        }>?
      }
    }
  }
  
  behavior DeleteDocument {
    description: "Remove a document from the search index"
    
    actors {
      System { }
    }
    
    input {
      index: String
      document_id: String
    }
    
    output {
      success: Boolean
    }
    
    postconditions {
      success implies {
        not SearchDocument.exists(index_name: input.index, document_id: input.document_id)
      }
    }
  }
  
  behavior CreateIndex {
    description: "Create a new search index"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      name: String
      document_type: String
      mappings: Map<String, {
        type: String
        searchable: Boolean?
        filterable: Boolean?
        sortable: Boolean?
        boost: Decimal?
      }>
      settings: Map<String, Any>?
    }
    
    output {
      success: SearchIndex
      
      errors {
        INDEX_EXISTS {
          when: "Index already exists"
          retriable: false
        }
        INVALID_MAPPINGS {
          when: "Mappings configuration is invalid"
          retriable: false
        }
      }
    }
  }
  
  behavior SaveSearch {
    description: "Save a search for later"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      name: String
      query: SearchQuery
      filters: Map<String, Any>?
      notify_on_new: Boolean?
    }
    
    output {
      success: SavedSearch
    }
  }
  
  behavior GetSearchAnalytics {
    description: "Get search analytics and trends"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      from_date: Timestamp?
      to_date: Timestamp?
    }
    
    output {
      success: {
        total_searches: Int
        unique_queries: Int
        zero_result_queries: List<{
          query: String
          count: Int
        }>
        popular_queries: List<{
          query: String
          count: Int
        }>
        click_through_rate: Decimal
        average_results_count: Decimal
      }
    }
  }
  
  behavior Reindex {
    description: "Rebuild the entire search index"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      index: String
    }
    
    output {
      success: {
        documents_indexed: Int
        duration_seconds: Int
      }
    }
    
    temporal {
      eventually: reindex_complete
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios Search {
    scenario "basic text search" {
      when {
        result = Search(
          query: "machine learning",
          index: "articles",
          per_page: 10
        )
      }
      
      then {
        result is success
        result.results.length <= 10
        result.took_ms < 500
      }
    }
    
    scenario "search with filters and facets" {
      when {
        result = Search(
          query: "python",
          filters: { category: "tutorials", year: 2024 },
          facets: ["author", "tags"],
          sort: DATE_DESC
        )
      }
      
      then {
        result is success
        result.facets != null
        result.facets["author"] != null
      }
    }
  }
}
