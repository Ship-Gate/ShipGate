domain EdgeEnums {
  version: "1.0.0"

  enum Status {
    DRAFT
    PENDING
    APPROVED
    REJECTED
    ARCHIVED
  }

  enum Priority {
    LOW = 1
    MEDIUM = 2
    HIGH = 3
  }

  enum Color {
    RED
    GREEN
    BLUE
  }

  entity Item {
    id: UUID [immutable, unique]
    status: Status
    priority: Priority
    color: Color?
  }

  behavior SetStatus {
    input {
      id: UUID
      status: Status
    }
    output {
      success: Item
    }
  }
}
