domain EcommerceEntities {
  version: "1.0.0"

  entity Product {
    id: UUID [immutable, unique]
    name: String
    price: Decimal
    stock: Int
  }

  entity Order {
    id: UUID [immutable, unique]
    user_id: UUID
    total: Decimal
    status: String
  }

  entity OrderItem {
    id: UUID [immutable, unique]
    order_id: UUID
    product_id: UUID
    quantity: Int
    price: Decimal
  }

  entity Customer {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
  }
}
