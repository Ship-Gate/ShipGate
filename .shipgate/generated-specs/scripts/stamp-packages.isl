domain StampPackages {
  version: "1.0.0"

  entity Diagnostic {
    id: String
  }
  entity Conflict {
    id: String
  }

  behavior loadTemplate {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadTemplate never_throws_unhandled
    }
  }
  behavior jsonStable {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - jsonStable never_throws_unhandled
    }
  }
  behavior deepEqual {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - deepEqual never_throws_unhandled
    }
  }
  behavior writeIfApply {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - writeIfApply never_throws_unhandled
    }
  }
  behavior auditTsconfig {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - auditTsconfig never_throws_unhandled
    }
  }
  behavior auditVitest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - auditVitest never_throws_unhandled
    }
  }
  behavior auditPackageJson {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - auditPackageJson never_throws_unhandled
    }
  }
  behavior auditSrcIndex {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - auditSrcIndex never_throws_unhandled
    }
  }
  behavior auditReadme {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - auditReadme never_throws_unhandled
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
