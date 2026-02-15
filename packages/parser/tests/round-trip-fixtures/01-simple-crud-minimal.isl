domain SimpleCrud {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    name: String
    email: String
  }

  entity Task {
    id: UUID [immutable, unique]
    title: String
    completed: Boolean
    user_id: UUID
  }

  entity Project {
    id: UUID [immutable, unique]
    name: String
    owner_id: UUID
  }
}
