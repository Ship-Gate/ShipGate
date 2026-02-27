# CRUD Storage Module
# Provides standard data persistence behavior patterns

module StorageCRUD version "1.0.0"

# ============================================
# Types
# ============================================

type RecordId = UUID { immutable: true, unique: true }

type SortDirection = enum {
  ASC
  DESC
}

type FilterOperator = enum {
  EQ
  NEQ
  GT
  GTE
  LT
  LTE
  IN
  NOT_IN
  LIKE
  ILIKE
  IS_NULL
  IS_NOT_NULL
  BETWEEN
  CONTAINS
  STARTS_WITH
  ENDS_WITH
}

type ConflictStrategy = enum {
  FAIL
  IGNORE
  UPDATE
  MERGE
}

type IsolationLevel = enum {
  READ_UNCOMMITTED
  READ_COMMITTED
  REPEATABLE_READ
  SERIALIZABLE
}

# ============================================
# Entities
# ============================================

entity SortSpec {
  field: String { max_length: 64 }
  direction: SortDirection [default: ASC]
  nulls_first: Boolean [default: false]
}

entity FilterSpec {
  field: String { max_length: 64 }
  operator: FilterOperator
  value: String?
  values: List<String>?

  invariants {
    operator in [IN, NOT_IN, BETWEEN] implies values != null
    operator in [IS_NULL, IS_NOT_NULL] implies value == null and values == null
    operator not in [IN, NOT_IN, BETWEEN, IS_NULL, IS_NOT_NULL] implies value != null
  }
}

entity PaginationSpec {
  limit: Int { min: 1, max: 1000, default: 20 }
  offset: Int { min: 0, default: 0 }
  cursor: String?
  cursor_field: String?

  invariants {
    cursor != null implies cursor_field != null
  }
}

entity PaginatedResult {
  total_count: Int { min: 0 }
  page_size: Int { min: 1 }
  has_next: Boolean
  has_previous: Boolean
  next_cursor: String?
  previous_cursor: String?

  invariants {
    has_next implies next_cursor != null
    has_previous implies previous_cursor != null
    total_count >= 0
  }
}

entity SoftDeleteMetadata {
  deleted: Boolean [default: false]
  deleted_at: Timestamp?
  deleted_by: UUID?
  restore_deadline: Timestamp?

  invariants {
    deleted implies deleted_at != null
    not deleted implies deleted_at == null
    restore_deadline != null implies deleted
    restore_deadline != null implies restore_deadline > deleted_at
  }
}

# ============================================
# Behaviors
# ============================================

behavior Create {
  description: "Create a new record"

  input {
    data: Map<String, String>
    conflict_strategy: ConflictStrategy [default: FAIL]
    return_created: Boolean [default: true]
  }

  output {
    success: {
      id: RecordId
      created_at: Timestamp
    }

    errors {
      VALIDATION_ERROR {
        when: "Input data fails validation constraints"
        retriable: false
      }
      DUPLICATE_KEY {
        when: "Record with unique key already exists"
        retriable: false
      }
      CONSTRAINT_VIOLATION {
        when: "Database constraint violated"
        retriable: false
      }
    }
  }

  post success {
    result.id != null
    result.created_at > 0
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior Read {
  description: "Read a single record by ID"

  input {
    id: RecordId
    include_deleted: Boolean [default: false]
  }

  output {
    success: Map<String, String>

    errors {
      NOT_FOUND {
        when: "Record does not exist"
        retriable: false
      }
      DELETED {
        when: "Record has been soft-deleted"
        retriable: false
      }
    }
  }

  pre {
    id != null
  }

  post success {
    result != null
  }

  temporal {
    within 50ms (p99): response returned
  }
}

behavior Update {
  description: "Update an existing record"

  input {
    id: RecordId
    data: Map<String, String>
    expected_version: Int?
  }

  output {
    success: {
      updated_at: Timestamp
      version: Int
    }

    errors {
      NOT_FOUND {
        when: "Record does not exist"
        retriable: false
      }
      VERSION_CONFLICT {
        when: "Record was modified by another process (optimistic locking)"
        retriable: true
      }
      VALIDATION_ERROR {
        when: "Updated data fails validation"
        retriable: false
      }
    }
  }

  pre {
    id != null
    data != null
  }

  post success {
    result.updated_at > 0
    result.version > 0
    input.expected_version != null implies result.version == input.expected_version + 1
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior Delete {
  description: "Delete a record (hard or soft)"

  input {
    id: RecordId
    soft: Boolean [default: true]
    deleted_by: UUID?
  }

  output {
    success: Boolean

    errors {
      NOT_FOUND {
        when: "Record does not exist"
        retriable: false
      }
      ALREADY_DELETED {
        when: "Record is already deleted"
        retriable: false
      }
      REFERENTIAL_INTEGRITY {
        when: "Other records reference this record"
        retriable: false
      }
    }
  }

  pre {
    id != null
  }

  post success {
    result == true
    input.soft implies record.deleted == true
    input.soft implies record.deleted_at != null
    not input.soft implies record does not exist
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior List {
  description: "List records with filtering, sorting, and pagination"

  input {
    filters: List<FilterSpec>?
    sort: List<SortSpec>?
    pagination: PaginationSpec?
    include_deleted: Boolean [default: false]
  }

  output {
    success: {
      items: List<Map<String, String>>
      pagination: PaginatedResult
    }
  }

  post success {
    result.items.length <= input.pagination.limit
    result.pagination.total_count >= result.items.length
    not input.include_deleted implies forall item in result.items:
      item.deleted != true
  }

  temporal {
    within 500ms (p99): response returned
  }
}

behavior Restore {
  description: "Restore a soft-deleted record"

  input {
    id: RecordId
    restored_by: UUID?
  }

  output {
    success: {
      restored_at: Timestamp
    }

    errors {
      NOT_FOUND {
        when: "Record does not exist"
        retriable: false
      }
      NOT_DELETED {
        when: "Record is not deleted"
        retriable: false
      }
      RESTORE_DEADLINE_PASSED {
        when: "Restore deadline has expired"
        retriable: false
      }
    }
  }

  pre {
    id != null
  }

  post success {
    record.deleted == false
    record.deleted_at == null
  }
}

behavior BatchCreate {
  description: "Create multiple records in a single transaction"

  input {
    items: List<Map<String, String>> { min_length: 1, max_length: 1000 }
    conflict_strategy: ConflictStrategy [default: FAIL]
    isolation: IsolationLevel [default: READ_COMMITTED]
  }

  output {
    success: {
      created_count: Int
      ids: List<RecordId>
    }

    errors {
      PARTIAL_FAILURE {
        when: "Some records failed to create"
        retriable: true
      }
      TRANSACTION_FAILED {
        when: "Transaction rolled back"
        retriable: true
      }
    }
  }

  pre {
    items.length >= 1
    items.length <= 1000
  }

  post success {
    result.created_count == result.ids.length
    result.created_count <= input.items.length
  }

  temporal {
    within 2s (p99): response returned
  }

  invariants {
    all or nothing on FAIL strategy
    idempotent on IGNORE strategy
  }
}
