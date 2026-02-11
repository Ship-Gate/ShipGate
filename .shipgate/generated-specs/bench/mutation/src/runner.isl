domain Runner {
  version: "1.0.0"

  behavior increment {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - increment never_throws_unhandled
    }
  }
}
