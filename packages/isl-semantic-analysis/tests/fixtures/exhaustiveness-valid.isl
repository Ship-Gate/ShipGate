// Fixture: Valid exhaustiveness - all cases covered
// Expected: No diagnostics from exhaustiveness pass
// Pass: exhaustiveness

domain ValidExhaustivenessTest {
  version: "1.0.0"

  enum PaymentStatus {
    Pending
    Processing
    Completed
    Failed
    Refunded
  }

  entity Payment {
    id: UUID [immutable]
    status: PaymentStatus
    amount: Decimal
  }

  behavior ProcessPayment {
    input {
      paymentId: UUID
    }
    output {
      success: Payment
      errors: [PaymentNotFound, InvalidStatus]
    }

    preconditions {
      // Exhaustive enum handling
      when input.status == PaymentStatus.Pending {
        canProcess == true
      }
      when input.status == PaymentStatus.Processing {
        // Already processing
        false
      }
      when input.status == PaymentStatus.Completed {
        // Already completed
        false
      }
      when input.status == PaymentStatus.Failed {
        canRetry == true
      }
      when input.status == PaymentStatus.Refunded {
        // Cannot process refunded payment
        false
      }
    }

    postconditions {
      when success {
        result.status == PaymentStatus.Completed or
        result.status == PaymentStatus.Processing
      }
      when PaymentNotFound {
        result == null
      }
      when InvalidStatus {
        payment.status == old(payment.status)
      }
    }
  }
}
