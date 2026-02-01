// Type error: invalid lifecycle states

domain InvalidLifecycle {
  version: "1.0.0"
  
  enum Status {
    DRAFT
    ACTIVE
    DELETED
  }
  
  entity User {
    id: UUID
    status: Status
    
    lifecycle {
      // Undefined state
      UNKNOWN -> DRAFT
      
      // Invalid transition (self-loop)
      DRAFT -> DRAFT
      
      // State not in enum
      DRAFT -> PENDING
      PENDING -> ACTIVE
      
      // Unreachable state
      DELETED -> ACTIVE
    }
  }
}
