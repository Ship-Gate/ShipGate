// Fixture: References a non-existent type in a field declaration
// Expected Error: E0201 - Type 'NonExistentProfile' is not defined

domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    profile: NonExistentProfile  // Error: NonExistentProfile is not defined
  }
}
