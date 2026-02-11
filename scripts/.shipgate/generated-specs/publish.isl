domain Publish {
  version: "1.0.0"

  entity PackageJson {
    id: String
  }

  behavior log {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - log never_throws_unhandled
    }
  }
  behavior logStep {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - logStep never_throws_unhandled
    }
  }
  behavior logSuccess {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - logSuccess never_throws_unhandled
    }
  }
  behavior logError {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - logError never_throws_unhandled
    }
  }
  behavior logWarning {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - logWarning never_throws_unhandled
    }
  }
  behavior getPackageDir {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getPackageDir never_throws_unhandled
    }
  }
  behavior readPackageJson {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - readPackageJson never_throws_unhandled
    }
  }
  behavior execCommand {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - execCommand never_throws_unhandled
    }
  }
  behavior checkNpmLogin {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkNpmLogin never_throws_unhandled
    }
  }
  behavior verifyBuilds {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - verifyBuilds never_throws_unhandled
    }
  }
  behavior runTests {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runTests never_throws_unhandled
    }
  }
  behavior publishPackages {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - publishPackages never_throws_unhandled
    }
  }
  behavior createGitTags {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - createGitTags never_throws_unhandled
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
