# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain Route {
  version: "1.0.0"

  behavior POST {
    input {
      request: Request
    }

    output {
      success: String

      errors {
        InvalidPriorityError {
          when: "inferred from throw statement"
        }
        UserNotFoundError {
          when: "inferred from throw statement"
        }
      }
    }

    invariants {
      - POST never_throws_unhandled
      - POST resolves_or_rejects
    }
  }
  behavior GET {
    input {
      request: Request
    }

    output {
      success: String
    }

    invariants {
      - GET never_throws_unhandled
      - GET resolves_or_rejects
    }
  }
}
