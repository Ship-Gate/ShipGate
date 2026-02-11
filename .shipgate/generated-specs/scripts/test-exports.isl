domain TestExports {
  version: "1.0.0"

  entity PackageJson {
    id: String
  }
  entity TsConfig {
    id: String
  }
  entity CheckResult {
    id: String
  }

  behavior readJson {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - readJson never_throws_unhandled
    }
  }
  behavior resolveDeclaration {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - resolveDeclaration never_throws_unhandled
    }
  }
  behavior hasTypesCondition {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - hasTypesCondition never_throws_unhandled
    }
  }
  behavior checkExportsHasTypes {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkExportsHasTypes never_throws_unhandled
    }
  }
  behavior checkPackage {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkPackage never_throws_unhandled
    }
  }
}
