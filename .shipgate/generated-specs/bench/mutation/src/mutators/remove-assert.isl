domain RemoveAssert {
  version: "1.0.0"

  behavior isAssertLine {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isAssertLine never_throws_unhandled
    }
  }
}
