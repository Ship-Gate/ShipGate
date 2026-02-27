domain CodemodAstImports {
  version: "1.0.0"

  entity Transform {
    id: String
  }

  behavior transformFile {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - transformFile never_throws_unhandled
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
