# SaaS Application Example

A complete SaaS application spec demonstrating how to use ISL stdlib modules together.

## Features

- OAuth sign-in (Google, GitHub)
- Email/password authentication with rate limiting
- Password reset flow
- Subscription management
- Avatar upload
- Webhook handling

## Modules Used

```isl
import { InitiateOAuth, ExchangeOAuthCode } from "@isl/stdlib/auth/oauth-login"
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"
import { RequestPasswordReset, ResetPassword } from "@isl/stdlib/auth/password-reset"
import { CheckLoginRateLimit, RecordLoginAttempt } from "@isl/stdlib/auth/rate-limit-login"
import { CreateSubscription, CancelSubscription } from "@isl/stdlib/payments/subscription-create"
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib/payments/process-payment"
import { ReceiveWebhook, ProcessWebhook } from "@isl/stdlib/payments/webhook-handle"
import { InitiateImageUpload, CompleteImageUpload } from "@isl/stdlib/uploads/upload-image"
```

## Running

```bash
# Check the spec
isl check stdlib/examples/saas-app/main.isl

# Generate TypeScript
isl generate --target typescript --output ./generated

# Verify implementation
isl verify ./src
```

## Architecture

```
User Flow:
  1. Sign up via OAuth or email
  2. Create session
  3. Subscribe to plan
  4. Upload avatar
  5. Use product
```
