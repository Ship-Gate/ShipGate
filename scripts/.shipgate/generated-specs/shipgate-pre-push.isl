domain ShipgatePrePush {
  version: "1.0.0"

  behavior getFilesToCheck {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getFilesToCheck never_throws_unhandled
    }
  }
  behavior filterSourceFiles {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - filterSourceFiles never_throws_unhandled
    }
  }
  behavior runGate {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runGate never_throws_unhandled
    }
  }
  behavior main {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - main never_throws_unhandled
    }
  }
}
