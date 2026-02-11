domain VerifyPromise {
  version: "1.0.0"

  entity VerifyPromiseResult {
    id: String
  }
  entity StepResult {
    id: String
  }

  behavior stepParse {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stepParse never_throws_unhandled
    }
  }
  behavior stepGenerate {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stepGenerate never_throws_unhandled
    }
  }
  behavior generateTypes {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateTypes never_throws_unhandled
    }
  }
  behavior stepTest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stepTest never_throws_unhandled
    }
  }
  behavior stepVerify {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stepVerify never_throws_unhandled
    }
  }
  behavior stepProof {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - stepProof never_throws_unhandled
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
  behavior printSummary {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - printSummary never_throws_unhandled
    }
  }
}
