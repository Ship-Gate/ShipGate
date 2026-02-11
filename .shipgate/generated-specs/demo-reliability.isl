domain DemoReliability {
  version: "1.0.0"

  behavior login {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - login never_throws_unhandled
    }
  }
  behavior login {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - login never_throws_unhandled
    }
  }
  behavior printHeader {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printHeader never_throws_unhandled
    }
  }
  behavior printSection {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printSection never_throws_unhandled
    }
  }
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
