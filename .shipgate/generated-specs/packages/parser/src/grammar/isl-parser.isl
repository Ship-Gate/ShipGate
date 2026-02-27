# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain IslParser {
  version: "1.0.0"

  behavior C {
    input {
    }

    output {
      success: Void
    }

    invariants {
      - C never_throws_unhandled
    }
  }
  behavior hex {
    input {
      ch: String
    }

    output {
      success: Void
    }

    invariants {
      - hex never_throws_unhandled
    }
  }
  behavior literalEscape {
    input {
      s: String
    }

    output {
      success: Void
    }

    invariants {
      - literalEscape never_throws_unhandled
    }
  }
  behavior classEscape {
    input {
      s: String
    }

    output {
      success: Void
    }

    invariants {
      - classEscape never_throws_unhandled
    }
  }
  behavior describeExpectation {
    input {
      expectation: String
    }

    output {
      success: Void
    }

    invariants {
      - describeExpectation never_throws_unhandled
    }
  }
  behavior describeExpected {
    input {
      expected: String
    }

    output {
      success: Void
    }

    invariants {
      - describeExpected never_throws_unhandled
    }
  }
  behavior describeFound {
    input {
      found: String
    }

    output {
      success: Void
    }

    invariants {
      - describeFound never_throws_unhandled
    }
  }
  behavior text {
    input {
    }

    output {
      success: Void
    }

    invariants {
      - text never_throws_unhandled
    }
  }
  behavior offset {
    input {
    }

    output {
      success: Void
    }

    invariants {
      - offset never_throws_unhandled
    }
  }
  behavior range {
    input {
    }

    output {
      success: Void
    }

    invariants {
      - range never_throws_unhandled
    }
  }
  behavior location {
    input {
    }

    output {
      success: Void
    }

    invariants {
      - location never_throws_unhandled
    }
  }
  behavior expected {
    input {
      description: String
      location: String
    }

    output {
      success: Void

      errors {
        Error {
          when: "inferred from throw statement"
        }
      }
    }

    invariants {
      - expected never_throws_unhandled
    }
  }
  behavior error {
    input {
      message: String
      location: String
    }

    output {
      success: Void

      errors {
        Error {
          when: "inferred from throw statement"
        }
      }
    }

    invariants {
      - error never_throws_unhandled
    }
  }
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
  behavior buildBinaryChain {
    input {
      head: String
      tail: String
    }

    output {
      success: Void
    }

    invariants {
      - buildBinaryChain never_throws_unhandled
    }
  }
}
