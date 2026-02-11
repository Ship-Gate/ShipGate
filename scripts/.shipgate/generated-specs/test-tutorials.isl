domain TestTutorials {
  version: "1.0.0"

  entity TestResult {
    id: String
  }

  behavior log {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - log never_throws_unhandled
    }
  }
  behavior error {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - error never_throws_unhandled
    }
  }
  behavior success {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - success never_throws_unhandled
    }
  }
  behavior warning {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - warning never_throws_unhandled
    }
  }
  behavior runCommand {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runCommand never_throws_unhandled
    }
  }
  behavior testTutorialSpec {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - testTutorialSpec never_throws_unhandled
    }
  }
  behavior testSampleProject {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - testSampleProject never_throws_unhandled
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
