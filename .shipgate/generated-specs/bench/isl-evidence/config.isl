domain Config {
  version: "1.0.0"

  entity SampleConfig {
    id: String
  }
  entity BenchConfig {
    id: String
  }
  entity PromptContext {
    id: String
  }

  behavior resolveBenchRoot {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - resolveBenchRoot never_throws_unhandled
    }
  }
  behavior loadConfig {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadConfig never_throws_unhandled
    }
  }
  behavior discoverSamples {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - discoverSamples never_throws_unhandled
    }
  }
  behavior loadPromptContext {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadPromptContext never_throws_unhandled
    }
  }
  behavior validateSampleConfig {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - validateSampleConfig never_throws_unhandled
    }
  }
}
