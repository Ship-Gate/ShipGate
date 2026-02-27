domain CheckAstImports {
  version: "1.0.0"

  entity Violation {
    id: String
  }

  behavior checkFile {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkFile never_throws_unhandled
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
