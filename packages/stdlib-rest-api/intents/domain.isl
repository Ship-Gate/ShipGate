domain RestAPI {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type ResourceId = UUID | String
  type QueryString = String
  type HeaderName = String
  type HeaderValue = String
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum HttpMethod {
    GET
    POST
    PUT
    PATCH
    DELETE
    HEAD
    OPTIONS
  }
  
  enum HttpStatus {
    OK = 200
    CREATED = 201
    NO_CONTENT = 204
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    UNPROCESSABLE_ENTITY = 422
    INTERNAL_SERVER_ERROR = 500
  }
  
  // ============================================================================
  // ENTITIES
  // ============================================================================
  
  entity ApiResource {
    id: ResourceId [immutable, unique, indexed]
    
    // Resource metadata
    resource_type: String [indexed]
    version: String?
    
    // Content
    data: Map<String, Any>
    
    // Timestamps
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    deleted_at: Timestamp?
    
    invariants {
      deleted_at == null or deleted_at >= created_at
    }
  }
  
  // ============================================================================
  // BEHAVIORS
  // ============================================================================
  
  behavior ListResources {
    description: "List resources with pagination and filtering"
    
    input {
      resource_type: String
      page: Int?
      page_size: Int?
      sort: String?
      filter: Map<String, Any>?
      fields: List<String>?
    }
    
    output {
      success: {
        items: List<ApiResource>
        pagination: PaginationMeta
      }
      errors {
        INVALID_PAGE { when: "Page number is invalid" }
        INVALID_PAGE_SIZE { when: "Page size exceeds maximum" }
        INVALID_SORT { when: "Sort field is invalid" }
        INVALID_FILTER { when: "Filter is invalid" }
      }
    }
    
    preconditions {
      input.page == null or input.page > 0
      input.page_size == null or (input.page_size > 0 and input.page_size <= 100)
    }
    
    postconditions {
      success implies {
        result.items.length <= (input.page_size ?? 10)
        result.pagination.page == (input.page ?? 1)
      }
    }
    
    temporal {
      response within 500.ms (p99)
    }
  }
  
  behavior GetResource {
    description: "Get a single resource by ID"
    
    input {
      resource_type: String
      resource_id: ResourceId
      fields: List<String>?
    }
    
    output {
      success: ApiResource
      errors {
        RESOURCE_NOT_FOUND { when: "Resource does not exist" }
        RESOURCE_DELETED { when: "Resource has been deleted" }
      }
    }
    
    postconditions {
      success implies {
        result.id == input.resource_id
        result.resource_type == input.resource_type
        result.deleted_at == null
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  behavior CreateResource {
    description: "Create a new resource"
    
    input {
      resource_type: String
      data: Map<String, Any>
    }
    
    output {
      success: ApiResource
      errors {
        VALIDATION_ERROR { when: "Input data validation failed", returns: { errors: List<ValidationError> } }
        CONFLICT { when: "Resource with same identifier already exists" }
      }
    }
    
    postconditions {
      success implies {
        ApiResource.exists(result.id)
        result.resource_type == input.resource_type
        result.created_at != null
      }
    }
    
    temporal {
      response within 200.ms (p99)
    }
  }
  
  behavior UpdateResource {
    description: "Update an existing resource"
    
    input {
      resource_type: String
      resource_id: ResourceId
      data: Map<String, Any>
      partial: Boolean?  // PATCH vs PUT
    }
    
    output {
      success: ApiResource
      errors {
        RESOURCE_NOT_FOUND { }
        VALIDATION_ERROR { returns: { errors: List<ValidationError> } }
        CONFLICT { when: "Update conflicts with current state" }
      }
    }
    
    preconditions {
      ApiResource.exists(id: input.resource_id, resource_type: input.resource_type)
    }
    
    postconditions {
      success implies {
        result.id == input.resource_id
        result.updated_at >= ApiResource.lookup(id: input.resource_id).updated_at
      }
    }
    
    temporal {
      response within 200.ms (p99)
    }
  }
  
  behavior DeleteResource {
    description: "Delete a resource (soft delete)"
    
    input {
      resource_type: String
      resource_id: ResourceId
      permanent: Boolean?  // Hard delete if true
    }
    
    output {
      success: { deleted: Boolean }
      errors {
        RESOURCE_NOT_FOUND { }
        ALREADY_DELETED { }
      }
    }
    
    preconditions {
      ApiResource.exists(id: input.resource_id, resource_type: input.resource_type)
    }
    
    postconditions {
      success implies {
        input.permanent implies {
          not ApiResource.exists(id: input.resource_id)
        }
        not input.permanent implies {
          ApiResource.lookup(id: input.resource_id).deleted_at != null
        }
      }
    }
    
    temporal {
      response within 200.ms (p99)
    }
  }
  
  behavior BatchCreate {
    description: "Create multiple resources in a single request"
    
    input {
      resource_type: String
      items: List<Map<String, Any>>
    }
    
    output {
      success: {
        created: List<ApiResource>
        failed: List<{ item: Map<String, Any>, error: String }>
      }
      errors {
        BATCH_TOO_LARGE { when: "Batch size exceeds maximum" }
      }
    }
    
    preconditions {
      input.items.length > 0
      input.items.length <= 100
    }
    
    temporal {
      response within 2.seconds (p99)
    }
  }
  
  behavior BatchUpdate {
    description: "Update multiple resources"
    
    input {
      resource_type: String
      updates: List<{ id: ResourceId, data: Map<String, Any> }>
    }
    
    output {
      success: {
        updated: List<ApiResource>
        failed: List<{ id: ResourceId, error: String }>
      }
    }
    
    preconditions {
      input.updates.length > 0
      input.updates.length <= 100
    }
  }
  
  behavior BatchDelete {
    description: "Delete multiple resources"
    
    input {
      resource_type: String
      resource_ids: List<ResourceId>
      permanent: Boolean?
    }
    
    output {
      success: {
        deleted: Int
        failed: List<{ id: ResourceId, error: String }>
      }
    }
    
    preconditions {
      input.resource_ids.length > 0
      input.resource_ids.length <= 100
    }
  }
  
  // ============================================================================
  // TYPES
  // ============================================================================
  
  type PaginationMeta = {
    page: Int
    page_size: Int
    total: Int
    total_pages: Int
    has_next: Boolean
    has_prev: Boolean
  }
  
  type ValidationError = {
    field: String
    message: String
    code: String
  }
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  policy RateLimiting {
    applies_to: [ListResources, GetResource, CreateResource, UpdateResource, DeleteResource]
    
    rules {
      // Per-endpoint rate limits
      ListResources: rate_limit 100/minute per ip
      GetResource: rate_limit 200/minute per ip
      CreateResource: rate_limit 50/minute per ip
      UpdateResource: rate_limit 50/minute per ip
      DeleteResource: rate_limit 20/minute per ip
    }
  }
  
  policy Versioning {
    applies_to: [ListResources, GetResource, CreateResource, UpdateResource]
    
    rules {
      // API version in header
      request.headers["API-Version"] != null
      request.headers["API-Version"] in supported_versions
    }
  }
  
  policy Caching {
    applies_to: [GetResource, ListResources]
    
    rules {
      // Cache GET requests
      response.headers["Cache-Control"] != null
      response.headers["ETag"] != null
    }
  }
}
