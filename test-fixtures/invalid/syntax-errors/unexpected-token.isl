// Syntax error: unexpected token in expression

domain UnexpectedToken {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    
    invariants {
      name.length > > 0
    }
  }
}
