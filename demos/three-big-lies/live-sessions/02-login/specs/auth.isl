# Authentication Specification
# No PII (passwords, tokens) in logs

domain Auth version "1.0.0"

behavior Authenticate {
  description: "Authenticate user with email and password"
  
  @intent no-pii-logging
  
  input {
    email: Email
    password: String
  }
  
  output {
    success: { token: String }
    errors {
      INVALID_CREDENTIALS when "Wrong email or password"
    }
  }
  
  invariants {
    password.never_logged
    token.never_logged_plaintext
  }
}
