domain EdgeOptional {
  version: "1.0.0"

  entity Flexible {
    id: UUID [immutable, unique]
    name: String?
    description: String?
    count: Int?
    active: Boolean?
  }

  behavior CreateFlexible {
    input {
      name: String?
      description: String?
    }
    output {
      success: Flexible
    }
  }
}
