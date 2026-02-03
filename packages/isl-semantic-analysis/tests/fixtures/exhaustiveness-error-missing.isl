// Fixture: Missing error handler in postconditions
// Expected Warning: E0705 - Missing postconditions for error cases
// Pass: exhaustiveness

domain ErrorHandlerTest {
  version: "1.0.0"

  entity User {
    id: UUID [immutable]
    email: String
    isActive: Boolean
  }

  behavior DeactivateUser {
    input {
      userId: UUID
    }
    output {
      success: User
      errors: [UserNotFound, AlreadyInactive, PermissionDenied]
    }

    preconditions {
      userId != null
    }

    postconditions {
      when success {
        result.isActive == false
      }
      when UserNotFound {
        result == null
      }
      // E0705: Missing postconditions for: AlreadyInactive, PermissionDenied
    }
  }
}
