domain WithViews {
  version: "1.0.0"

  entity Order {
    id: UUID [immutable, unique]
    total: Decimal
    item_count: Int
    created_at: Timestamp
  }

  view OrderSummary {
    for: Order
    fields {
      total_revenue: Decimal = Order.total
      avg_order: Decimal = Order.total
    }
    consistency { eventual }
  }
}
