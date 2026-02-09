domain Test {
  entity User {
    name: String
    age: Int?
  }
  
  behavior CreateUser {
    input {
      name: String
      age: Int?
    }
    output {
      success: {
        user: User
      }
    }
  }
}
