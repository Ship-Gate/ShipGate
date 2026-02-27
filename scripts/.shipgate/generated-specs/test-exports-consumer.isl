domain TestExportsConsumer {
  version: "1.0.0"

  behavior resolvePackagePath {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - resolvePackagePath never_throws_unhandled
    }
  }
}
