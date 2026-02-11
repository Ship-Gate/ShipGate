domain RunProofBenchmark {
  version: "1.0.0"

  entity CorpusSpec {
    id: String
  }
  entity GateResult {
    id: String
  }

  behavior runGate {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runGate never_throws_unhandled
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
