# Pagination Domain
# Cursor-based and offset-based pagination patterns

domain Pagination {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type Cursor = String { max_length: 255 }
  type PageSize = Int { min: 1, max: 100 }
  
  enum SortDirection {
    ASC
    DESC
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior ListWithCursor {
    description: "List items using cursor-based pagination"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      resource_type: String
      cursor: Cursor?
      limit: PageSize [default: 20]
      sort_by: String?
      sort_direction: SortDirection [default: DESC]
      filters: Map<String, Any>?
    }
    
    output {
      success: {
        items: List<Any>
        page_info: {
          has_next_page: Boolean
          has_previous_page: Boolean
          start_cursor: Cursor?
          end_cursor: Cursor?
        }
        total_count: Int?
      }
    }
    
    invariants {
      // Cursor encodes position, not sensitive data
      cursor is opaque to client
      // Stable results even with concurrent modifications
      items ordered consistently
    }
    
    temporal {
      response within 100ms (p99)
    }
  }
  
  behavior ListWithOffset {
    description: "List items using offset-based pagination"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      resource_type: String
      page: Int [default: 1, min: 1]
      per_page: PageSize [default: 20]
      sort_by: String?
      sort_direction: SortDirection [default: DESC]
      filters: Map<String, Any>?
    }
    
    output {
      success: {
        items: List<Any>
        pagination: {
          page: Int
          per_page: Int
          total_items: Int
          total_pages: Int
        }
      }
    }
    
    postconditions {
      success implies {
        result.items.length <= input.per_page
        result.pagination.total_pages == ceil(result.pagination.total_items / input.per_page)
      }
    }
  }
  
  behavior ListWithKeyset {
    description: "List items using keyset pagination (seek method)"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      resource_type: String
      after_id: UUID?
      after_value: Any?
      limit: PageSize [default: 20]
      sort_by: String
      sort_direction: SortDirection [default: DESC]
      filters: Map<String, Any>?
    }
    
    output {
      success: {
        items: List<Any>
        has_more: Boolean
        next_after_id: UUID?
        next_after_value: Any?
      }
    }
    
    invariants {
      // No skipped or duplicate items even with concurrent writes
      consistent ordering guaranteed
    }
  }
  
  behavior StreamItems {
    description: "Stream items for large datasets"
    
    actors {
      User { must: authenticated }
      System { }
    }
    
    input {
      resource_type: String
      batch_size: PageSize [default: 100]
      filters: Map<String, Any>?
    }
    
    output {
      success: {
        stream_id: UUID
        estimated_total: Int?
      }
    }
    
    temporal {
      streaming response
    }
  }
  
  behavior CountItems {
    description: "Get total count of items matching filters"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      resource_type: String
      filters: Map<String, Any>?
      exact: Boolean [default: false]
    }
    
    output {
      success: {
        count: Int
        is_estimate: Boolean
      }
    }
    
    temporal {
      input.exact == false implies response within 50ms
      input.exact == true implies response within 1s
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios ListWithCursor {
    scenario "first page" {
      when {
        result = ListWithCursor(
          resource_type: "posts",
          limit: 10
        )
      }
      
      then {
        result is success
        result.items.length <= 10
        result.page_info.has_previous_page == false
      }
    }
    
    scenario "navigate to next page" {
      given {
        first_page = ListWithCursor(resource_type: "posts", limit: 10)
      }
      
      when {
        result = ListWithCursor(
          resource_type: "posts",
          cursor: first_page.page_info.end_cursor,
          limit: 10
        )
      }
      
      then {
        result is success
        result.page_info.has_previous_page == true
        // No overlap with first page
        result.items.none(i => i in first_page.items)
      }
    }
  }
}
