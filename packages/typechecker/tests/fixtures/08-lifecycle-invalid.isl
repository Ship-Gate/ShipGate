domain TestDomain {
  version: "1.0.0"
  
  entity Order {
    status: String
    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> COMPLETED
      PROCESSING -> CANCELLED
    }
  }
  
  behavior UpdateOrder {
    input {
      orderId: String
      newStatus: String
    }
    output {
      success: Order
    }
    preconditions {
      newStatus == "INVALID_STATE"
    }
  }
}
