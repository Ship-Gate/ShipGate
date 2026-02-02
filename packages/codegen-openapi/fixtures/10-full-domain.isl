// Full domain with all features
domain ECommerce {
  version: "2.0.0"
  
  // Constrained types
  type Email = String {
    format: email
    max_length: 254
  }
  
  type Money = Decimal {
    min: 0
    precision: 2
  }
  
  type Quantity = Int {
    min: 1
    max: 9999
  }
  
  type SKU = String {
    min_length: 3
    max_length: 32
  }
  
  // Enums
  enum OrderStatus {
    PENDING
    CONFIRMED
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
    REFUNDED
  }
  
  enum PaymentMethod {
    CREDIT_CARD
    DEBIT_CARD
    PAYPAL
    BANK_TRANSFER
  }
  
  // Nested types
  type Address = {
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String
  }
  
  type OrderItem = {
    product_id: UUID
    sku: SKU
    name: String
    quantity: Quantity
    unit_price: Money
    total: Money
  }
  
  // Entities
  entity Customer {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    name: String
    phone: String?
    shipping_address: Address?
    billing_address: Address?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity Product {
    id: UUID [immutable, unique]
    sku: SKU [unique, indexed]
    name: String
    description: String?
    price: Money
    stock: Int
    active: Boolean
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity Order {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    items: List<OrderItem>
    subtotal: Money
    tax: Money
    total: Money
    status: OrderStatus
    payment_method: PaymentMethod?
    shipping_address: Address
    notes: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  // Behaviors
  behavior CreateCustomer {
    description: "Register a new customer"
    input {
      email: Email
      name: String
      phone: String?
      shipping_address: Address?
    }
    output {
      success: Customer
      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
        }
        INVALID_ADDRESS {
          when: "Address is invalid"
        }
      }
    }
  }
  
  behavior GetCustomer {
    input {
      id: UUID
    }
    output {
      success: Customer
      errors {
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
        }
      }
    }
  }
  
  behavior CreateOrder {
    description: "Create a new order"
    input {
      customer_id: UUID
      items: List<OrderItem>
      shipping_address: Address
      payment_method: PaymentMethod
      notes: String?
    }
    output {
      success: Order
      errors {
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
        }
        PRODUCT_NOT_FOUND {
          when: "Product does not exist"
        }
        INSUFFICIENT_STOCK {
          when: "Not enough stock"
        }
        INVALID_QUANTITY {
          when: "Quantity must be positive"
        }
      }
    }
  }
  
  behavior GetOrder {
    input {
      id: UUID
    }
    output {
      success: Order
      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
        }
      }
    }
  }
  
  behavior UpdateOrderStatus {
    description: "Update order status"
    input {
      id: UUID
      status: OrderStatus
    }
    output {
      success: Order
      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
        }
        INVALID_STATUS_TRANSITION {
          when: "Invalid status transition"
        }
      }
    }
  }
  
  behavior ListOrders {
    description: "List orders with filtering"
    input {
      customer_id: UUID?
      status: OrderStatus?
      page: Int?
      page_size: Int?
    }
    output {
      success: List<Order>
    }
  }
  
  behavior CancelOrder {
    description: "Cancel an order"
    input {
      id: UUID
      reason: String?
    }
    output {
      success: Order
      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
        }
        ORDER_NOT_CANCELLABLE {
          when: "Order cannot be cancelled"
        }
      }
    }
  }
}
