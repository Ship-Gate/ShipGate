domain XfailHarness {
  version: "1.0.0"

  entity XFailSummary {
    id: String
  }
  entity XFailHarness {
    id: String
  }

  behavior createXFailHarness {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - createXFailHarness never_throws_unhandled
    }
  }
  behavior withXFail {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - withXFail never_throws_unhandled
    }
  }
  behavior createFixtureRunner {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - createFixtureRunner never_throws_unhandled
    }
  }
}
