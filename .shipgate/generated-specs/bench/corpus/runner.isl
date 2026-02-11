domain Runner {
  version: "1.0.0"

  entity CorpusFixture {
    id: String
  }
  entity FixtureMetadata {
    id: String
  }
  entity BenchmarkResult {
    id: String
  }
  entity BenchmarkMetrics {
    id: String
  }
  entity CLIOptions {
    id: String
  }

  behavior references {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - references never_throws_unhandled
    }
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
  behavior loadCorpus {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadCorpus never_throws_unhandled
    }
  }
  behavior runBenchmark {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runBenchmark never_throws_unhandled
    }
  }
  behavior calculateMetrics {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - calculateMetrics never_throws_unhandled
    }
  }
  behavior printMetrics {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printMetrics never_throws_unhandled
    }
  }
  behavior tuneThresholds {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - tuneThresholds never_throws_unhandled
    }
  }
  behavior loadGateFunctions {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadGateFunctions never_throws_unhandled
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
