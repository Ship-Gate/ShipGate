# ISL Standard Library

The ISL Standard Library provides production-ready modules for common functionality.

## Installation

```bash
# Standard library is included with ISL
npm install @intentos/isl-cli
```

## Domains

### Auth (`@isl/stdlib/auth`)

Authentication and authorization modules.

| Module | Description |
|--------|-------------|
| `oauth-login` | OAuth 2.0 authentication flows |
| `session-create` | Session management |
| `password-reset` | Password reset flows |
| `rate-limit-login` | Brute-force protection |

```isl
import { InitiateOAuth, ExchangeOAuthCode } from "@isl/stdlib/auth/oauth-login"
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"
import { RequestPasswordReset, ResetPassword } from "@isl/stdlib/auth/password-reset"
import { CheckLoginRateLimit, RecordLoginAttempt } from "@isl/stdlib/auth/rate-limit-login"
```

### Payments (`@isl/stdlib/payments`)

Payment processing modules.

| Module | Description |
|--------|-------------|
| `process-payment` | Payment processing |
| `process-refund` | Refund handling |
| `subscription-create` | Subscription management |
| `webhook-handle` | Payment webhooks |

```isl
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib/payments/process-payment"
import { CreateRefund, ProcessRefundIntent } from "@isl/stdlib/payments/process-refund"
import { CreateSubscription, CancelSubscription } from "@isl/stdlib/payments/subscription-create"
import { ReceiveWebhook, ProcessWebhook } from "@isl/stdlib/payments/webhook-handle"
```

### Uploads (`@isl/stdlib/uploads`)

File upload and storage modules.

| Module | Description |
|--------|-------------|
| `upload-image` | Image upload & processing |
| `validate-mime` | MIME type validation |
| `store-blob` | Blob storage |

```isl
import { InitiateImageUpload, CompleteImageUpload } from "@isl/stdlib/uploads/upload-image"
import { ValidateMimeType, CheckFileSafety } from "@isl/stdlib/uploads/validate-mime"
import { StoreBlob, GeneratePresignedUrl } from "@isl/stdlib/uploads/store-blob"
```

## Quick Start

```isl
domain MyApp version "1.0.0"

# Import what you need
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"
import { CheckLoginRateLimit } from "@isl/stdlib/auth/rate-limit-login"
import { CreatePayment } from "@isl/stdlib/payments/process-payment"
import { ValidateMimeType } from "@isl/stdlib/uploads/validate-mime"

# Use in your behaviors
behavior SecureLogin {
  input {
    email: String { format: "email" }
    password: String
    ip_address: String
  }

  flow {
    step 1: CheckLoginRateLimit(email: input.email, ip_address: input.ip_address)
    step 2: authenticate(input.email, input.password)
    step 3: CreateSession(user_id: user.id, ip_address: input.ip_address)
  }
}
```

## Examples

Complete example projects demonstrating stdlib usage:

| Example | Description |
|---------|-------------|
| [`saas-app`](./examples/saas-app) | Full SaaS app with auth, payments, uploads |
| [`file-storage`](./examples/file-storage) | File storage service |
| [`payment-system`](./examples/payment-system) | E-commerce payment system |

## Module Reference

### Auth Behaviors

| Behavior | Module | Description |
|----------|--------|-------------|
| `InitiateOAuth` | oauth-login | Start OAuth flow |
| `ExchangeOAuthCode` | oauth-login | Exchange code for tokens |
| `RefreshOAuthToken` | oauth-login | Refresh access token |
| `RevokeOAuthCredential` | oauth-login | Revoke OAuth access |
| `CreateSession` | session-create | Create user session |
| `ValidateSession` | session-create | Validate session token |
| `RevokeSession` | session-create | Revoke session |
| `RevokeAllUserSessions` | session-create | Revoke all user sessions |
| `RequestPasswordReset` | password-reset | Send reset email |
| `ValidateResetToken` | password-reset | Validate reset token |
| `ResetPassword` | password-reset | Set new password |
| `CheckLoginRateLimit` | rate-limit-login | Check rate limit |
| `RecordLoginAttempt` | rate-limit-login | Record attempt |
| `BlockIdentifier` | rate-limit-login | Block login |
| `UnblockIdentifier` | rate-limit-login | Remove block |

### Payment Behaviors

| Behavior | Module | Description |
|----------|--------|-------------|
| `CreatePayment` | process-payment | Create payment intent |
| `ProcessPaymentIntent` | process-payment | Process payment |
| `CancelPayment` | process-payment | Cancel payment |
| `GetPayment` | process-payment | Get payment details |
| `CreateRefund` | process-refund | Create refund |
| `ProcessRefundIntent` | process-refund | Process refund |
| `CancelRefund` | process-refund | Cancel refund |
| `CreateSubscription` | subscription-create | Create subscription |
| `CancelSubscription` | subscription-create | Cancel subscription |
| `PauseSubscription` | subscription-create | Pause billing |
| `ResumeSubscription` | subscription-create | Resume billing |
| `ChangePlan` | subscription-create | Change plan |
| `ReceiveWebhook` | webhook-handle | Receive webhook |
| `ProcessWebhook` | webhook-handle | Process webhook |

### Upload Behaviors

| Behavior | Module | Description |
|----------|--------|-------------|
| `InitiateImageUpload` | upload-image | Get upload URL |
| `CompleteImageUpload` | upload-image | Process upload |
| `UploadImageDirect` | upload-image | Direct upload |
| `ResizeImage` | upload-image | Resize image |
| `DeleteImage` | upload-image | Delete image |
| `ValidateMimeType` | validate-mime | Validate MIME |
| `CheckFileSafety` | validate-mime | Check safety |
| `ValidateImageMime` | validate-mime | Validate image |
| `StoreBlob` | store-blob | Store blob |
| `GetBlobContent` | store-blob | Download blob |
| `GeneratePresignedUrl` | store-blob | Get signed URL |
| `DeleteBlob` | store-blob | Delete blob |
| `InitiateMultipartUpload` | store-blob | Start multipart |
| `CompleteMultipartUpload` | store-blob | Complete multipart |

## Security

All stdlib modules include:

- **Rate limiting** - Configurable per behavior
- **Audit logging** - Security events tracked
- **Input validation** - Pre-conditions enforced
- **Secret handling** - Sensitive data protected
- **Timing attack resistance** - Constant-time operations

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](../LICENSE)
