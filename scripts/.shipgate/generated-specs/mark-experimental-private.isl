domain MarkExperimentalPrivate {
  version: "1.0.0"

  behavior packageNameToDir {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - packageNameToDir never_throws_unhandled
    }
  }
}
