domain GenerateThirdPartyNotices {
  version: "1.0.0"

  entity DependencyInfo {
    id: String
  }

  behavior getDependenciesFromLockfile {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getDependenciesFromLockfile never_throws_unhandled
    }
  }
  behavior processDependencies {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - processDependencies never_throws_unhandled
    }
  }
  behavior enrichDependencyInfo {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - enrichDependencyInfo never_throws_unhandled
    }
  }
  behavior getLicenseText {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getLicenseText never_throws_unhandled
    }
  }
  behavior generateThirdPartyNotices {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateThirdPartyNotices never_throws_unhandled
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
