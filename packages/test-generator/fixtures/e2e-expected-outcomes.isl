// E2E Test Generation Fixture: Expected Outcome Computation
// Tests that postconditions correctly generate expected values
domain ExpectedOutcomeFixture {
  version: "1.0.0"

  type Money = Decimal {
    min: 0
    precision: 2
  }

  type Percentage = Decimal {
    min: 0
    max: 100
    precision: 2
  }

  entity Invoice {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    subtotal: Money
    tax_rate: Percentage
    tax_amount: Money
    discount_amount: Money
    total: Money
    status: InvoiceStatus
    created_at: Timestamp [immutable]

    invariants {
      subtotal >= 0
      tax_amount >= 0
      discount_amount >= 0
      total >= 0
    }
  }

  enum InvoiceStatus {
    DRAFT
    PENDING
    PAID
    CANCELLED
  }

  behavior CreateInvoice {
    description: "Create an invoice with computed totals"

    input {
      customer_id: UUID
      subtotal: Money
      tax_rate: Percentage
      discount_amount: Money?
    }

    output {
      success: Invoice

      errors {
        INVALID_CUSTOMER {
          when: "Customer does not exist"
          retriable: false
        }
        INVALID_SUBTOTAL {
          when: "Subtotal must be positive"
          retriable: true
        }
        DISCOUNT_TOO_LARGE {
          when: "Discount exceeds subtotal"
          retriable: true
        }
      }
    }

    preconditions {
      input.subtotal > 0
      input.tax_rate >= 0
      input.tax_rate <= 100
    }

    postconditions {
      success implies {
        Invoice.exists(result.id)
        Invoice.lookup(result.id).customer_id == input.customer_id
        Invoice.lookup(result.id).subtotal == input.subtotal
        Invoice.lookup(result.id).tax_rate == input.tax_rate
        Invoice.lookup(result.id).status == DRAFT
      }

      INVALID_CUSTOMER implies {
        Invoice.count == old(Invoice.count)
      }
    }
  }

  behavior ApplyDiscount {
    description: "Apply discount to an invoice"

    input {
      invoice_id: UUID
      discount_percentage: Percentage
    }

    output {
      success: Invoice

      errors {
        INVOICE_NOT_FOUND {
          when: "Invoice does not exist"
          retriable: false
        }
        INVOICE_NOT_EDITABLE {
          when: "Invoice cannot be modified"
          retriable: false
        }
        INVALID_DISCOUNT {
          when: "Discount percentage is invalid"
          retriable: true
        }
      }
    }

    preconditions {
      Invoice.exists(input.invoice_id)
      Invoice.lookup(input.invoice_id).status == DRAFT
      input.discount_percentage >= 0
      input.discount_percentage <= 100
    }

    postconditions {
      success implies {
        Invoice.lookup(input.invoice_id).discount_amount >= 0
        Invoice.lookup(input.invoice_id).total >= 0
      }
    }
  }

  behavior FinalizeInvoice {
    description: "Finalize and send invoice"

    input {
      invoice_id: UUID
    }

    output {
      success: Invoice

      errors {
        INVOICE_NOT_FOUND {
          when: "Invoice does not exist"
          retriable: false
        }
        ALREADY_FINALIZED {
          when: "Invoice is already finalized"
          retriable: false
        }
      }
    }

    preconditions {
      Invoice.exists(input.invoice_id)
      Invoice.lookup(input.invoice_id).status == DRAFT
    }

    postconditions {
      success implies {
        Invoice.lookup(input.invoice_id).status == PENDING
      }
    }
  }
}
