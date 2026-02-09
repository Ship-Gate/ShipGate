# Event Sourcing — Canonical Sample
# Order lifecycle with event log, projections, and replay guarantees
# Covers: pre/post, invariants, temporal, scenarios

domain EventSourcing {
  version: "1.0.0"

  enum OrderStatus {
    CREATED
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
    RETURNED
  }

  entity Event {
    id: UUID [immutable, unique]
    stream_id: UUID [immutable, indexed]
    sequence: Int [immutable]
    event_type: String [indexed]
    payload: JSON
    metadata: JSON?
    created_at: Timestamp [immutable]

    invariants {
      sequence >= 0
      sequence is monotonically increasing per stream_id
      events are append-only (never mutated or deleted)
    }
  }

  entity OrderProjection {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    items: List<JSON>
    total: Decimal
    status: OrderStatus [indexed]
    version: Int [default: 0]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      total >= 0
      version >= 0
      items.length >= 1 or status == CANCELLED
    }
  }

  behavior CreateOrder {
    description: "Start a new order by appending an OrderCreated event"

    input {
      customer_id: UUID
      items: List<{ product_id: UUID, quantity: Int, price: Decimal }>
    }

    output {
      success: OrderProjection
      errors {
        EMPTY_ITEMS {
          when: "Order must contain at least one item"
          retriable: true
        }
        INVALID_ITEM {
          when: "Item has non-positive quantity or price"
          retriable: true
        }
      }
    }

    pre {
      items.length >= 1
      items.all(i => i.quantity > 0 and i.price > 0)
    }

    post success {
      - Event.exists_for_stream(result.id) with event_type == "OrderCreated"
      - result.status == CREATED
      - result.total == items.sum(i => i.quantity * i.price)
      - result.version == 1
    }

    invariants {
      - event is appended atomically
      - projection derived solely from event stream
    }
  }

  behavior ConfirmOrder {
    description: "Confirm a created order"

    input {
      order_id: UUID
      expected_version: Int
    }

    output {
      success: OrderProjection
      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
          retriable: false
        }
        INVALID_STATUS {
          when: "Order is not in CREATED status"
          retriable: false
        }
        VERSION_CONFLICT {
          when: "Expected version does not match current version"
          retriable: true
        }
      }
    }

    pre {
      OrderProjection.exists(order_id)
      OrderProjection.lookup(order_id).status == CREATED
      OrderProjection.lookup(order_id).version == expected_version
    }

    post success {
      - Event.latest_for_stream(order_id).event_type == "OrderConfirmed"
      - result.status == CONFIRMED
      - result.version == input.expected_version + 1
    }

    invariants {
      - optimistic concurrency via version check
    }
  }

  behavior ShipOrder {
    description: "Mark a confirmed order as shipped"

    input {
      order_id: UUID
      tracking_number: String
      expected_version: Int
    }

    output {
      success: OrderProjection
      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
          retriable: false
        }
        INVALID_STATUS {
          when: "Order is not in CONFIRMED status"
          retriable: false
        }
        VERSION_CONFLICT {
          when: "Expected version does not match"
          retriable: true
        }
      }
    }

    pre {
      OrderProjection.exists(order_id)
      OrderProjection.lookup(order_id).status == CONFIRMED
      OrderProjection.lookup(order_id).version == expected_version
    }

    post success {
      - Event.latest_for_stream(order_id).event_type == "OrderShipped"
      - Event.latest_for_stream(order_id).payload.tracking_number == input.tracking_number
      - result.status == SHIPPED
      - result.version == input.expected_version + 1
    }
  }

  behavior CancelOrder {
    description: "Cancel an order (only before shipping)"

    input {
      order_id: UUID
      reason: String
      expected_version: Int
    }

    output {
      success: OrderProjection
      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
          retriable: false
        }
        ALREADY_SHIPPED {
          when: "Cannot cancel a shipped or delivered order"
          retriable: false
        }
        VERSION_CONFLICT {
          when: "Expected version does not match"
          retriable: true
        }
      }
    }

    pre {
      OrderProjection.exists(order_id)
      OrderProjection.lookup(order_id).status in [CREATED, CONFIRMED]
      OrderProjection.lookup(order_id).version == expected_version
    }

    post success {
      - Event.latest_for_stream(order_id).event_type == "OrderCancelled"
      - result.status == CANCELLED
    }

    invariants {
      - shipped/delivered orders cannot be cancelled
    }
  }

  behavior ReplayEvents {
    description: "Rebuild projection from event stream"

    input {
      stream_id: UUID
    }

    output {
      success: OrderProjection
      errors {
        STREAM_NOT_FOUND {
          when: "No events exist for this stream"
          retriable: false
        }
      }
    }

    pre {
      Event.exists_for_stream(stream_id)
    }

    post success {
      - result == fold(Event.all_for_stream(stream_id))
      - result is identical to current projection
    }

    invariants {
      - replay is deterministic: same events always produce same projection
      - replay does not create new events
    }
  }

  scenario "Order lifecycle with event replay" {
    step create = CreateOrder({ customer_id: cust.id, items: [{ product_id: p1, quantity: 2, price: 25.00 }] })
    assert create.result.status == CREATED
    assert create.result.total == 50.00

    step confirm = ConfirmOrder({ order_id: create.result.id, expected_version: 1 })
    assert confirm.result.status == CONFIRMED

    step ship = ShipOrder({ order_id: create.result.id, tracking_number: "TRK-001", expected_version: 2 })
    assert ship.result.status == SHIPPED

    step replay = ReplayEvents({ stream_id: create.result.id })
    assert replay.result.status == SHIPPED
    assert replay.result.total == 50.00
    assert replay.result.version == ship.result.version
  }

  scenario "Optimistic concurrency conflict" {
    step create = CreateOrder({ customer_id: cust.id, items: [{ product_id: p1, quantity: 1, price: 10.00 }] })

    step confirm = ConfirmOrder({ order_id: create.result.id, expected_version: 999 })
    assert confirm.error == VERSION_CONFLICT
  }
}
