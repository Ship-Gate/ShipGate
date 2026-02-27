domain GenerateBaseline {
  version: "1.0.0"

  entity TaskFailure {
    id: String
  }
  entity RunSummary {
    id: String
  }

  behavior run {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - run never_throws_unhandled
    }
  }
  behavior parseSummary {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - parseSummary never_throws_unhandled
    }
  }
  behavior classifyError {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - classifyError never_throws_unhandled
    }
  }
  behavior extractFirstError {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - extractFirstError never_throws_unhandled
    }
  }
  behavior extractDependencyGraph {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - extractDependencyGraph never_throws_unhandled
    }
  }
  behavior computeReverseDeps {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - computeReverseDeps never_throws_unhandled
    }
  }
  behavior countTransitiveDependents {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - countTransitiveDependents never_throws_unhandled
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
}
