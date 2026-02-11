domain CompletenessInitManifests {
  version: "1.0.0"

  behavior generateManifest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateManifest never_throws_unhandled
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
