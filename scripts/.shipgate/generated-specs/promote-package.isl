domain PromotePackage {
  version: "1.0.0"

  behavior inferProductionCategory {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - inferProductionCategory never_throws_unhandled
    }
  }
}
