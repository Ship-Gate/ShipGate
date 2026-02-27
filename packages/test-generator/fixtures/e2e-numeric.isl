// E2E Test Generation Fixture: Numeric Constraints
// Tests boundary value generation for min/max constraints
domain NumericFixture {
  version: "1.0.0"

  type Amount = Decimal {
    min: 0.01
    max: 10000.00
    precision: 2
  }

  type Quantity = Int {
    min: 1
    max: 100
  }

  type Percentage = Decimal {
    min: 0
    max: 100
    precision: 2
  }

  entity Order {
    id: UUID [immutable, unique]
    amount: Amount
    quantity: Quantity
    discount_percentage: Percentage
    created_at: Timestamp [immutable]
  }

  behavior CreateOrder {
    description: "Create an order with numeric constraints"

    input {
      amount: Amount
      quantity: Quantity
      discount_percentage: Percentage?
    }

    output {
      success: Order

      errors {
        INVALID_AMOUNT {
          when: "Amount is out of valid range"
          retriable: false
        }
        INVALID_QUANTITY {
          when: "Quantity is out of valid range"
          retriable: false
        }
      }
    }

    preconditions {
      input.amount >= 0.01
      input.amount <= 10000.00
      input.quantity >= 1
      input.quantity <= 100
    }

    postconditions {
      success implies {
        Order.exists(result.id)
        Order.lookup(result.id).amount == input.amount
        Order.lookup(result.id).quantity == input.quantity
      }
    }
  }
}
