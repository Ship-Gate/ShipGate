domain TestDomain {
  version: "1.0.0"
  
  entity User {
    name: String
    email: String?
    age: Int?
  }
  
  behavior CreateUser {
    input {
      name: String
      email: String?
    }
    output {
      success: User
    }
  }
}
