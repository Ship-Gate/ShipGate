domain DemoSimulator {
  version: "1.0.0"

  behavior runDemo {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runDemo never_throws_unhandled
    }
  }
}
