domain TestDomain {
  version: "1.0.0"
  
  entity User {
    age: Int
  }
  
  behavior CreateUser {
    input {
      age: String
    }
    output {
      success: User
    }
    preconditions {
      age >= 0
    }
  }
}
