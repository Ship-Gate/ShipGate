// Type error: undefined type reference

domain UndefinedType {
  version: "1.0.0"
  
  entity User {
    id: UUID
    name: String
    status: NonExistentType  // This type doesn't exist
  }
}
