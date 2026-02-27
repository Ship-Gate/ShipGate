# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain Page {
  version: "1.0.0"

  behavior TaskCreatePage {
    input {
    }

    output {
      success: Void

      errors {
        Error {
          when: "inferred from throw statement"
        }
      }
    }

    invariants {
      - TaskCreatePage never_throws_unhandled
    }
  }
}
