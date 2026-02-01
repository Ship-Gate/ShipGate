// Type error: invalid operator for types

domain InvalidOperator {
  version: "1.0.0"
  
  entity User {
    id: UUID
    active: Boolean
    created_at: Timestamp
    
    invariants {
      // Boolean arithmetic
      active + true
      
      // Timestamp multiplication
      created_at * 2
      
      // UUID comparison
      id > "some-string"
    }
  }
}
