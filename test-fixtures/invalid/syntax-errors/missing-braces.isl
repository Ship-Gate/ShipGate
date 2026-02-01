// Syntax error: missing closing brace

domain MissingBrace {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable]
    name: String
  // Missing closing brace for entity
  
  behavior Create {
    input {
      name: String
    }
  }
}
