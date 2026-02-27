domain Ecommerce {
  version: "1.0.0"
  owner: "ecommerce-team"

  entity User {
    id: UUID @unique @immutable
    email: String @unique
    name: String
    createdAt: Timestamp @immutable
    status: UserStatus

    invariants {
      email.is_valid()
      name.length > 0
    }

    lifecycle {
      Created -> Active
      Active -> Suspended
      Suspended -> Active
      Active -> Archived
    }
  }

  entity Order {
    id: UUID @unique @immutable
    userId: UUID
    items: List<OrderItem>
    total: Decimal
    status: OrderStatus
    createdAt: Timestamp @immutable

    invariants {
      total >= 0
      items.length > 0
    }
  }

  type OrderItem = {
    productId: UUID
    quantity: Int
    price: Decimal
  }

  enum UserStatus {
    Created
    Active
    Suspended
    Archived
  }

  enum OrderStatus {
    Pending
    Confirmed
    Shipped
    Delivered
    Cancelled
  }

  behavior CreateUser {
    description: "Create a new user account"

    input {
      email: String
      name: String
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
      }
    }

    preconditions {
      email.is_valid()
      not User.exists_by_email(email)
    }

    postconditions {
      success implies {
        result.id != null
        result.email == input.email
        result.status == UserStatus.Created
      }
    }
  }

  behavior CreateOrder {
    description: "Create a new order"

    input {
      userId: UUID
      items: List<OrderItem>
    }

    output {
      success: Order

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        EMPTY_CART {
          when: "Order must have at least one item"
          retriable: false
        }
      }
    }

    preconditions {
      User.exists(input.userId)
      input.items.length > 0
    }

    postconditions {
      success implies {
        result.userId == input.userId
        result.items == input.items
        result.status == OrderStatus.Pending
        result.total == sum(input.items.map(item => item.price * item.quantity))
      }
    }

    temporal {
      response within 200.ms (p50)
      response within 500.ms (p99)
    }

    security {
      requires: authenticated
      rate_limit 10 per minute per user
    }
  }
}
