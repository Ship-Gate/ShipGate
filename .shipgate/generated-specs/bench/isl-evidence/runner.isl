domain Runner {
  version: "1.0.0"

  entity CLIOptions {
    id: String
  }
  entity CommandResult {
    id: String
  }

  behavior parseCliArgs {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - parseCliArgs never_throws_unhandled
    }
  }
  behavior printHelp {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printHelp never_throws_unhandled
    }
  }
  behavior executeCommand {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - executeCommand never_throws_unhandled
    }
  }
  behavior should {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - should never_throws_unhandled
    }
  }
  behavior runTranslateStep {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runTranslateStep never_throws_unhandled
    }
  }
  behavior should {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - should never_throws_unhandled
    }
  }
  behavior runGenerateStep {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runGenerateStep never_throws_unhandled
    }
  }
  behavior runVerifyStep {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runVerifyStep never_throws_unhandled
    }
  }
  behavior runSample {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runSample never_throws_unhandled
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
