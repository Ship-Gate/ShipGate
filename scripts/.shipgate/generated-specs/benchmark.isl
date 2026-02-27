domain Benchmark {
  version: "1.0.0"

  behavior collectISLFiles {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - collectISLFiles never_throws_unhandled
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
}
