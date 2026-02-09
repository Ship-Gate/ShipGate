domain TestDomain {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    
    invariants {
      true
      name == name
    }
  }
  
  invariants {
    true
  }
}
