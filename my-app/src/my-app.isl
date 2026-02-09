domain MyApp {
  version: "1.0.0"

  use stdlib-payments


  entity Item {
    id: UUID [immutable, unique]
    name: String
    created_at: Timestamp [immutable]
  }

  behavior DoSomething {
    description: "Default operation"
    
    output {
      success: Boolean
    }
  }
}