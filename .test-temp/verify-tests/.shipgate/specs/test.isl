
isl 1.0

domain TestDomain {
  entity User {
    id: UUID
    name: String
    email: String
  }

  behavior CreateUser {
    input {
      name: String
      email: String
    }
    output {
      success: User
    }
    postconditions {
      "User is created" => result.name == input.name
    }
  }
}
