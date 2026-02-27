domain TypeSurfaceAudit {
  version: "1.0.0"

  entity PackageIssue {
    id: String
  }
  entity DeepImport {
    id: String
  }

  behavior findPackages {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - findPackages never_throws_unhandled
    }
  }
  behavior validatePackage {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - validatePackage never_throws_unhandled
    }
  }
  behavior to {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - to never_throws_unhandled
    }
  }
  behavior hasTypes {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - hasTypes never_throws_unhandled
    }
  }
  behavior scanForDeepImports {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - scanForDeepImports never_throws_unhandled
    }
  }
  behavior scanDirectory {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - scanDirectory never_throws_unhandled
    }
  }
  behavior scanFile {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - scanFile never_throws_unhandled
    }
  }
}
