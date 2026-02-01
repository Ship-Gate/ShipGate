// Type error: duplicate declarations

domain DuplicateDeclaration {
  version: "1.0.0"
  
  // Duplicate type definition
  type Email = String { max_length: 254 }
  type Email = String { max_length: 100 }
  
  // Duplicate entity definition
  entity User {
    id: UUID
    name: String
  }
  
  entity User {
    id: UUID
    email: String
  }
  
  // Duplicate field definition
  entity Account {
    id: UUID
    balance: Decimal
    balance: Int  // Duplicate field
  }
  
  // Duplicate enum variant
  enum Status {
    ACTIVE
    INACTIVE
    ACTIVE  // Duplicate variant
  }
  
  // Duplicate behavior
  behavior Create {
    input { name: String }
  }
  
  behavior Create {
    input { email: String }
  }
}
