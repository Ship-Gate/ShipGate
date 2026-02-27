# ISL Standard Library: Auth

Authentication and authorization modules for ISL.

## Modules

### OAuthLogin
OAuth 2.0 authentication flow with support for multiple providers.

```isl
import { InitiateOAuth, ExchangeOAuthCode } from "@isl/stdlib/auth/oauth-login"

behavior LoginWithGoogle {
  step 1: InitiateOAuth(provider: GOOGLE, scopes: ["email", "profile"])
  step 2: ExchangeOAuthCode(code: oauth_code, state: state)
}
```

**Behaviors:**
- `InitiateOAuth` - Start OAuth flow, get authorization URL
- `ExchangeOAuthCode` - Exchange code for tokens
- `RefreshOAuthToken` - Refresh expired access token
- `RevokeOAuthCredential` - Revoke OAuth credential

### SessionCreate
Secure session management with token-based authentication.

```isl
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"

behavior AuthenticatedRequest {
  pre {
    ValidateSession(token: request.session_token).success
  }
}
```

**Behaviors:**
- `CreateSession` - Create new session for user
- `ValidateSession` - Validate session token
- `RevokeSession` - Revoke single session
- `RevokeAllUserSessions` - Revoke all user sessions
- `CleanupExpiredSessions` - Remove expired sessions

### PasswordReset
Secure password reset flow with email verification.

```isl
import { RequestPasswordReset, ResetPassword } from "@isl/stdlib/auth/password-reset"
```

**Behaviors:**
- `RequestPasswordReset` - Initiate reset, send email
- `ValidateResetToken` - Validate reset token
- `ResetPassword` - Set new password with token
- `CheckPasswordStrength` - Evaluate password strength

### RateLimitLogin
Brute-force protection and login rate limiting.

```isl
import { CheckLoginRateLimit, RecordLoginAttempt } from "@isl/stdlib/auth/rate-limit-login"

behavior SecureLogin {
  step 1: CheckLoginRateLimit(email, ip_address)
  step 2: AuthenticateUser(email, password)
  step 3: RecordLoginAttempt(email, ip_address, success: true)
}
```

**Behaviors:**
- `CheckLoginRateLimit` - Check if login allowed
- `RecordLoginAttempt` - Record attempt for tracking
- `BlockIdentifier` - Block email/IP from login
- `UnblockIdentifier` - Remove login block
- `GetLoginAttemptHistory` - Get recent attempts
- `ResetRateLimit` - Reset rate limit counters

## Security Features

All auth modules include:
- Rate limiting per IP and identifier
- Secure token generation (256-bit)
- Password hashing (bcrypt/argon2)
- Audit logging
- Timing attack resistance
- GDPR compliance hooks

## Usage

```isl
domain MyApp {
  import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"
  import { CheckLoginRateLimit } from "@isl/stdlib/auth/rate-limit-login"
  
  behavior Login {
    step 1: CheckLoginRateLimit(email: input.email, ip_address: context.ip)
    step 2: authenticate(input.email, input.password)
    step 3: CreateSession(user_id: user.id, ip_address: context.ip)
  }
}
```
