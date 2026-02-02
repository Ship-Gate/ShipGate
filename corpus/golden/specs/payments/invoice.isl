// Payments: Invoice management
domain PaymentsInvoice {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum InvoiceStatus {
    DRAFT
    OPEN
    PAID
    VOID
    UNCOLLECTIBLE
  }

  type InvoiceLineItem = {
    description: String
    quantity: Int
    unit_amount: Decimal
    amount: Decimal
    period_start: Timestamp?
    period_end: Timestamp?
  }

  entity Invoice {
    id: UUID [immutable, unique]
    number: String [unique]
    customer_id: UUID [indexed]
    subscription_id: UUID? [indexed]
    status: InvoiceStatus
    currency: String
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    amount_due: Decimal
    amount_paid: Decimal
    lines: List<InvoiceLineItem>
    description: String?
    footer: String?
    due_date: Timestamp?
    paid_at: Timestamp?
    voided_at: Timestamp?
    hosted_invoice_url: String?
    pdf_url: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      total == subtotal + tax
      amount_paid >= 0
      amount_paid <= total
      amount_due == total - amount_paid
      status == PAID implies paid_at != null
      status == VOID implies voided_at != null
    }

    lifecycle {
      DRAFT -> OPEN
      OPEN -> PAID
      OPEN -> VOID
      OPEN -> UNCOLLECTIBLE
    }
  }

  behavior CreateInvoice {
    description: "Create a new invoice"

    actors {
      Merchant { must: authenticated }
      System { }
    }

    input {
      customer_id: UUID
      lines: List<InvoiceLineItem>
      description: String?
      footer: String?
      due_date: Timestamp?
      auto_finalize: Boolean?
    }

    output {
      success: Invoice

      errors {
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
          retriable: false
        }
        EMPTY_INVOICE {
          when: "Invoice has no line items"
          retriable: true
        }
        INVALID_LINE_ITEM {
          when: "Line item is invalid"
          retriable: true
        }
      }
    }

    pre {
      input.lines.length > 0
      all(line in input.lines: line.quantity > 0)
    }

    post success {
      - Invoice.exists(result.id)
      - result.customer_id == input.customer_id
      - input.auto_finalize == true implies result.status == OPEN
      - input.auto_finalize != true implies result.status == DRAFT
    }
  }

  behavior FinalizeInvoice {
    description: "Finalize a draft invoice"

    actors {
      Merchant { must: authenticated }
    }

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
        NOT_DRAFT {
          when: "Invoice is not in draft status"
          retriable: false
        }
      }
    }

    pre {
      Invoice.exists(input.invoice_id)
      Invoice.lookup(input.invoice_id).status == DRAFT
    }

    post success {
      - result.status == OPEN
      - result.number != null
      - result.hosted_invoice_url != null
    }
  }

  behavior PayInvoice {
    description: "Pay an open invoice"

    actors {
      Customer { must: authenticated }
      System { }
    }

    input {
      invoice_id: UUID
      payment_method_id: UUID?
    }

    output {
      success: Invoice

      errors {
        INVOICE_NOT_FOUND {
          when: "Invoice does not exist"
          retriable: false
        }
        NOT_OPEN {
          when: "Invoice is not open"
          retriable: false
        }
        PAYMENT_FAILED {
          when: "Payment failed"
          retriable: true
        }
      }
    }

    pre {
      Invoice.exists(input.invoice_id)
      Invoice.lookup(input.invoice_id).status == OPEN
    }

    post success {
      - result.status == PAID
      - result.paid_at != null
      - result.amount_paid == result.total
      - result.amount_due == 0
    }
  }

  behavior VoidInvoice {
    description: "Void an invoice"

    actors {
      Merchant { must: authenticated }
    }

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
        CANNOT_VOID {
          when: "Invoice cannot be voided"
          retriable: false
        }
      }
    }

    pre {
      Invoice.exists(input.invoice_id)
      Invoice.lookup(input.invoice_id).status == OPEN or Invoice.lookup(input.invoice_id).status == DRAFT
    }

    post success {
      - result.status == VOID
      - result.voided_at != null
    }
  }

  behavior SendInvoice {
    description: "Send invoice to customer"

    actors {
      Merchant { must: authenticated }
    }

    input {
      invoice_id: UUID
    }

    output {
      success: Boolean

      errors {
        INVOICE_NOT_FOUND {
          when: "Invoice does not exist"
          retriable: false
        }
        NOT_FINALIZED {
          when: "Invoice must be finalized first"
          retriable: false
        }
      }
    }

    pre {
      Invoice.exists(input.invoice_id)
      Invoice.lookup(input.invoice_id).status == OPEN
    }

    temporal {
      - eventually within 5m: email sent to customer
    }
  }

  behavior ListInvoices {
    description: "List invoices"

    actors {
      Merchant { must: authenticated }
      Customer { must: authenticated }
    }

    input {
      customer_id: UUID?
      subscription_id: UUID?
      status: InvoiceStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        invoices: List<Invoice>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  scenarios CreateInvoice {
    scenario "create draft invoice" {
      when {
        result = CreateInvoice(
          customer_id: "cust-123",
          lines: [
            { description: "Service", quantity: 1, unit_amount: 100.00, amount: 100.00 }
          ]
        )
      }

      then {
        result is success
        result.status == DRAFT
        result.total == 100.00
      }
    }

    scenario "create and finalize" {
      when {
        result = CreateInvoice(
          customer_id: "cust-123",
          lines: [
            { description: "Service", quantity: 2, unit_amount: 50.00, amount: 100.00 }
          ],
          auto_finalize: true
        )
      }

      then {
        result is success
        result.status == OPEN
      }
    }
  }
}
