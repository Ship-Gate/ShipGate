// CRUD: Order management
domain CRUDOrders {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum OrderStatus {
    PENDING
    CONFIRMED
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
    REFUNDED
  }

  enum PaymentStatus {
    PENDING
    PAID
    FAILED
    REFUNDED
  }

  type OrderItem = {
    product_id: UUID
    sku: String
    name: String
    quantity: Int
    unit_price: Decimal
    total_price: Decimal
  }

  type ShippingAddress = {
    name: String
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String
    phone: String?
  }

  entity Order {
    id: UUID [immutable, unique]
    order_number: String [unique, indexed]
    customer_id: UUID [indexed]
    items: List<OrderItem>
    subtotal: Decimal
    tax: Decimal
    shipping_cost: Decimal
    discount: Decimal
    total: Decimal
    currency: String
    status: OrderStatus [default: PENDING]
    payment_status: PaymentStatus [default: PENDING]
    shipping_address: ShippingAddress
    billing_address: ShippingAddress?
    tracking_number: String?
    notes: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      items.length > 0
      subtotal >= 0
      total >= 0
      total == subtotal + tax + shipping_cost - discount
    }

    lifecycle {
      PENDING -> CONFIRMED
      PENDING -> CANCELLED
      CONFIRMED -> PROCESSING
      PROCESSING -> SHIPPED
      SHIPPED -> DELIVERED
      CONFIRMED -> CANCELLED
      DELIVERED -> REFUNDED
    }
  }

  behavior CreateOrder {
    description: "Create an order"

    actors {
      Customer { must: authenticated }
      System { }
    }

    input {
      items: List<{
        product_id: UUID
        quantity: Int
      }>
      shipping_address: ShippingAddress
      billing_address: ShippingAddress?
      coupon_code: String?
      notes: String?
    }

    output {
      success: Order

      errors {
        PRODUCT_NOT_FOUND {
          when: "Product not found"
          retriable: false
        }
        PRODUCT_UNAVAILABLE {
          when: "Product out of stock"
          retriable: true
        }
        INVALID_QUANTITY {
          when: "Invalid quantity"
          retriable: true
        }
        COUPON_INVALID {
          when: "Coupon is invalid"
          retriable: false
        }
        EMPTY_CART {
          when: "No items in order"
          retriable: true
        }
      }
    }

    pre {
      input.items.length > 0
      all(item in input.items: item.quantity > 0)
    }

    post success {
      - Order.exists(result.id)
      - result.customer_id == actor.id
      - result.status == PENDING
    }

    temporal {
      - within 2s (p99): order created
    }
  }

  behavior GetOrder {
    description: "Get order by ID"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      order_id: UUID?
      order_number: String?
    }

    output {
      success: Order

      errors {
        NOT_FOUND {
          when: "Order not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      input.order_id != null or input.order_number != null
    }
  }

  behavior UpdateOrderStatus {
    description: "Update order status"

    actors {
      Admin { must: authenticated }
      System { }
    }

    input {
      order_id: UUID
      status: OrderStatus
      tracking_number: String?
      notes: String?
    }

    output {
      success: Order

      errors {
        NOT_FOUND {
          when: "Order not found"
          retriable: false
        }
        INVALID_TRANSITION {
          when: "Invalid status transition"
          retriable: false
        }
      }
    }

    pre {
      Order.exists(input.order_id)
    }

    post success {
      - result.status == input.status
      - input.tracking_number != null implies result.tracking_number == input.tracking_number
    }
  }

  behavior CancelOrder {
    description: "Cancel an order"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      order_id: UUID
      reason: String?
    }

    output {
      success: Order

      errors {
        NOT_FOUND {
          when: "Order not found"
          retriable: false
        }
        NOT_CANCELLABLE {
          when: "Order cannot be cancelled"
          retriable: false
        }
      }
    }

    pre {
      Order.exists(input.order_id)
      Order.lookup(input.order_id).status == PENDING or Order.lookup(input.order_id).status == CONFIRMED
    }

    post success {
      - result.status == CANCELLED
    }
  }

  behavior ListOrders {
    description: "List orders"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      customer_id: UUID?
      status: OrderStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        orders: List<Order>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  scenarios CreateOrder {
    scenario "create simple order" {
      when {
        result = CreateOrder(
          items: [
            { product_id: "prod-123", quantity: 2 }
          ],
          shipping_address: {
            name: "John Doe",
            line1: "123 Main St",
            city: "New York",
            postal_code: "10001",
            country: "US"
          }
        )
      }

      then {
        result is success
        result.status == PENDING
      }
    }
  }
}
