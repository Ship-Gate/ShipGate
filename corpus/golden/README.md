# ISL Golden Corpus

A comprehensive test corpus for ISL (Intent Specification Language) regression testing.

## Overview

This corpus contains **50 ISL specifications** covering real-world domains, designed to:

1. **Validate parser correctness** - Ensure ISL files parse without errors
2. **Test type-checker** - Verify semantic analysis works correctly
3. **Regression testing** - Detect breaking changes in ISL tooling
4. **Document ISL patterns** - Serve as reference examples

## Directory Structure

```
corpus/golden/
├── specs/                    # ISL specification files
│   ├── auth/                 # Authentication (10 specs)
│   │   ├── login.isl
│   │   ├── logout.isl
│   │   ├── register.isl
│   │   ├── password-reset.isl
│   │   ├── mfa-totp.isl
│   │   ├── oauth.isl
│   │   ├── session-validation.isl
│   │   ├── api-keys.isl
│   │   ├── permissions.isl
│   │   └── audit-log.isl
│   ├── payments/             # Payment processing (10 specs)
│   │   ├── charge.isl
│   │   ├── refund.isl
│   │   ├── subscription.isl
│   │   ├── invoice.isl
│   │   ├── payout.isl
│   │   ├── payment-method.isl
│   │   ├── customer.isl
│   │   ├── coupon.isl
│   │   ├── dispute.isl
│   │   └── checkout.isl
│   ├── uploads/              # File uploads (8 specs)
│   │   ├── file-upload.isl
│   │   ├── image-upload.isl
│   │   ├── chunk-upload.isl
│   │   ├── presigned-url.isl
│   │   ├── video-upload.isl
│   │   ├── folder.isl
│   │   ├── avatar.isl
│   │   └── attachment.isl
│   ├── webhooks/             # Webhook system (6 specs)
│   │   ├── endpoint.isl
│   │   ├── dispatch.isl
│   │   ├── retry.isl
│   │   ├── signature.isl
│   │   ├── event-types.isl
│   │   └── logs.isl
│   ├── crud/                 # CRUD operations (8 specs)
│   │   ├── users.isl
│   │   ├── posts.isl
│   │   ├── comments.isl
│   │   ├── products.isl
│   │   ├── orders.isl
│   │   ├── categories.isl
│   │   ├── tags.isl
│   │   └── notifications.isl
│   ├── search/               # Search functionality (4 specs)
│   │   ├── full-text.isl
│   │   ├── faceted.isl
│   │   ├── geo-search.isl
│   │   └── aggregations.isl
│   ├── rate-limits/          # Rate limiting (2 specs)
│   │   ├── api-limits.isl
│   │   └── quotas.isl
│   └── edge-cases/           # Edge cases (2 specs)
│       ├── missing-postconditions.isl
│       └── contradictory-clauses.isl
├── expected/                 # Expected outcomes
│   ├── auth/_defaults.json
│   ├── payments/_defaults.json
│   ├── uploads/_defaults.json
│   ├── webhooks/_defaults.json
│   ├── crud/_defaults.json
│   ├── search/_defaults.json
│   ├── rate-limits/_defaults.json
│   └── edge-cases/
│       ├── _defaults.json
│       ├── missing-postconditions.json
│       └── contradictory-clauses.json
├── runner.ts                 # Test runner script
├── package.json              # Dependencies
└── README.md                 # This file
```

## Spec Categories

### Authentication (10 specs)
- `login.isl` - User login with email/password
- `logout.isl` - Session invalidation
- `register.isl` - New user registration
- `password-reset.isl` - Password reset flow
- `mfa-totp.isl` - Multi-factor auth with TOTP
- `oauth.isl` - OAuth 2.0 integration
- `session-validation.isl` - Session management
- `api-keys.isl` - API key management
- `permissions.isl` - Role-based access control
- `audit-log.isl` - Security audit logging

### Payments (10 specs)
- `charge.isl` - Card charges
- `refund.isl` - Refund processing
- `subscription.isl` - Recurring billing
- `invoice.isl` - Invoice management
- `payout.isl` - Payouts to accounts
- `payment-method.isl` - Payment method CRUD
- `customer.isl` - Customer management
- `coupon.isl` - Discount coupons
- `dispute.isl` - Chargeback handling
- `checkout.isl` - Checkout sessions

### Uploads (8 specs)
- `file-upload.isl` - Basic file upload
- `image-upload.isl` - Image processing
- `chunk-upload.isl` - Resumable uploads
- `presigned-url.isl` - S3-style presigned URLs
- `video-upload.isl` - Video transcoding
- `folder.isl` - Folder management
- `avatar.isl` - Profile pictures
- `attachment.isl` - Generic attachments

### Webhooks (6 specs)
- `endpoint.isl` - Endpoint registration
- `dispatch.isl` - Event dispatch
- `retry.isl` - Retry logic
- `signature.isl` - HMAC signatures
- `event-types.isl` - Event type management
- `logs.isl` - Delivery logs

### CRUD (8 specs)
- `users.isl` - User management
- `posts.isl` - Blog posts
- `comments.isl` - Comment system
- `products.isl` - Product catalog
- `orders.isl` - Order management
- `categories.isl` - Hierarchical categories
- `tags.isl` - Tag system
- `notifications.isl` - Notification system

### Search (4 specs)
- `full-text.isl` - Full-text search
- `faceted.isl` - Faceted navigation
- `geo-search.isl` - Geospatial search
- `aggregations.isl` - Analytics aggregations

### Rate Limits (2 specs)
- `api-limits.isl` - API rate limiting
- `quotas.isl` - Resource quotas

### Edge Cases (2 specs)
- `missing-postconditions.isl` - Specs with weak/missing postconditions
- `contradictory-clauses.isl` - Specs with contradictory conditions

## Running Tests

### Prerequisites

1. Build the ISL CLI:
   ```bash
   pnpm install
   pnpm build
   ```

2. Install corpus dependencies:
   ```bash
   cd corpus/golden
   npm install
   ```

### Run Tests

```bash
# From corpus/golden directory
npm test

# Or from root
npx tsx corpus/golden/runner.ts
```

### Output

The runner will:
1. Find all `.isl` files in `specs/`
2. Run `isl parse` and `isl check` on each
3. Compare results against expected outcomes
4. Output a fail report for any mismatches
5. Generate `report.json` with full results

Example output:
```
============================================================
GOLDEN CORPUS TEST REPORT
============================================================

Total Specs: 50
Passed: 50
Failed: 0
Duration: 12345ms

============================================================
ALL TESTS PASSED ✓
============================================================
```

## Expected Outcomes

Each category has a `_defaults.json` file defining expected behavior:

```json
{
  "parseSuccess": true,
  "checkSuccess": true,
  "minDomains": 1,
  "minEntities": 1,
  "minBehaviors": 1,
  "notes": "Description of expected behavior"
}
```

Individual specs can override defaults with `<spec-name>.json`.

## Adding New Specs

1. Create the ISL file in the appropriate category directory
2. Ensure it follows ISL syntax and conventions
3. Add expected outcome JSON if different from category defaults
4. Run tests to verify

## ISL Features Covered

- **Types**: Primitives, constraints, custom types
- **Enums**: Status enumerations
- **Entities**: Data models with invariants and lifecycles
- **Behaviors**: Operations with pre/post conditions
- **Scenarios**: Test cases
- **Temporal**: Timing constraints
- **Security**: Rate limits, authentication requirements
- **Compliance**: GDPR, PCI-DSS annotations

## Contributing

When adding or modifying specs:
1. Follow consistent naming conventions
2. Include comprehensive behaviors (not just happy path)
3. Add scenarios demonstrating key use cases
4. Document edge cases in the appropriate category
