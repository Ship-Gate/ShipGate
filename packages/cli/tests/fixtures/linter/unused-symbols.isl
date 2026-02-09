domain TestDomain {
  version: "1.0.0"
  
  entity UnusedEntity {
    id: UUID
    name: String
  }
  
  type UnusedType = String
  
  behavior CreateUser {
    input {
      email: String
    }
    output {
      success: String
    }
  }
}
