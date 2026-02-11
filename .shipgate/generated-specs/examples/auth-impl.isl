domain AuthImpl {
  version: "1.0.0"

  entity Email {
    id: String
  }
  entity Password {
    id: String
  }
  entity UserId {
    id: String
  }
  entity SessionId {
    id: String
  }
  entity UserStatus {
    id: String
  }
  entity User {
    id: String
  }
  entity Session {
    id: String
  }
  entity LoginInput {
    id: String
  }
  entity LoginResult {
    id: String
  }
  entity LogoutInput {
    id: String
  }
  entity LogoutResult {
    id: String
  }
  entity RegisterInput {
    id: String
  }
  entity RegisterResult {
    id: String
  }
  entity ResetPasswordInput {
    id: String
  }
  entity ResetPasswordResult {
    id: String
  }
  entity ValidateSessionInput {
    id: String
  }
  entity ValidateSessionResult {
    id: String
  }

  behavior login {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - login never_throws_unhandled
    }
  }
  behavior logout {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - logout never_throws_unhandled
    }
  }
  behavior register {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - register never_throws_unhandled
    }
  }
  behavior resetPassword {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - resetPassword never_throws_unhandled
    }
  }
  behavior validateSession {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - validateSession never_throws_unhandled
    }
  }
  behavior seedTestUser {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - seedTestUser never_throws_unhandled
    }
  }
  behavior createResetToken {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - createResetToken never_throws_unhandled
    }
  }
  behavior getAuditLog {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getAuditLog never_throws_unhandled
    }
  }
  behavior getSessionById {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getSessionById never_throws_unhandled
    }
  }
  behavior resetState {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - resetState never_throws_unhandled
    }
  }
}
