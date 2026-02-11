domain Phase3Benchmarks {
  version: "1.0.0"

  entity BenchmarkResult {
    id: String
  }

  behavior percentile {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - percentile never_throws_unhandled
    }
  }
  behavior benchmark {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - benchmark never_throws_unhandled
    }
  }
  behavior runBenchmarks {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runBenchmarks never_throws_unhandled
    }
  }
  behavior printReport {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printReport never_throws_unhandled
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
