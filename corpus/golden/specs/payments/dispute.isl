// Payments: Dispute/chargeback handling
domain PaymentsDispute {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum DisputeStatus {
    WARNING_NEEDS_RESPONSE
    WARNING_UNDER_REVIEW
    WARNING_CLOSED
    NEEDS_RESPONSE
    UNDER_REVIEW
    WON
    LOST
  }

  enum DisputeReason {
    DUPLICATE
    FRAUDULENT
    SUBSCRIPTION_CANCELED
    PRODUCT_UNACCEPTABLE
    PRODUCT_NOT_RECEIVED
    UNRECOGNIZED
    CREDIT_NOT_PROCESSED
    GENERAL
  }

  type DisputeEvidence = {
    access_activity_log: String?
    billing_address: String?
    cancellation_policy: String?
    cancellation_rebuttal: String?
    customer_communication: String?
    customer_email_address: String?
    customer_name: String?
    customer_signature: String?
    product_description: String?
    receipt: String?
    refund_policy: String?
    refund_refusal_explanation: String?
    service_date: String?
    service_documentation: String?
    shipping_address: String?
    shipping_carrier: String?
    shipping_date: String?
    shipping_documentation: String?
    shipping_tracking_number: String?
    uncategorized_file: String?
    uncategorized_text: String?
  }

  entity Dispute {
    id: UUID [immutable, unique]
    charge_id: UUID [indexed]
    amount: Decimal
    currency: String
    reason: DisputeReason
    status: DisputeStatus
    evidence: DisputeEvidence?
    evidence_due_by: Timestamp?
    is_charge_refundable: Boolean
    network_reason_code: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      amount > 0
    }

    lifecycle {
      NEEDS_RESPONSE -> UNDER_REVIEW
      UNDER_REVIEW -> WON
      UNDER_REVIEW -> LOST
      WARNING_NEEDS_RESPONSE -> WARNING_UNDER_REVIEW
      WARNING_UNDER_REVIEW -> WARNING_CLOSED
    }
  }

  behavior GetDispute {
    description: "Get dispute details"

    actors {
      Merchant { must: authenticated }
    }

    input {
      dispute_id: UUID
    }

    output {
      success: Dispute

      errors {
        NOT_FOUND {
          when: "Dispute not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Dispute.exists(input.dispute_id)
    }
  }

  behavior SubmitEvidence {
    description: "Submit dispute evidence"

    actors {
      Merchant { must: authenticated }
    }

    input {
      dispute_id: UUID
      evidence: DisputeEvidence
      submit: Boolean?
    }

    output {
      success: Dispute

      errors {
        NOT_FOUND {
          when: "Dispute not found"
          retriable: false
        }
        PAST_DEADLINE {
          when: "Evidence deadline has passed"
          retriable: false
        }
        ALREADY_SUBMITTED {
          when: "Evidence already submitted"
          retriable: false
        }
        DISPUTE_CLOSED {
          when: "Dispute is already closed"
          retriable: false
        }
      }
    }

    pre {
      Dispute.exists(input.dispute_id)
      Dispute.lookup(input.dispute_id).status == NEEDS_RESPONSE or Dispute.lookup(input.dispute_id).status == WARNING_NEEDS_RESPONSE
      Dispute.lookup(input.dispute_id).evidence_due_by > now()
    }

    post success {
      - result.evidence != null
      - input.submit == true implies result.status == UNDER_REVIEW
    }
  }

  behavior CloseDispute {
    description: "Accept and close a dispute"

    actors {
      Merchant { must: authenticated }
    }

    input {
      dispute_id: UUID
    }

    output {
      success: Dispute

      errors {
        NOT_FOUND {
          when: "Dispute not found"
          retriable: false
        }
        ALREADY_CLOSED {
          when: "Dispute already closed"
          retriable: false
        }
      }
    }

    pre {
      Dispute.exists(input.dispute_id)
      Dispute.lookup(input.dispute_id).status == NEEDS_RESPONSE
    }

    post success {
      - result.status == LOST
    }
  }

  behavior ListDisputes {
    description: "List disputes"

    actors {
      Merchant { must: authenticated }
    }

    input {
      charge_id: UUID?
      status: DisputeStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        disputes: List<Dispute>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  behavior GetDisputeMetrics {
    description: "Get dispute rate metrics"

    actors {
      Merchant { must: authenticated }
    }

    input {
      from: Timestamp?
      to: Timestamp?
    }

    output {
      success: {
        total_disputes: Int
        won_disputes: Int
        lost_disputes: Int
        pending_disputes: Int
        dispute_rate: Decimal
        win_rate: Decimal
        total_amount_disputed: Decimal
        total_amount_lost: Decimal
      }
    }
  }

  scenarios SubmitEvidence {
    scenario "submit shipping evidence" {
      given {
        dispute = Dispute.create(
          status: NEEDS_RESPONSE,
          evidence_due_by: now() + 7.days
        )
      }

      when {
        result = SubmitEvidence(
          dispute_id: dispute.id,
          evidence: {
            shipping_carrier: "FedEx",
            shipping_tracking_number: "1234567890",
            shipping_documentation: "Signed delivery receipt"
          },
          submit: true
        )
      }

      then {
        result is success
        result.status == UNDER_REVIEW
      }
    }

    scenario "past deadline" {
      given {
        dispute = Dispute.create(
          status: NEEDS_RESPONSE,
          evidence_due_by: now() - 1.day
        )
      }

      when {
        result = SubmitEvidence(
          dispute_id: dispute.id,
          evidence: { customer_name: "John" },
          submit: true
        )
      }

      then {
        result is PAST_DEADLINE
      }
    }
  }
}
