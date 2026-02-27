# Shallow spec: only invariants, no postconditions, no error cases.
# A skeptical engineer should see WARN or NO_SHIP because this spec
# doesn't verify any actual behavior — it's a rubber stamp.

domain PaymentProcessor {
  version: "1.0.0"

  behavior ProcessPayment {
    input {
      amount: Int
      card_token: String
    }

    output {
      success: String
    }

    invariants {
      - ProcessPayment never_throws_unhandled
    }
  }
}
