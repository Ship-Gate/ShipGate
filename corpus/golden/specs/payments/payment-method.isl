// Payments: Payment method management
domain PaymentsPaymentMethod {
  version: "1.0.0"

  enum PaymentMethodType {
    CARD
    BANK_ACCOUNT
    SEPA_DEBIT
    IDEAL
    LINK
  }

  type CardDetails = {
    brand: String
    last_four: String
    exp_month: Int
    exp_year: Int
    fingerprint: String
  }

  type BillingDetails = {
    name: String?
    email: String?
    phone: String?
    address: {
      line1: String?
      line2: String?
      city: String?
      state: String?
      postal_code: String?
      country: String?
    }?
  }

  entity PaymentMethod {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    type: PaymentMethodType
    card: CardDetails?
    billing_details: BillingDetails?
    is_default: Boolean [default: false]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      type == CARD implies card != null
    }
  }

  behavior CreatePaymentMethod {
    description: "Add a payment method"

    actors {
      Customer { must: authenticated }
    }

    input {
      type: PaymentMethodType
      card: {
        number: String
        exp_month: Int
        exp_year: Int
        cvv: String
      }? [sensitive]
      billing_details: BillingDetails?
      set_as_default: Boolean?
    }

    output {
      success: PaymentMethod

      errors {
        INVALID_CARD {
          when: "Card details are invalid"
          retriable: true
        }
        CARD_DECLINED {
          when: "Card was declined"
          retriable: true
        }
        EXPIRED_CARD {
          when: "Card has expired"
          retriable: false
        }
        DUPLICATE_CARD {
          when: "Card already exists"
          retriable: false
        }
        UNSUPPORTED_TYPE {
          when: "Payment method type not supported"
          retriable: false
        }
      }
    }

    pre {
      input.type == CARD implies input.card != null
      input.card == null or (input.card.exp_year >= 2024 and input.card.exp_month >= 1 and input.card.exp_month <= 12)
    }

    post success {
      - PaymentMethod.exists(result.id)
      - result.customer_id == actor.id
      - input.set_as_default == true implies result.is_default == true
    }

    invariants {
      - card number never logged
      - cvv never stored
    }

    security {
      - PCI-DSS compliance
    }
  }

  behavior GetPaymentMethod {
    description: "Get payment method details"

    actors {
      Customer { must: authenticated }
    }

    input {
      payment_method_id: UUID
    }

    output {
      success: PaymentMethod

      errors {
        NOT_FOUND {
          when: "Payment method not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      PaymentMethod.exists(input.payment_method_id)
    }
  }

  behavior UpdatePaymentMethod {
    description: "Update payment method"

    actors {
      Customer { must: authenticated }
    }

    input {
      payment_method_id: UUID
      billing_details: BillingDetails?
      exp_month: Int?
      exp_year: Int?
    }

    output {
      success: PaymentMethod

      errors {
        NOT_FOUND {
          when: "Payment method not found"
          retriable: false
        }
        INVALID_EXPIRY {
          when: "Invalid expiry date"
          retriable: true
        }
      }
    }

    pre {
      PaymentMethod.exists(input.payment_method_id)
      PaymentMethod.lookup(input.payment_method_id).customer_id == actor.id
    }

    post success {
      - input.billing_details != null implies result.billing_details == input.billing_details
    }
  }

  behavior DeletePaymentMethod {
    description: "Remove a payment method"

    actors {
      Customer { must: authenticated }
    }

    input {
      payment_method_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Payment method not found"
          retriable: false
        }
        IN_USE {
          when: "Payment method is in use"
          retriable: false
        }
        LAST_METHOD {
          when: "Cannot delete last payment method"
          retriable: false
        }
      }
    }

    pre {
      PaymentMethod.exists(input.payment_method_id)
      PaymentMethod.lookup(input.payment_method_id).customer_id == actor.id
    }

    post success {
      - not PaymentMethod.exists(input.payment_method_id)
    }
  }

  behavior SetDefaultPaymentMethod {
    description: "Set default payment method"

    actors {
      Customer { must: authenticated }
    }

    input {
      payment_method_id: UUID
    }

    output {
      success: PaymentMethod

      errors {
        NOT_FOUND {
          when: "Payment method not found"
          retriable: false
        }
      }
    }

    pre {
      PaymentMethod.exists(input.payment_method_id)
      PaymentMethod.lookup(input.payment_method_id).customer_id == actor.id
    }

    post success {
      - result.is_default == true
      - all(pm in PaymentMethod.where(customer_id: actor.id, id != input.payment_method_id): pm.is_default == false)
    }
  }

  behavior ListPaymentMethods {
    description: "List customer payment methods"

    actors {
      Customer { must: authenticated }
    }

    input {
      type: PaymentMethodType?
    }

    output {
      success: List<PaymentMethod>
    }

    post success {
      - all(pm in result: pm.customer_id == actor.id)
      - input.type != null implies all(pm in result: pm.type == input.type)
    }
  }

  scenarios CreatePaymentMethod {
    scenario "add card" {
      when {
        result = CreatePaymentMethod(
          type: CARD,
          card: {
            number: "4242424242424242",
            exp_month: 12,
            exp_year: 2025,
            cvv: "123"
          },
          set_as_default: true
        )
      }

      then {
        result is success
        result.type == CARD
        result.is_default == true
      }
    }
  }
}
