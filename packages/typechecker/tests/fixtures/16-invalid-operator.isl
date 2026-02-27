domain TestDomain {
  version: "1.0.0"
  
  entity User {
    name: String
  }
  
  behavior CreateUser {
    input {
      name: String
    }
    output {
      success: User
    }
    preconditions {
      name + 5
    }
  }
}
