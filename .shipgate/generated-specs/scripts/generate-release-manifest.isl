domain GenerateReleaseManifest {
  version: "1.0.0"

  entity PackageEntry {
    id: String
  }
  entity ReleaseManifest {
    id: String
  }

  behavior exec {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - exec never_throws_unhandled
    }
  }
  behavior sha256 {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - sha256 never_throws_unhandled
    }
  }
  behavior getPackages {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getPackages never_throws_unhandled
    }
  }
  behavior generateManifest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateManifest never_throws_unhandled
    }
  }
  behavior verifyManifest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - verifyManifest never_throws_unhandled
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
