domain CiRegressionCheck {
  version: "1.0.0"

  entity Regression {
    id: String
  }

  behavior loadBaseline {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadBaseline never_throws_unhandled
    }
  }
  behavior saveBaseline {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - saveBaseline never_throws_unhandled
    }
  }
  behavior findResult {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - findResult never_throws_unhandled
    }
  }
  behavior detectRegressions {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - detectRegressions never_throws_unhandled
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
