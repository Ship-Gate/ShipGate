// Payments: Customer management
domain PaymentsCustomer {
  version: "1.0.0"

  type Email = String { format: email, max_length: 254 }

  type Address = {
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String
  }

  entity Customer {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    name: String?
    phone: String?
    description: String?
    address: Address?
    shipping_address: Address?
    tax_id: String?
    currency: String?
    default_payment_method_id: UUID?
    balance: Decimal [default: 0]
    delinquent: Boolean [default: false]
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }

  behavior CreateCustomer {
    description: "Create a new customer"

    actors {
      Merchant { must: authenticated }
      System { }
    }

    input {
      email: Email
      name: String?
      phone: String?
      description: String?
      address: Address?
      shipping_address: Address?
      metadata: Map<String, String>?
    }

    output {
      success: Customer

      errors {
        EMAIL_EXISTS {
          when: "Email already exists"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email is invalid"
          retriable: true
        }
      }
    }

    pre {
      input.email.is_valid_format
      not Customer.exists(email: input.email)
    }

    post success {
      - Customer.exists(result.id)
      - result.email == input.email
      - result.balance == 0
      - result.delinquent == false
    }
  }

  behavior GetCustomer {
    description: "Get customer details"

    actors {
      Merchant { must: authenticated }
    }

    input {
      customer_id: UUID
    }

    output {
      success: Customer

      errors {
        NOT_FOUND {
          when: "Customer not found"
          retriable: false
        }
      }
    }

    pre {
      Customer.exists(input.customer_id)
    }
  }

  behavior UpdateCustomer {
    description: "Update customer"

    actors {
      Merchant { must: authenticated }
    }

    input {
      customer_id: UUID
      email: Email?
      name: String?
      phone: String?
      description: String?
      address: Address?
      shipping_address: Address?
      default_payment_method_id: UUID?
      metadata: Map<String, String>?
    }

    output {
      success: Customer

      errors {
        NOT_FOUND {
          when: "Customer not found"
          retriable: false
        }
        EMAIL_EXISTS {
          when: "Email already in use"
          retriable: false
        }
      }
    }

    pre {
      Customer.exists(input.customer_id)
    }

    post success {
      - result.updated_at > old(Customer.lookup(input.customer_id).updated_at)
    }
  }

  behavior DeleteCustomer {
    description: "Delete a customer"

    actors {
      Merchant { must: authenticated }
    }

    input {
      customer_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Customer not found"
          retriable: false
        }
        HAS_ACTIVE_SUBSCRIPTIONS {
          when: "Customer has active subscriptions"
          retriable: false
        }
      }
    }

    pre {
      Customer.exists(input.customer_id)
    }

    post success {
      - not Customer.exists(input.customer_id)
    }

    temporal {
      - eventually within 30.days: all data deleted per GDPR
    }
  }

  behavior ListCustomers {
    description: "List customers"

    actors {
      Merchant { must: authenticated }
    }

    input {
      email: Email?
      created_after: Timestamp?
      created_before: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        customers: List<Customer>
        total_count: Int
        has_more: Boolean
      }
    }

    pre {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
    }
  }

  behavior SearchCustomers {
    description: "Search customers"

    actors {
      Merchant { must: authenticated }
    }

    input {
      query: String
      limit: Int?
    }

    output {
      success: List<Customer>
    }

    pre {
      input.query.length > 0
      input.limit == null or (input.limit >= 1 and input.limit <= 100)
    }
  }

  behavior AdjustBalance {
    description: "Adjust customer balance"

    actors {
      Merchant { must: authenticated }
    }

    input {
      customer_id: UUID
      amount: Decimal
      description: String?
    }

    output {
      success: Customer

      errors {
        NOT_FOUND {
          when: "Customer not found"
          retriable: false
        }
        INVALID_AMOUNT {
          when: "Amount is invalid"
          retriable: true
        }
      }
    }

    pre {
      Customer.exists(input.customer_id)
    }

    post success {
      - result.balance == old(Customer.lookup(input.customer_id).balance) + input.amount
    }
  }

  scenarios CreateCustomer {
    scenario "create new customer" {
      when {
        result = CreateCustomer(
          email: "customer@example.com",
          name: "John Doe"
        )
      }

      then {
        result is success
        result.email == "customer@example.com"
        result.balance == 0
      }
    }

    scenario "duplicate email" {
      given {
        existing = Customer.create(email: "taken@example.com")
      }

      when {
        result = CreateCustomer(email: "taken@example.com")
      }

      then {
        result is EMAIL_EXISTS
      }
    }
  }
}
