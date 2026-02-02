// Minimal domain with basic entity
domain Minimal {
  version: "1.0.0"
  
  entity Item {
    id: UUID [immutable]
    name: String
    created_at: Timestamp [immutable]
  }
  
  behavior GetItem {
    input {
      id: UUID
    }
    output {
      success: Item
    }
  }
}
