// Fixture: Non-exhaustive enum handling
// Expected Warning: E0701 - Missing enum variant handler
// Pass: exhaustiveness

domain ExhaustivenessTest {
  version: "1.0.0"

  enum OrderStatus {
    Pending
    Processing
    Shipped
    Delivered
    Cancelled
  }

  entity Order {
    id: UUID [immutable]
    status: OrderStatus
  }

  behavior ProcessOrder {
    input {
      orderId: UUID
    }
    output {
      success: Order
      errors: [OrderNotFound, InvalidTransition]
    }

    preconditions {
      // E0701: Non-exhaustive - missing Shipped, Delivered, Cancelled
      when input.status == OrderStatus.Pending {
        canProcess == true
      }
      when input.status == OrderStatus.Processing {
        canShip == true
      }
      // Missing handlers for: Shipped, Delivered, Cancelled
    }

    postconditions {
      when success {
        result.status != old(order.status)
      }
    }
  }
}
