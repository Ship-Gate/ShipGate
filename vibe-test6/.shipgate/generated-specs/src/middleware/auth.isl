# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain Auth {
  version: "1.0.0"

  entity UnauthorizedError {
    id: String
  }

  behavior verifyAuth {
    input {
      request: Request
    }

    output {
      success: String

      errors {
        UnauthorizedError {
          when: "inferred from throw statement"
        }
      }
    }

    invariants {
      - verifyAuth never_throws_unhandled
    }
  }
}
