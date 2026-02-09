domain TestDomain {
  version: "1.0.0"
  
  entity User {
    id: UUID
    email: String
    age: Int
  }
  
  behavior createUser {
    input {
      email: String
      age: Int
    }
    output {
      success: User
    }
  }
}