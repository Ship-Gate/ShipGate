# Conflict test - User version 1

domain UserV1 {
  version: "1.0.0"

  entity User {
    id: UUID [immutable]
    email: String
  }
}
