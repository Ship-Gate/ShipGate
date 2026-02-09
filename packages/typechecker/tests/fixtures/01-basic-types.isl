domain TestDomain {
  version: "1.0.0"
  
  type Email = String @format("email")
  type Age = Int @min(0) @max(150)
  
  entity User {
    email: Email
    age: Age
    name: String
  }
  
  behavior CreateUser {
    input {
      email: Email
      name: String
      age: Age
    }
    output {
      success: User
    }
    preconditions {
      age >= 0
    }
  }
}
