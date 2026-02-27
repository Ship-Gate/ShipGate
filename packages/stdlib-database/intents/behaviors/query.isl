/**
 * Database Query Behaviors
 * 
 * Execute database queries and commands.
 */

import { Connection, QueryResult, QueryParams, SqlQuery, Table } from "../domain.isl"

behavior Query {
  description: "Execute a database query"
  
  input {
    connection_id: UUID
    sql: SqlQuery
    params: QueryParams?
    timeout_ms: Int { min: 0, max: 300000 }?
  }
  
  output {
    success: QueryResult
    errors {
      CONNECTION_NOT_FOUND { when: "Connection does not exist" }
      CONNECTION_ERROR { when: "Failed to connect to database" }
      QUERY_ERROR { 
        when: "Query execution failed"
        message: String
        code: String?
      }
      TIMEOUT { when: "Query timed out" }
      SYNTAX_ERROR { 
        when: "SQL syntax error"
        position: Int?
      }
    }
  }
  
  temporal {
    response within 30.seconds (p99)
  }
  
  postconditions {
    success implies {
      result.row_count >= 0
      result.duration_ms >= 0
    }
  }
  
  scenarios Query {
    scenario "simple select" {
      when {
        result = Query(
          connection_id: conn.id,
          sql: "SELECT * FROM users WHERE id = $1",
          params: ["user-123"]
        )
      }
      
      then {
        result is success
        result.rows.length <= 1
      }
    }
    
    scenario "insert with returning" {
      when {
        result = Query(
          connection_id: conn.id,
          sql: "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
          params: ["John", "john@example.com"]
        )
      }
      
      then {
        result is success
        result.row_count == 1
      }
    }
    
    scenario "query timeout" {
      when {
        result = Query(
          connection_id: conn.id,
          sql: "SELECT pg_sleep(60)",
          timeout_ms: 100
        )
      }
      
      then {
        result is TIMEOUT
      }
    }
  }
}

behavior FindOne {
  description: "Find a single record by criteria"
  
  input {
    connection_id: UUID
    table: String
    where: Map<String, Any>
    select: List<String>?
  }
  
  output {
    success: Map<String, Any>?
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      QUERY_ERROR { }
    }
  }
  
  postconditions {
    success implies {
      result == null or result is Map
    }
  }
}

behavior FindMany {
  description: "Find multiple records by criteria"
  
  input {
    connection_id: UUID
    table: String
    where: Map<String, Any>?
    select: List<String>?
    order_by: List<{field: String, direction: "asc" | "desc"}>?
    limit: Int { min: 1 }?
    offset: Int { min: 0 }?
  }
  
  output {
    success: {
      rows: List<Map<String, Any>>
      total: Int?
    }
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      QUERY_ERROR { }
    }
  }
}

behavior Insert {
  description: "Insert one or more records"
  
  input {
    connection_id: UUID
    table: String
    data: Map<String, Any> | List<Map<String, Any>>
    returning: List<String>?
    on_conflict: OnConflict?
  }
  
  output {
    success: {
      rows: List<Map<String, Any>>
      inserted_count: Int
    }
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      CONSTRAINT_VIOLATION { 
        constraint: String
        column: String?
      }
      QUERY_ERROR { }
    }
  }
  
  postconditions {
    success implies {
      result.inserted_count >= 0
    }
  }
}

type OnConflict = {
  target: List<String>  // Columns that form the conflict target
  action: "nothing" | "update"
  update_columns: List<String>?
}

behavior Update {
  description: "Update records matching criteria"
  
  input {
    connection_id: UUID
    table: String
    where: Map<String, Any>
    data: Map<String, Any>
    returning: List<String>?
  }
  
  output {
    success: {
      rows: List<Map<String, Any>>
      updated_count: Int
    }
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      CONSTRAINT_VIOLATION { }
      QUERY_ERROR { }
    }
  }
  
  preconditions {
    Object.keys(input.where).length > 0 as "Where clause required for update"
    Object.keys(input.data).length > 0 as "Data to update is required"
  }
}

behavior Delete {
  description: "Delete records matching criteria"
  
  input {
    connection_id: UUID
    table: String
    where: Map<String, Any>
    returning: List<String>?
  }
  
  output {
    success: {
      rows: List<Map<String, Any>>
      deleted_count: Int
    }
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      CONSTRAINT_VIOLATION { 
        when: "Foreign key constraint prevents deletion"
      }
      QUERY_ERROR { }
    }
  }
  
  preconditions {
    Object.keys(input.where).length > 0 as "Where clause required for delete"
  }
}

behavior Count {
  description: "Count records matching criteria"
  
  input {
    connection_id: UUID
    table: String
    where: Map<String, Any>?
  }
  
  output {
    success: Int
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      QUERY_ERROR { }
    }
  }
  
  postconditions {
    success implies result >= 0
  }
}

behavior Exists {
  description: "Check if any record matches criteria"
  
  input {
    connection_id: UUID
    table: String
    where: Map<String, Any>
  }
  
  output {
    success: Boolean
    errors {
      CONNECTION_ERROR { }
      TABLE_NOT_FOUND { }
      QUERY_ERROR { }
    }
  }
}
