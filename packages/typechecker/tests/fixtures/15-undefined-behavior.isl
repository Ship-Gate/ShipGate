domain TestDomain {
  version: "1.0.0"
  
  entity User {
    name: String
  }
  
  behavior GetUser {
    input {
      userId: String
    }
    output {
      success: User
    }
  }
  
  behavior UpdateUser {
    input {
      userId: String
    }
    output {
      success: User
    }
    preconditions {
      GetUser(userId) != null
    }
  }
}
