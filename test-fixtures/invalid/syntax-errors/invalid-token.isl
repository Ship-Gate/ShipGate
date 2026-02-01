// Syntax error: invalid token

domain InvalidToken {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    value: $$$invalid$$$
  }
}
