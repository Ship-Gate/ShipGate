/**
 * Database Transaction Behaviors
 * 
 * Manage database transactions.
 */

import { Connection, Transaction, IsolationLevel, TransactionStatus } from "../domain.isl"

behavior BeginTransaction {
  description: "Start a new database transaction"
  
  input {
    connection_id: UUID
    isolation_level: IsolationLevel?
    read_only: Boolean?
    timeout_ms: Int { min: 0 }?
  }
  
  output {
    success: Transaction
    errors {
      CONNECTION_NOT_FOUND { }
      CONNECTION_ERROR { }
      TRANSACTION_ALREADY_ACTIVE { when: "Connection has active transaction" }
    }
  }
  
  postconditions {
    success implies {
      result.status == ACTIVE
      result.connection_id == input.connection_id
    }
  }
  
  scenarios BeginTransaction {
    scenario "default isolation" {
      when {
        result = BeginTransaction(connection_id: conn.id)
      }
      
      then {
        result is success
        result.transaction.isolation_level == READ_COMMITTED
      }
    }
    
    scenario "serializable transaction" {
      when {
        result = BeginTransaction(
          connection_id: conn.id,
          isolation_level: SERIALIZABLE
        )
      }
      
      then {
        result is success
        result.transaction.isolation_level == SERIALIZABLE
      }
    }
  }
}

behavior Commit {
  description: "Commit a transaction"
  
  input {
    transaction_id: UUID
  }
  
  output {
    success: Transaction
    errors {
      TRANSACTION_NOT_FOUND { }
      TRANSACTION_NOT_ACTIVE { when: "Transaction already completed" }
      COMMIT_FAILED { 
        when: "Failed to commit"
        reason: String
      }
    }
  }
  
  preconditions {
    Transaction.exists(input.transaction_id) as "Transaction must exist"
    Transaction.lookup(input.transaction_id).status == ACTIVE as "Transaction must be active"
  }
  
  postconditions {
    success implies {
      Transaction.lookup(input.transaction_id).status == COMMITTED
    }
  }
}

behavior Rollback {
  description: "Rollback a transaction"
  
  input {
    transaction_id: UUID
    reason: String?
  }
  
  output {
    success: Transaction
    errors {
      TRANSACTION_NOT_FOUND { }
      TRANSACTION_NOT_ACTIVE { }
      ROLLBACK_FAILED { reason: String }
    }
  }
  
  preconditions {
    Transaction.exists(input.transaction_id) as "Transaction must exist"
    Transaction.lookup(input.transaction_id).status == ACTIVE as "Transaction must be active"
  }
  
  postconditions {
    success implies {
      Transaction.lookup(input.transaction_id).status == ROLLED_BACK
    }
  }
}

behavior WithTransaction {
  description: "Execute operations within a transaction with automatic commit/rollback"
  
  input {
    connection_id: UUID
    isolation_level: IsolationLevel?
    operations: List<{
      type: "query" | "insert" | "update" | "delete"
      args: Map<String, Any>
    }>
  }
  
  output {
    success: {
      transaction: Transaction
      results: List<Any>
    }
    errors {
      CONNECTION_ERROR { }
      OPERATION_FAILED { 
        index: Int
        error: String
      }
      COMMIT_FAILED { }
    }
  }
  
  postconditions {
    success implies {
      result.transaction.status == COMMITTED
      result.results.length == input.operations.length
    }
  }
  
  scenarios WithTransaction {
    scenario "all operations succeed" {
      when {
        result = WithTransaction(
          connection_id: conn.id,
          operations: [
            { type: "insert", args: { table: "orders", data: {...} } },
            { type: "update", args: { table: "inventory", where: {...}, data: {...} } }
          ]
        )
      }
      
      then {
        result is success
        result.transaction.status == COMMITTED
      }
    }
    
    scenario "operation fails, transaction rolled back" {
      when {
        result = WithTransaction(
          connection_id: conn.id,
          operations: [
            { type: "insert", args: { table: "orders", data: {...} } },
            { type: "insert", args: { table: "nonexistent", data: {...} } }
          ]
        )
      }
      
      then {
        result is OPERATION_FAILED
        result.error.index == 1
        // First insert should be rolled back
      }
    }
  }
}

behavior Savepoint {
  description: "Create a savepoint within a transaction"
  
  input {
    transaction_id: UUID
    name: String
  }
  
  output {
    success: { name: String, created_at: Timestamp }
    errors {
      TRANSACTION_NOT_FOUND { }
      TRANSACTION_NOT_ACTIVE { }
      DUPLICATE_SAVEPOINT { when: "Savepoint name already exists" }
    }
  }
}

behavior RollbackToSavepoint {
  description: "Rollback to a savepoint"
  
  input {
    transaction_id: UUID
    savepoint: String
  }
  
  output {
    success: { rolled_back_to: String }
    errors {
      TRANSACTION_NOT_FOUND { }
      TRANSACTION_NOT_ACTIVE { }
      SAVEPOINT_NOT_FOUND { }
    }
  }
}

behavior ReleaseSavepoint {
  description: "Release a savepoint"
  
  input {
    transaction_id: UUID
    savepoint: String
  }
  
  output {
    success: { released: String }
    errors {
      TRANSACTION_NOT_FOUND { }
      TRANSACTION_NOT_ACTIVE { }
      SAVEPOINT_NOT_FOUND { }
    }
  }
}
