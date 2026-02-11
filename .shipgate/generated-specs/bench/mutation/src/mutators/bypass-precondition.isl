domain BypassPrecondition {
  version: "1.0.0"

  behavior definition {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - definition never_throws_unhandled
    }
  }
  behavior isPreconditionFunction {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isPreconditionFunction never_throws_unhandled
    }
  }
  behavior body {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - body never_throws_unhandled
    }
  }
  behavior isPreconditionBody {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isPreconditionBody never_throws_unhandled
    }
  }
  behavior or {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - or never_throws_unhandled
    }
  }
  behavior definition {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - definition never_throws_unhandled
    }
  }
  behavior body {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - body never_throws_unhandled
    }
  }
  behavior at {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - at never_throws_unhandled
    }
  }
}
