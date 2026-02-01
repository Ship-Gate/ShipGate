// Semantic error: unreachable code and dead conditions

domain UnreachableCode {
  version: "1.0.0"
  
  entity User {
    id: UUID
    age: Int
    
    invariants {
      // Always false condition
      age > 100 and age < 0
      
      // Redundant condition
      age > 0 and age > 0
      
      // Contradictory conditions
      age == 5 and age == 10
    }
  }
  
  behavior CreateUser {
    input {
      age: Int
    }
    
    output {
      success: User
      
      errors {
        INVALID_AGE {
          when: "Age is invalid"
        }
      }
    }
    
    preconditions {
      // Always true (tautology)
      input.age > 0 or input.age <= 0
      
      // Always false
      input.age < 0 and input.age > 0
    }
    
    postconditions {
      // Contradictory postconditions
      success implies {
        result.age > 50
      }
      
      success implies {
        result.age < 20
      }
    }
  }
}
