// Type error: context-specific expression errors

domain ContextErrors {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    
    invariants {
      // old() outside postcondition - invalid
      old(name) == name
      
      // result outside postcondition - invalid
      result.id != null
    }
  }
  
  behavior UpdateUser {
    input {
      user_id: UUID
      name: String
    }
    
    output {
      success: User
    }
    
    preconditions {
      // old() in precondition - invalid
      old(User.lookup(input.user_id).name) != null
      
      // result in precondition - invalid
      result.name == input.name
    }
    
    postconditions {
      success implies {
        // This is valid - old() and result in postcondition
        result.name == input.name
        old(User.lookup(input.user_id).name) != result.name
      }
    }
  }
  
  behavior CreateUser {
    input {
      name: String
    }
    
    // input access outside behavior context
    invariants {
      // This should error - input only valid in behavior context
      input.name never_appears_in logs
    }
  }
}
