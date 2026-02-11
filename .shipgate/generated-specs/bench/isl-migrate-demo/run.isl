domain Run {
  version: "1.0.0"

  entity DemoOptions {
    id: String
  }
  entity MigrationSource {
    id: String
  }

  behavior loadMigrator {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadMigrator never_throws_unhandled
    }
  }
  behavior parseArgs {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - parseArgs never_throws_unhandled
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
  behavior loadSamples {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadSamples never_throws_unhandled
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
  behavior printSubHeader {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printSubHeader never_throws_unhandled
    }
  }
  behavior async {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - async never_throws_unhandled
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
