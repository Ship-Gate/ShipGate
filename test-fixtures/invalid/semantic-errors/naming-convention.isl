// Semantic warning: naming convention violations

domain namingConventionViolations {  // Should be PascalCase
  version: "1.0.0"
  
  // Type should be PascalCase
  type email_type = String { format: email }
  
  // Entity should be PascalCase
  entity user_entity {
    id: UUID
    Name: String  // Field should be snake_case or camelCase
    CONSTANT_FIELD: Int  // Not a constant, shouldn't be all caps
  }
  
  // Enum should be PascalCase, variants SCREAMING_SNAKE
  enum status {
    active
    Inactive
    pending_review
  }
  
  // Behavior should be PascalCase
  behavior create_user {
    input {
      UserName: String  // Should be snake_case
    }
    
    output {
      success: user_entity
    }
  }
}
