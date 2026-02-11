domain CanaryPublish {
  version: "1.0.0"

  entity ExperimentalConfig {
    id: String
  }
  entity PackageInfo {
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
  behavior execSilent {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - execSilent never_throws_unhandled
    }
  }
  behavior loadCanaryPackages {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadCanaryPackages never_throws_unhandled
    }
  }
  behavior resolvePackageDir {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - resolvePackageDir never_throws_unhandled
    }
  }
  behavior buildCanaryVersion {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - buildCanaryVersion never_throws_unhandled
    }
  }
  behavior getPackageInfos {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getPackageInfos never_throws_unhandled
    }
  }
  behavior listPackages {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - listPackages never_throws_unhandled
    }
  }
  behavior publishCanary {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - publishCanary never_throws_unhandled
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
