/**
 * {{name}} API Domain
 * 
 * REST API contract specification template.
 */

domain {{pascalName}}API {
  // ─────────────────────────────────────────────────────────────────────────
  // Base Types
  // ─────────────────────────────────────────────────────────────────────────

  entity ApiResponse<T> {
    success: Boolean
    data: T?
    error: ApiError?
    meta: ResponseMeta
  }

  entity ApiError {
    code: String
    message: String
    details: Map<String, String>?
  }

  entity ResponseMeta {
    requestId: String
    timestamp: DateTime
    version: String
  }

  entity PaginationParams {
    page: Integer
    limit: Integer
    sortBy: String?
    sortOrder: "asc" | "desc"
  }

  entity PaginatedResponse<T> {
    items: List<T>
    pagination: PaginationMeta
  }

  entity PaginationMeta {
    page: Integer
    limit: Integer
    total: Integer
    totalPages: Integer
    hasNext: Boolean
    hasPrev: Boolean
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Entity
  // ─────────────────────────────────────────────────────────────────────────

  entity Resource {
    id: ID
    name: String
    description: String?
    status: ResourceStatus
    tags: List<String>
    createdAt: DateTime
    updatedAt: DateTime
    createdBy: ID
  }

  enum ResourceStatus {
    DRAFT
    ACTIVE
    ARCHIVED
    DELETED
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Behaviors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List resources with pagination and filtering
   */
  behavior ListResources {
    input {
      pagination: PaginationParams
      status: ResourceStatus?
      tags: List<String>?
    }
    
    output ApiResponse<PaginatedResponse<Resource>>
    
    preconditions {
      require input.pagination.page >= 1
      require input.pagination.limit >= 1 && input.pagination.limit <= 100
    }
    
    postconditions {
      ensure result.success implies result.data != null
      ensure result.success implies result.data.items.length <= input.pagination.limit
    }
    
    scenario "list first page" {
      given {
        pagination: { page: 1, limit: 10 }
      }
      then {
        result.success == true
        result.data.pagination.page == 1
      }
    }
  }

  /**
   * Get a single resource by ID
   */
  behavior GetResource {
    input {
      id: ID
    }
    
    output ApiResponse<Resource>
    
    postconditions {
      ensure result.success implies result.data?.id == input.id
      ensure !result.success implies result.error != null
    }
    
    scenario "existing resource" {
      given { id: "res_123" }
      then {
        result.success == true
        result.data?.id == "res_123"
      }
    }
    
    scenario "not found" {
      given { id: "res_nonexistent" }
      then {
        result.success == false
        result.error?.code == "NOT_FOUND"
      }
    }
  }

  /**
   * Create a new resource
   */
  behavior CreateResource {
    input {
      name: String
      description: String?
      tags: List<String>?
    }
    
    output ApiResponse<Resource>
    
    preconditions {
      require input.name.length > 0 as "Name is required"
      require input.name.length <= 255 as "Name too long"
    }
    
    postconditions {
      ensure result.success implies result.data?.name == input.name
      ensure result.success implies result.data?.status == ResourceStatus.DRAFT
    }
    
    scenario "create with valid data" {
      given {
        name: "My Resource"
        description: "A test resource"
      }
      then {
        result.success == true
        result.data?.name == "My Resource"
        result.data?.status == ResourceStatus.DRAFT
      }
    }
  }

  /**
   * Update an existing resource
   */
  behavior UpdateResource {
    input {
      id: ID
      name: String?
      description: String?
      status: ResourceStatus?
      tags: List<String>?
    }
    
    output ApiResponse<Resource>
    
    preconditions {
      require input.name == null || input.name.length > 0
      require input.name == null || input.name.length <= 255
    }
    
    postconditions {
      ensure result.success implies result.data?.id == input.id
      ensure result.success implies result.data?.updatedAt > old(result.data?.updatedAt)
    }
  }

  /**
   * Delete a resource (soft delete)
   */
  behavior DeleteResource {
    input {
      id: ID
      permanent: Boolean?
    }
    
    output ApiResponse<Boolean>
    
    postconditions {
      ensure result.success implies result.data == true
    }
    
    scenario "soft delete" {
      given { id: "res_123", permanent: false }
      then {
        result.success == true
        result.data == true
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Invariants
  // ─────────────────────────────────────────────────────────────────────────

  invariant "updatedAt >= createdAt" {
    forall r: Resource =>
      r.updatedAt >= r.createdAt
  }

  invariant "deleted resources have DELETED status" {
    forall r: Resource =>
      isDeleted(r) implies r.status == ResourceStatus.DELETED
  }
}
