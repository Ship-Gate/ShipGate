domain CompletenessReport {
  version: "1.0.0"

  behavior generateMarkdown {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateMarkdown never_throws_unhandled
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
