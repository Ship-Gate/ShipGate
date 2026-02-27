domain Auth "User authentication and session management" {
  
  type User {
    id: string
    email: string
    passwordHash: string
    createdAt: string
    lastLogin?: string
  }
  
  type Session {
    id: string
    userId: string
    token: string
    expiresAt: string
    createdAt: string
  }
  
  type LoginCredentials {
    email: string
    password: string
  }
  
  type AuthResult {
    user: User
    session: Session
    token: string
  }
  
  behavior Login "Authenticates user with email and password" (
    credentials: LoginCredentials
  ) returns AuthResult {
    pre user_exists: User with email == credentials.email exists
    pre password_valid: hash(credentials.password) == user.passwordHash
    pre account_not_locked: user.failedAttempts < 5
    
    post session_created: Session with userId == user.id is created
    post token_generated: result.token is valid JWT
    post last_login_updated: user.lastLogin == now()
  }
  
  behavior Logout "Terminates user session" (
    sessionId: string
  ) {
    pre session_exists: Session with id == sessionId exists
    pre session_valid: session.expiresAt > now()
    
    post session_destroyed: Session with id == sessionId not exists
    post token_invalidated: session.token is revoked
  }
  
  behavior Register "Creates new user account" (
    email: string,
    password: string
  ) returns User {
    pre email_unique: User with email == email not exists
    pre email_valid: email matches email_pattern
    pre password_strong: password.length >= 8 and has_special_char(password)
    
    post user_created: User with email == email exists
    post password_hashed: user.passwordHash != password
    post welcome_email_sent: email_sent_to(email)
  }
  
  behavior ResetPassword "Initiates password reset flow" (
    email: string
  ) {
    pre user_exists: User with email == email exists
    pre not_rate_limited: reset_requests(email, last_hour) < 3
    
    post reset_token_created: ResetToken with userId == user.id exists
    post reset_email_sent: email contains reset_link
    post token_expires: reset_token.expiresAt == now() + 1.hour
  }
}
