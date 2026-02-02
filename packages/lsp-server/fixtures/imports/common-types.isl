// Common types for import testing
domain CommonTypes {
  version: "1.0.0"

  // Email type with format constraint
  type Email = String { format: "email", max_length: 254 }

  // Password type with security constraints
  type Password = String { min_length: 8 }

  // User ID type
  type UserId = UUID { immutable: true }

  // Status enum
  enum Status {
    ACTIVE
    INACTIVE
    SUSPENDED
  }

  // Money type for financial operations
  type Money = Decimal { precision: 2, min: 0 }

  // Address struct
  type Address = {
    street: String
    city: String
    country: String
    postalCode: String
  }
}
