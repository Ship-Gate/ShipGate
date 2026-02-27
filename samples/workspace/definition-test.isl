domain DefinitionTest {
  version: "1.0.0"

  entity User {
    id: UUID @unique
    email: String
    name: String
  }

  entity Order {
    id: UUID @unique
    userId: UUID
    total: Decimal
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
    }
  }

  behavior CreateOrder {
    input {
      userId: UUID
      total: Decimal
    }

    output {
      success: Order
    }
  }

  // Test go-to-definition:
  // 1. Ctrl+Click on "User" below - should jump to entity User definition above
  // 2. Ctrl+Click on "CreateUser" below - should jump to behavior CreateUser definition above
  // 3. Ctrl+Click on "Order" below - should jump to entity Order definition above

  behavior ProcessOrder {
    input {
      user: User
      createUserAction: CreateUser
      order: Order
    }

    output {
      success: Boolean
    }
  }
}
