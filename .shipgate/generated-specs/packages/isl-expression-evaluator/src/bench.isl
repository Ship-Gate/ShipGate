# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain Bench {
  version: "1.0.0"

  behavior loc {
    input {
    }

    output {
      success: Void
    }

    invariants {
      - loc never_throws_unhandled
    }
  }
  behavior bool {
    input {
      value: Boolean
    }

    output {
      success: Expression
    }

    invariants {
      - bool never_throws_unhandled
    }
  }
  behavior num {
    input {
      value: Int
    }

    output {
      success: Expression
    }

    invariants {
      - num never_throws_unhandled
    }
  }
  behavior id {
    input {
      name: String
    }

    output {
      success: Expression
    }

    invariants {
      - id never_throws_unhandled
    }
  }
  behavior bin {
    input {
      op: String
      left: Expression
      right: Expression
    }

    output {
      success: Expression
    }

    invariants {
      - bin never_throws_unhandled
    }
  }
  behavior quantifier {
    input {
      quant: String
      variable: String
      collection: Expression
      predicate: Expression
    }

    output {
      success: Expression
    }

    invariants {
      - quantifier never_throws_unhandled
    }
  }
}
