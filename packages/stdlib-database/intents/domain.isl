/**
 * Database Domain
 * 
 * Standard library for database operations in ISL.
 */

domain Database {
  version: "1.0.0"
  description: "Database operations for relational and document stores"
  
  // ─────────────────────────────────────────────────────────────────────────
  // Connection Types
  // ─────────────────────────────────────────────────────────────────────────
  
  enum DatabaseType {
    POSTGRESQL
    MYSQL
    SQLITE
    MONGODB
    REDIS
  }
  
  type ConnectionString = String {
    pattern: /^[a-z]+:\/\/.+$/
    description: "Database connection URL"
  }
  
  entity Connection {
    id: UUID [immutable, unique]
    type: DatabaseType
    name: String
    host: String
    port: Int { min: 1, max: 65535 }
    database: String
    username: String?
    
    // Pool settings
    pool_min: Int { min: 0 }
    pool_max: Int { min: 1 }
    idle_timeout_ms: Int { min: 0 }
    
    // Status
    connected: Boolean
    last_used: Timestamp?
    error_count: Int
    
    // Metadata
    created_at: Timestamp [immutable]
    
    invariants {
      pool_max >= pool_min as "Max pool size must be >= min"
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Query Types
  // ─────────────────────────────────────────────────────────────────────────
  
  type SqlQuery = String {
    description: "SQL query string"
  }
  
  type QueryParams = List<Any> | Map<String, Any>
  
  entity QueryResult {
    id: UUID [immutable]
    query: SqlQuery
    params: QueryParams?
    
    // Results
    rows: List<Map<String, Any>>
    row_count: Int
    affected_rows: Int?
    
    // Performance
    duration_ms: Int
    executed_at: Timestamp [immutable]
    
    // Metadata
    connection_id: UUID
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Schema Types
  // ─────────────────────────────────────────────────────────────────────────
  
  entity Table {
    name: String [unique]
    schema: String?
    columns: List<Column>
    primary_key: List<String>
    indexes: List<Index>?
    foreign_keys: List<ForeignKey>?
    
    invariants {
      columns.length > 0 as "Table must have at least one column"
      primary_key.length > 0 as "Table must have a primary key"
    }
  }
  
  type Column = {
    name: String
    type: ColumnType
    nullable: Boolean
    default: Any?
    auto_increment: Boolean?
    unique: Boolean?
  }
  
  enum ColumnType {
    INTEGER
    BIGINT
    SMALLINT
    DECIMAL
    FLOAT
    DOUBLE
    VARCHAR
    TEXT
    CHAR
    BOOLEAN
    DATE
    TIME
    TIMESTAMP
    TIMESTAMPTZ
    UUID
    JSON
    JSONB
    BYTEA
    ARRAY
  }
  
  type Index = {
    name: String
    columns: List<String>
    unique: Boolean
    type: IndexType?
  }
  
  enum IndexType {
    BTREE
    HASH
    GIN
    GIST
  }
  
  type ForeignKey = {
    columns: List<String>
    references_table: String
    references_columns: List<String>
    on_delete: ForeignKeyAction?
    on_update: ForeignKeyAction?
  }
  
  enum ForeignKeyAction {
    CASCADE
    SET_NULL
    SET_DEFAULT
    RESTRICT
    NO_ACTION
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Transaction Types
  // ─────────────────────────────────────────────────────────────────────────
  
  entity Transaction {
    id: UUID [immutable, unique]
    connection_id: UUID
    isolation_level: IsolationLevel
    status: TransactionStatus
    started_at: Timestamp [immutable]
    completed_at: Timestamp?
    queries: List<UUID>
    
    lifecycle {
      ACTIVE -> COMMITTED
      ACTIVE -> ROLLED_BACK
      ACTIVE -> FAILED
    }
  }
  
  enum IsolationLevel {
    READ_UNCOMMITTED
    READ_COMMITTED
    REPEATABLE_READ
    SERIALIZABLE
  }
  
  enum TransactionStatus {
    ACTIVE
    COMMITTED
    ROLLED_BACK
    FAILED
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Migration Types
  // ─────────────────────────────────────────────────────────────────────────
  
  entity Migration {
    id: UUID [immutable, unique]
    version: String
    name: String
    description: String?
    up_sql: SqlQuery
    down_sql: SqlQuery?
    checksum: String
    applied_at: Timestamp?
    status: MigrationStatus
    
    lifecycle {
      PENDING -> APPLIED
      APPLIED -> ROLLED_BACK
      PENDING -> FAILED
    }
  }
  
  enum MigrationStatus {
    PENDING
    APPLIED
    ROLLED_BACK
    FAILED
  }
}
