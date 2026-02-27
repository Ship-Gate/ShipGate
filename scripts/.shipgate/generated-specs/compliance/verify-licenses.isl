domain VerifyLicenses {
  version: "1.0.0"

  entity PackageInfo {
    id: String
  }
  entity VerificationResult {
    id: String
  }

  behavior isExcludedFromCompliance {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isExcludedFromCompliance never_throws_unhandled
    }
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
  behavior walkDir {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - walkDir never_throws_unhandled
    }
  }
  behavior verifyPackage {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - verifyPackage never_throws_unhandled
    }
  }
  behavior verifyAllPackages {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - verifyAllPackages never_throws_unhandled
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
