domain DeleteExpectation {
  version: "1.0.0"

  behavior isExpectationLine {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isExpectationLine never_throws_unhandled
    }
  }
}
