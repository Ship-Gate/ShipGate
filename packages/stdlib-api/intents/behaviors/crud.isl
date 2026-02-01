# CRUD Behaviors for API Resources

# ============================================
# List Resources
# ============================================

behavior ListResources<T> {
  description: "Retrieve a paginated list of resources"
  
  input {
    # Pagination
    page: Int? = 1 [min: 1]
    page_size: Int? = 20 [min: 1, max: 100]
    cursor: String?
    
    # Sorting
    sort_by: String?
    sort_order: SortOrder? = ASC
    
    # Filtering
    filters: Map<String, Any>?
    
    # Field selection
    fields: List<String>?
    
    # Expansion
    include: List<String>?
  }
  
  output {
    success: {
      data: List<T>
      pagination: {
        total: Int
        page: Int
        page_size: Int
        total_pages: Int
        has_next: Boolean
        has_previous: Boolean
        next_cursor: String?
      }
      meta: {
        request_id: String
        timestamp: Timestamp
      }
    }
    errors {
      INVALID_FILTER {
        when: "Filter field or value is invalid"
        fields { field: String, reason: String }
      }
      INVALID_SORT {
        when: "Sort field is not sortable"
      }
    }
  }
  
  postconditions {
    success implies {
      result.data.length <= input.page_size
      result.pagination.page == input.page
    }
  }
  
  temporal {
    within 500ms (p95): response returned
  }
}

# ============================================
# Get Single Resource
# ============================================

behavior GetResource<T> {
  description: "Retrieve a single resource by ID"
  
  input {
    id: UUID
    fields: List<String>?
    include: List<String>?
  }
  
  output {
    success: {
      data: T
      meta: {
        request_id: String
        timestamp: Timestamp
        etag: String?
      }
    }
    errors {
      NOT_FOUND {
        status: 404
        when: "Resource does not exist"
      }
      FORBIDDEN {
        status: 403
        when: "User lacks permission to view resource"
      }
    }
  }
  
  postconditions {
    success implies {
      result.data.id == input.id
    }
  }
  
  temporal {
    within 100ms (p95): response returned
  }
  
  caching {
    etag: true
    max_age: 5.minutes
    vary: ["Authorization"]
  }
}

# ============================================
# Create Resource
# ============================================

behavior CreateResource<T, TInput> {
  description: "Create a new resource"
  
  input {
    data: TInput
    idempotency_key: String?
  }
  
  output {
    success: {
      data: T
      meta: {
        request_id: String
        timestamp: Timestamp
        location: URL
      }
    }
    errors {
      VALIDATION_ERROR {
        status: 422
        when: "Input validation failed"
        fields { errors: List<ValidationError> }
      }
      CONFLICT {
        status: 409
        when: "Resource already exists"
        fields { existing_id: UUID? }
      }
      FORBIDDEN {
        status: 403
        when: "User lacks permission to create"
      }
    }
  }
  
  preconditions {
    input.data is valid
  }
  
  postconditions {
    success implies {
      T.exists(result.data.id)
      result.data.created_at != null
    }
  }
  
  effects {
    creates T
    emits ResourceCreated<T>
  }
  
  idempotency {
    key: input.idempotency_key
    ttl: 24.hours
  }
}

# ============================================
# Update Resource (Full)
# ============================================

behavior UpdateResource<T, TInput> {
  description: "Fully update an existing resource"
  
  input {
    id: UUID
    data: TInput
    if_match: String?  # ETag for optimistic locking
  }
  
  output {
    success: {
      data: T
      meta: {
        request_id: String
        timestamp: Timestamp
        etag: String
      }
    }
    errors {
      NOT_FOUND { status: 404 }
      VALIDATION_ERROR { status: 422 }
      CONFLICT {
        status: 409
        when: "Concurrent modification detected"
        fields { current_etag: String }
      }
      PRECONDITION_FAILED {
        status: 412
        when: "If-Match header doesn't match"
      }
    }
  }
  
  preconditions {
    T.exists(input.id)
    input.if_match == null or input.if_match == current_etag
  }
  
  postconditions {
    success implies {
      result.data.id == input.id
      result.data.updated_at > old(result.data.updated_at)
    }
  }
  
  effects {
    updates T
    emits ResourceUpdated<T>
  }
}

# ============================================
# Patch Resource (Partial)
# ============================================

behavior PatchResource<T> {
  description: "Partially update an existing resource"
  
  input {
    id: UUID
    operations: List<PatchOperation>
    if_match: String?
  }
  
  output {
    success: { data: T }
    errors {
      NOT_FOUND { status: 404 }
      INVALID_PATCH {
        status: 422
        when: "Patch operation is invalid"
        fields { operation: PatchOperation, reason: String }
      }
      CONFLICT { status: 409 }
    }
  }
  
  preconditions {
    T.exists(input.id)
    input.operations.all(op => op.is_valid_for(T))
  }
  
  effects {
    updates T with operations
    emits ResourcePatched<T>
  }
}

type PatchOperation = {
  op: PatchOp
  path: String
  value: Any?
  from: String?
}

enum PatchOp {
  ADD
  REMOVE
  REPLACE
  MOVE
  COPY
  TEST
}

# ============================================
# Delete Resource
# ============================================

behavior DeleteResource<T> {
  description: "Delete a resource"
  
  input {
    id: UUID
    soft: Boolean = true  # Soft delete by default
    if_match: String?
  }
  
  output {
    success: {
      meta: {
        request_id: String
        timestamp: Timestamp
        soft_deleted: Boolean
      }
    }
    errors {
      NOT_FOUND { status: 404 }
      FORBIDDEN { status: 403 }
      CONFLICT {
        status: 409
        when: "Resource has dependent resources"
        fields { dependents: List<String> }
      }
    }
  }
  
  preconditions {
    T.exists(input.id)
    not T.has_dependents or input.cascade == true
  }
  
  postconditions {
    success and input.soft implies {
      T.exists(input.id) and T.deleted_at != null
    }
    success and not input.soft implies {
      not T.exists(input.id)
    }
  }
  
  effects {
    soft_deletes T when input.soft
    hard_deletes T when not input.soft
    emits ResourceDeleted<T>
  }
}

# ============================================
# Bulk Operations
# ============================================

behavior BulkCreate<T, TInput> {
  description: "Create multiple resources in a single request"
  
  input {
    items: List<TInput> [min_length: 1, max_length: 100]
    stop_on_error: Boolean = false
  }
  
  output {
    success: {
      created: List<T>
      failed: List<{
        index: Int
        error: String
        data: TInput
      }>
      meta: {
        total: Int
        succeeded: Int
        failed: Int
      }
    }
  }
  
  postconditions {
    result.meta.succeeded + result.meta.failed == input.items.length
  }
  
  temporal {
    within 5.seconds: all items processed
  }
}

behavior BulkUpdate<T, TInput> {
  description: "Update multiple resources"
  
  input {
    updates: List<{ id: UUID, data: TInput }> [max_length: 100]
  }
  
  output {
    success: {
      updated: List<T>
      failed: List<{ id: UUID, error: String }>
    }
  }
}

behavior BulkDelete<T> {
  description: "Delete multiple resources"
  
  input {
    ids: List<UUID> [min_length: 1, max_length: 100]
    soft: Boolean = true
  }
  
  output {
    success: {
      deleted: List<UUID>
      failed: List<{ id: UUID, error: String }>
    }
  }
}

# ============================================
# Helper Types
# ============================================

type ValidationError = {
  field: String
  code: String
  message: String
  value: Any?
}

enum SortOrder {
  ASC
  DESC
}
