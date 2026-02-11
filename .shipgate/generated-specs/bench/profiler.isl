domain Profiler {
  version: "1.0.0"

  behavior startProfiling {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - startProfiling never_throws_unhandled
    }
  }
  behavior stopProfiling {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stopProfiling never_throws_unhandled
    }
  }
  behavior stopAllProfiles {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stopAllProfiles never_throws_unhandled
    }
  }
  behavior isProfilingAvailable {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - isProfilingAvailable never_throws_unhandled
    }
  }
  behavior profileFunction {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - profileFunction never_throws_unhandled
    }
  }
}
