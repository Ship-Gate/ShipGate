// Search: Full-text search
domain SearchFullText {
  version: "1.0.0"

  enum SortOrder {
    RELEVANCE
    NEWEST
    OLDEST
    ALPHABETICAL
  }

  type SearchResult = {
    id: UUID
    type: String
    title: String
    snippet: String
    score: Decimal
    highlights: List<String>
    url: String?
  }

  type SearchSuggestion = {
    text: String
    score: Decimal
    frequency: Int
  }

  behavior Search {
    description: "Full-text search across content"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      query: String
      types: List<String>?
      filters: Map<String, String>?
      sort: SortOrder?
      page: Int?
      page_size: Int?
      highlight: Boolean?
      fuzzy: Boolean?
    }

    output {
      success: {
        results: List<SearchResult>
        total_count: Int
        page: Int
        page_size: Int
        has_more: Boolean
        query_time_ms: Int
        suggestions: List<String>?
      }

      errors {
        INVALID_QUERY {
          when: "Query syntax is invalid"
          retriable: true
        }
        QUERY_TOO_LONG {
          when: "Query exceeds maximum length"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many search requests"
          retriable: true
          retry_after: 1s
        }
      }
    }

    pre {
      input.query.length > 0
      input.query.length <= 500
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
    }

    post success {
      - result.results.length <= result.page_size
      - result.query_time_ms >= 0
      - input.highlight == true implies all(r in result.results: r.highlights.length > 0 or r.snippet.length > 0)
    }

    temporal {
      - within 200ms (p50): response returned
      - within 500ms (p99): response returned
    }

    security {
      - rate_limit 60 per minute per user
      - rate_limit 600 per minute per ip_address
    }
  }

  behavior Autocomplete {
    description: "Search autocomplete suggestions"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      prefix: String
      types: List<String>?
      limit: Int?
    }

    output {
      success: List<SearchSuggestion>

      errors {
        PREFIX_TOO_SHORT {
          when: "Prefix too short"
          retriable: true
        }
      }
    }

    pre {
      input.prefix.length >= 2
      input.limit == null or (input.limit >= 1 and input.limit <= 20)
    }

    post success {
      - result.length <= (input.limit or 10)
    }

    temporal {
      - within 50ms (p50): response returned
      - within 100ms (p99): response returned
    }
  }

  behavior SearchSuggest {
    description: "Did you mean suggestions"

    actors {
      System { }
    }

    input {
      query: String
    }

    output {
      success: List<String>
    }

    pre {
      input.query.length > 0
    }
  }

  behavior ReindexContent {
    description: "Reindex content for search"

    actors {
      Admin { must: authenticated }
      System { }
    }

    input {
      type: String?
      ids: List<UUID>?
      full_reindex: Boolean?
    }

    output {
      success: {
        indexed_count: Int
        failed_count: Int
        duration_ms: Int
      }

      errors {
        REINDEX_IN_PROGRESS {
          when: "Reindex already in progress"
          retriable: true
          retry_after: 5m
        }
      }
    }

    temporal {
      - eventually within 1h: reindex complete
    }
  }

  scenarios Search {
    scenario "basic search" {
      when {
        result = Search(
          query: "javascript tutorial",
          page: 1,
          page_size: 10
        )
      }

      then {
        result is success
        result.query_time_ms < 500
      }
    }

    scenario "search with filters" {
      when {
        result = Search(
          query: "machine learning",
          types: ["Post", "Tutorial"],
          filters: { "status": "published", "language": "en" },
          sort: RELEVANCE,
          highlight: true
        )
      }

      then {
        result is success
      }
    }
  }
}
