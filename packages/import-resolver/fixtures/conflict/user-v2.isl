# Conflict test - User version 2 (different definition)

domain UserV2 {
  version: "2.0.0"

  entity User {
    id: UUID [immutable]
    email: String
    name: String
    status: String
  }
}
