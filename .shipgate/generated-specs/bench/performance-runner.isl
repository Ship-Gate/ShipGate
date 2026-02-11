domain PerformanceRunner {
  version: "1.0.0"

  entity PerformanceBudgets {
    id: String
  }
  entity BenchmarkResult {
    id: String
  }
  entity BenchmarkReport {
    id: String
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
}
