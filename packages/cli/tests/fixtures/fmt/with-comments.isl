# Domain with comments
domain Test {
  # Entity definition
  entity User {
    name: String // User's name
    age: Int? // Optional age
  }
  
  // Behavior definition
  behavior CreateUser {
    input {
      name: String
      age: Int?
    }
  }
}
