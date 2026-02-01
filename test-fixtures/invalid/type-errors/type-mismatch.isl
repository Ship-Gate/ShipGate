// Type error: type mismatch in expression

domain TypeMismatch {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    age: Int
    
    invariants {
      // Comparing string to number
      name > 10
      
      // String concatenation with number
      age + "years"
    }
  }
}
