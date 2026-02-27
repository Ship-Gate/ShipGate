// Fixture: References a non-existent entity in a view
// Expected Error: E0201/E0301 - 'NonExistentEntity' is not defined

domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
  }

  view UserView {
    for: NonExistentEntity  // Error: NonExistentEntity is not defined
    fields {
      id: UUID = entity.id
    }
    consistency {
      strong
    }
  }
}
