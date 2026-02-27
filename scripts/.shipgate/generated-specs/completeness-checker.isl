domain CompletenessChecker {
  version: "1.0.0"

  behavior loadManifest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadManifest never_throws_unhandled
    }
  }
  behavior checkExports {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkExports never_throws_unhandled
    }
  }
  behavior checkTests {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkTests never_throws_unhandled
    }
  }
  behavior checkDocs {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkDocs never_throws_unhandled
    }
  }
  behavior checkSampleUsage {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkSampleUsage never_throws_unhandled
    }
  }
  behavior assessPackage {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - assessPackage never_throws_unhandled
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
