domain Xfail {
  version: "1.0.0"

  entity XFailEntry {
    id: String
  }
  entity XFailConfig {
    id: String
  }

  behavior getXFailConfig {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getXFailConfig never_throws_unhandled
    }
  }
  behavior shouldSkip {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - shouldSkip never_throws_unhandled
    }
  }
  behavior isXFail {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isXFail never_throws_unhandled
    }
  }
}
