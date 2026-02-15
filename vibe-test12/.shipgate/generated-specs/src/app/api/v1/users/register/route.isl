# STATUS: INCOMPLETE — regex-fallback scaffold (inference engine unavailable)

domain Route {
  version: "1.0.0"

  behavior POST {
    input {
      request: Request
    }

    output {
      success: NextResponse

      errors {
        DuplicateEmailError {
          when: "inferred from throw statement"
        }
        InvalidUsernameError {
          when: "inferred from throw statement"
        }
      }
    }

    invariants {
      - POST never_throws_unhandled
      - POST resolves_or_rejects
    }
  }
}
