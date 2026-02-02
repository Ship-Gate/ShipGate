# Shadowing test - local definition shadows import

domain ShadowingTest {
  version: "1.0.0"

  imports {
    Email from "./types.isl"
  }

  # This shadows the imported Email type
  type Email = String { format: "email", max_length: 100 }

  entity User {
    id: UUID [immutable]
    email: Email
  }
}
