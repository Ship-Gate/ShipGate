# Shared type definitions

domain SimpleAppTypes {
  version: "1.0.0"

  type Email = String { format: "email", max_length: 255 }
  
  type UserId = UUID { immutable: true }

  entity User {
    id: UserId [immutable, unique]
    email: Email [unique]
    name: String { max_length: 100 }
    created_at: Timestamp [immutable]

    invariants {
      email.length > 0
      name.length > 0
    }
  }
}
