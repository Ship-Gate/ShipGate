// Domain with enum types
domain EnumTypes {
  version: "1.0.0"
  
  enum Status {
    DRAFT
    PENDING
    ACTIVE
    ARCHIVED
    DELETED
  }
  
  enum Priority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }
  
  enum Currency {
    USD
    EUR
    GBP
    JPY
  }
  
  entity Task {
    id: UUID [immutable]
    title: String
    status: Status
    priority: Priority
    created_at: Timestamp [immutable]
  }
  
  behavior CreateTask {
    input {
      title: String
      priority: Priority?
    }
    output {
      success: Task
    }
  }
  
  behavior UpdateTaskStatus {
    input {
      id: UUID
      status: Status
    }
    output {
      success: Task
    }
  }
}
