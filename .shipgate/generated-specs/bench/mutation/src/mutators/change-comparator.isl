domain ChangeComparator {
  version: "1.0.0"

  behavior findApplicableTransform {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - findApplicableTransform never_throws_unhandled
    }
  }
}
