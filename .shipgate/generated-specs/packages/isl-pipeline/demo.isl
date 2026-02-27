# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain Demo {
  version: "1.0.0"

  behavior main {
    input {
    }

    output {
      success: String
    }

    invariants {
      - main never_throws_unhandled
      - main resolves_or_rejects
    }
  }
}
