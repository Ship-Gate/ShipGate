// Minimal valid ISL specification
// This is the smallest valid ISL file

domain Minimal {
  version: "1.0.0"
  
  entity Item {
    id: UUID [immutable, unique]
  }
}
