domain OrderService {
  version: "1.0.0"

  entity Order {
    id: UUID [immutable, unique]
    customer_id: UUID
    total: Float
    status: String
  }

  behavior CreateOrder {
    input {
      customer_id: UUID
      items: String
    }

    output {
      success: Order
      errors {
        EMPTY_ITEMS {
          when: "No items provided"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - result.id.length > 0
        - result.customer_id == input.customer_id
        - result.total > 0
      }
    }
  }
}
