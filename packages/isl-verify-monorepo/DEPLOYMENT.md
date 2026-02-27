# Shipgate Deployment Guide

This guide covers deploying the Shipgate ecosystem: license server, npm packages, and documentation.

## Prerequisites

- Node.js 18+
- pnpm 8+
- Stripe account (for license server)
- npm account (for publishing core package)
- Vercel/Railway account (for license server deployment)

## Local Development Setup

### 1. Install Dependencies

```bash
cd packages/isl-verify-monorepo
pnpm install
```

### 2. Build All Packages

```bash
# Build all packages
pnpm build

# Or build individually
pnpm build:core
pnpm build:runtime
pnpm build:compliance
pnpm build:action
```

### 3. Test Core Package Locally

```bash
cd packages/core
node dist/cli.js verify --help
```

## License Server Deployment

### Setup Stripe

1. **Create Stripe Products**:
   - Go to Stripe Dashboard → Products
   - Create "Shipgate Team" product with one-time payment ($99)
   - Create "Shipgate Enterprise" product with one-time payment ($999)
   - Copy the price IDs (e.g., `price_xxx_team`, `price_xxx_enterprise`)

2. **Get API Keys**:
   - Dashboard → Developers → API Keys
   - Copy Secret Key (`sk_live_xxx` or `sk_test_xxx`)
   - Copy Publishable Key (`pk_live_xxx` or `pk_test_xxx`)

3. **Setup Webhook**:
   - Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/webhook`
   - Select events: `checkout.session.completed`
   - Copy webhook signing secret (`whsec_xxx`)

### Deploy to Vercel

```bash
cd packages/license-server

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# - STRIPE_SECRET_KEY
# - STRIPE_PUBLISHABLE_KEY
# - STRIPE_WEBHOOK_SECRET
# - STRIPE_PRICE_ID_TEAM
# - STRIPE_PRICE_ID_ENTERPRISE
# - LICENSE_JWT_SECRET (generate a strong random string)
# - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# - NEXT_PUBLIC_APP_URL
```

### Alternative: Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to project
railway link

# Set environment variables
railway variables set STRIPE_SECRET_KEY=sk_xxx
railway variables set STRIPE_PUBLISHABLE_KEY=pk_xxx
railway variables set STRIPE_WEBHOOK_SECRET=whsec_xxx
railway variables set STRIPE_PRICE_ID_TEAM=price_xxx
railway variables set STRIPE_PRICE_ID_ENTERPRISE=price_xxx
railway variables set LICENSE_JWT_SECRET=your-secret-key
railway variables set NEXT_PUBLIC_APP_URL=https://your-domain.railway.app

# Deploy
railway up
```

### Test License Server

```bash
# Local development
cd packages/license-server
cp .env.example .env
# Edit .env with your Stripe test keys
pnpm dev

# Visit http://localhost:3100
# Test purchase flow with Stripe test cards
```

## Publishing to npm

### Prepare Core Package

1. **Update version** in `packages/core/package.json`

2. **Build and verify**:
```bash
pnpm build:core
cd packages/core
npm pack --dry-run
```

3. **Login to npm**:
```bash
npm login
```

4. **Publish**:
```bash
# From monorepo root
pnpm publish:core

# Or manually
cd packages/core
npm publish --access public
```

### Verify npm Package

```bash
# Install globally
npm install -g shipgate

# Test
isl-verify --version
isl-verify verify --help
```

## Testing the Full Flow

### 1. Test License Purchase

1. Visit your deployed license server (e.g., `https://shipgate.dev`)
2. Click "View Pricing"
3. Enter email and select Team tier
4. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete payment
6. Copy license key from success page

### 2. Test License Activation

```bash
# Install CLI
npm install -g shipgate

# Activate license
shipgate activate <your-license-key>

# Verify
shipgate licenses

# Should show:
# ✓ License active
# Tier: team
# Expires: 2027-02-17...
```

### 3. Test Tier 2 Verification

```bash
# Create test file
echo "export function test() { return true; }" > test.ts

# Run tier 2 verification (requires license)
isl-verify verify test.ts --tier tier2

# Should run successfully with license
```

### 4. Test GitHub Action

Create `.github/workflows/verify.yml`:

```yaml
name: ISL Verify

on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: isl-verify/action@v1
        with:
          tier: tier2
          license: ${{ secrets.SHIPGATE_LICENSE }}
          comment-pr: true
```

Add `SHIPGATE_LICENSE` secret to repository settings.

## Monitoring & Maintenance

### License Server Metrics

- **Stripe Dashboard**: Track payments, refunds
- **Vercel Analytics**: Monitor traffic, errors
- **Error Tracking**: Add Sentry integration for production

### npm Package Stats

```bash
# View download stats
npm view isl-verify

# Check latest version
npm view isl-verify version
```

### Database (Optional)

For production, add PostgreSQL to track:
- Generated licenses
- Usage analytics
- Webhook history

Add to `license-server`:

```bash
# Install Prisma
pnpm add prisma @prisma/client

# Initialize
npx prisma init

# Create schema (schema.prisma):
model License {
  id        String   @id @default(cuid())
  email     String
  tier      String
  key       String   @unique
  createdAt DateTime @default(now())
  expiresAt DateTime
}

# Migrate
npx prisma db push
npx prisma generate
```

## Troubleshooting

### License Validation Fails

- Check `LICENSE_JWT_SECRET` matches between server and client
- Verify license hasn't expired
- Check network connectivity for validation endpoint

### Stripe Webhook Not Firing

- Verify webhook URL is correct
- Check webhook signing secret matches
- Test with Stripe CLI: `stripe listen --forward-to localhost:3100/api/webhook`

### npm Publish Fails

- Ensure `npm login` is successful
- Check package name isn't taken
- Verify `package.json` has correct fields
- Run `npm pack --dry-run` first

## Security Checklist

- [x] Stripe keys are environment variables (never committed)
- [x] JWT secret is strong and unique per environment
- [x] License server uses HTTPS in production
- [x] Webhook signatures are verified
- [x] Rate limiting on API endpoints
- [x] Input validation on all endpoints
- [x] CORS configured properly

## Support

- Documentation: https://docs.isl-verify.com
- GitHub Issues: https://github.com/isl-verify/isl-verify/issues
- Email: support@shipgate.dev
