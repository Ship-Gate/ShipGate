domain GenerateSbom {
  version: "1.0.0"

  entity Component {
    id: String
  }
  entity CycloneDXBOM {
    id: String
  }

  behavior getPackageInfo {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getPackageInfo never_throws_unhandled
    }
  }
  behavior getDependencies {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getDependencies never_throws_unhandled
    }
  }
  behavior processDependencies {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - processDependencies never_throws_unhandled
    }
  }
  behavior generatePURL {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generatePURL never_throws_unhandled
    }
  }
  behavior generateComponentHash {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateComponentHash never_throws_unhandled
    }
  }
  behavior generateSBOM {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateSBOM never_throws_unhandled
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
