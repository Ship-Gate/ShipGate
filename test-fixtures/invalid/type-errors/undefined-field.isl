// Type error: undefined field access

domain UndefinedField {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    
    invariants {
      // Access to non-existent field
      nonexistent_field > 0
      
      // Nested access to non-existent field
      name.nonexistent_method
    }
  }
  
  behavior CreateUser {
    input {
      name: String
    }
    
    output {
      success: User
    }
    
    preconditions {
      // Access non-existent input field
      input.email.length > 0
    }
    
    postconditions {
      success implies {
        // Access non-existent result field
        result.status == "ACTIVE"
      }
    }
  }
}
