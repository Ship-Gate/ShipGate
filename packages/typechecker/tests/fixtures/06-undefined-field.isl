domain TestDomain {
  version: "1.0.0"
  
  entity User {
    name: String
    email: String
  }
  
  behavior GetUser {
    input {
      userId: String
    }
    output {
      success: User
    }
    preconditions {
      user.name != ""
    }
  }
}
