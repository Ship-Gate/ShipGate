# ISL Flagship Demo: OAuth + Payments + Uploads

This demo showcases the end-to-end value of ISL (Intent Specification Language) by implementing three critical business domains with complete behavioral contracts:

1. **OAuth Authentication** - Google/GitHub social login with session management
2. **Payment Processing** - Stripe-like charges, refunds, and subscriptions
3. **File Uploads** - Presigned URLs, virus scanning, and image processing

## Quick Start

### One Command Demo

**Windows (PowerShell):**
```powershell
.\scripts\run.ps1
```

**Unix/Linux/macOS:**
```bash
chmod +x scripts/run.sh
./scripts/run.sh
```

**Or using npm:**
```bash
pnpm install
pnpm run demo
```

This will:
1. Parse and validate all ISL specifications
2. Type check the behavioral contracts
3. Generate TypeScript types
4. Run verification against the implementation
5. Produce `output/evidence.json` + `output/report.html`

## Project Structure

```
flagship-auth-payments/
├── spec/                     # ISL Specifications
│   ├── auth.isl             # OAuth authentication behaviors
│   ├── payments.isl         # Payment processing behaviors
│   └── uploads.isl          # File upload behaviors
├── src/                     # Implementation
│   ├── types.ts             # TypeScript type definitions
│   ├── store.ts             # In-memory data store (mock DB)
│   ├── handlers/            # Business logic handlers
│   │   ├── auth.ts          # OAuth handlers
│   │   ├── payments.ts      # Payment handlers
│   │   └── uploads.ts       # Upload handlers
│   ├── server.ts            # Express REST API
│   └── index.ts             # Main exports
├── scripts/
│   ├── run.sh               # Unix demo runner
│   ├── run.ps1              # Windows demo runner
│   ├── run-demo.js          # Node.js demo orchestrator
│   └── generate-evidence.js # Evidence/report generator
├── output/                  # Generated outputs
│   ├── evidence.json        # Verification evidence
│   └── report.html          # Visual report
└── package.json
```

## ISL Specifications

### OAuth Authentication (`spec/auth.isl`)

Defines behavioral contracts for:
- `OAuthLogin` - Social login via Google/GitHub/Microsoft
- `RefreshAccessToken` - Token refresh flow
- `Logout` - Session revocation
- `ValidateSession` - Session validation

Key features:
- Pre/post conditions for all behaviors
- Error handling with retriable errors
- Rate limiting rules
- Temporal constraints (response times)
- Security invariants

### Payment Processing (`spec/payments.isl`)

Defines behavioral contracts for:
- `CreatePayment` - Process charges
- `CreateRefund` - Full/partial refunds
- `CreateSubscription` - Subscription creation
- `CancelSubscription` - Subscription cancellation
- `GetPaymentHistory` - Payment history queries

Key features:
- PCI-DSS compliance rules
- Idempotency for duplicate prevention
- Chaos tests for processor failures
- Entity lifecycle rules

### File Uploads (`spec/uploads.isl`)

Defines behavioral contracts for:
- `InitiateUpload` - Get presigned upload URL
- `CompleteUpload` - Mark upload complete
- `ProcessFile` - Virus scan & processing
- `GetFile` - Download file
- `DeleteFile` - Remove file
- `ListFiles` - List user files

Key features:
- Storage quota management
- Virus scanning workflow
- File lifecycle states
- Security invariants for uploads

## API Endpoints

Start the server:
```bash
node dist/server.js
# or
pnpm start
```

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/oauth/login` | OAuth login |
| POST | `/auth/token/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout / revoke session |
| GET | `/auth/session/validate` | Validate session |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/customers` | Create customer |
| POST | `/payments/charges` | Create payment |
| POST | `/payments/refunds` | Create refund |
| POST | `/payments/subscriptions` | Create subscription |
| POST | `/payments/subscriptions/:id/cancel` | Cancel subscription |
| GET | `/payments/customers/:id/payments` | Get payment history |

### Uploads
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/uploads/initiate` | Start upload |
| POST | `/uploads/:id/complete` | Complete upload |
| POST | `/uploads/:id/process` | Process file |
| GET | `/uploads/:id` | Get file |
| DELETE | `/uploads/:id` | Delete file |
| GET | `/uploads` | List files |

## Example Usage

### OAuth Login
```bash
curl -X POST http://localhost:3000/auth/oauth/login \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "GOOGLE",
    "oauth_code": "valid_auth_code_alice",
    "redirect_uri": "http://localhost:3000/callback"
  }'
```

### Create Payment
```bash
# First create a customer
curl -X POST http://localhost:3000/payments/customers \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@example.com", "default_payment_method_id": "pm_4242"}'

# Then charge them
curl -X POST http://localhost:3000/payments/charges \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "<customer_id>",
    "amount": 99.99,
    "currency": "USD",
    "description": "Premium subscription"
  }'
```

### Upload File
```bash
# Initiate upload
curl -X POST http://localhost:3000/uploads/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer at_demo_token" \
  -d '{
    "filename": "photo.jpg",
    "mime_type": "image/jpeg",
    "size": 1024000
  }'
```

## Evidence & Reports

After running the demo, check the `output/` directory:

- **evidence.json** - Machine-readable verification results
- **report.html** - Visual trust score dashboard

The report shows:
- Overall trust score
- Per-spec verification status
- Behavior coverage
- Scenario results

## Development

```bash
# Install dependencies
pnpm install

# Run individual commands
pnpm run parse      # Parse specs
pnpm run check      # Type check specs
pnpm run gen        # Generate types
pnpm run verify     # Run verification
pnpm run evidence   # Generate evidence
pnpm run demo       # Full demo pipeline

# TypeScript check
pnpm run typecheck
```

## How ISL Adds Value

1. **Behavioral Contracts** - Every API has explicit pre/postconditions
2. **Error Taxonomy** - All error cases documented with retriability
3. **Security Rules** - Rate limits, compliance, and invariants
4. **Temporal Constraints** - SLA requirements in the spec
5. **Scenarios** - Test cases live alongside the contract
6. **Verification** - Generate trust scores against implementations

## License

MIT
