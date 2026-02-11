domain Broken {
  version: "1.0.0"

  behavior transfer {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - transfer never_throws_unhandled
    }
  }
  behavior getBalance {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getBalance never_throws_unhandled
    }
  }
}
