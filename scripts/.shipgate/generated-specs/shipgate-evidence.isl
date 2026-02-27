domain ShipgateEvidence {
  version: "1.0.0"

  entity GateRunRecord {
    id: String
  }

  behavior loadRuns {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadRuns never_throws_unhandled
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
  behavior formatSummary {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - formatSummary never_throws_unhandled
    }
  }
}
