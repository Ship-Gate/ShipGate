# Shipgate Portal

Web portal for Shipgate Pro subscription management.

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Then fill in:
   - `STRIPE_SECRET_KEY` — from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
   - `STRIPE_PUBLISHABLE_KEY` — from Stripe Dashboard
   - `STRIPE_PRICE_ID` — create a $29 one-time product in Stripe, copy the price ID
   - `STRIPE_WEBHOOK_SECRET` — from `stripe listen --forward-to localhost:3099/api/webhook`
   - `LICENSE_JWT_SECRET` — random 32+ char secret for signing license tokens
   - `OPENAI_API_KEY` — your shared OpenAI key for Pro users

3. **Create Stripe product:**
   - Go to Stripe Dashboard → Products → Add Product
   - Name: "Shipgate Pro"
   - Price: $29 one-time
   - Copy the `price_xxx` ID into `STRIPE_PRICE_ID`

4. **Run locally:**
   ```bash
   pnpm dev
   ```
   Portal runs at http://localhost:3099

5. **Test Stripe webhooks locally:**
   ```bash
   stripe listen --forward-to localhost:3099/api/webhook
   ```

## Architecture

- `/pro` — Landing page with email input → Stripe Checkout
- `/pro/success` — Post-payment page, generates license JWT, redirects to VS Code via URI handler
- `/api/checkout` — Creates Stripe Checkout session
- `/api/webhook` — Stripe webhook (payment confirmation)
- `/api/verify` — Validates license JWT, returns shared API key to Pro users
- `/api/success` — Retrieves Stripe session, signs license JWT

## Flow

1. User clicks "Upgrade to Pro" in VS Code sidebar
2. Browser opens `/pro` — user enters email
3. Redirected to Stripe Checkout ($29)
4. After payment, redirected to `/pro/success?session_id=xxx`
5. Success page calls `/api/success` to get license JWT
6. "Activate in VS Code" button opens `vscode://shipgate.shipgate-isl/activate?token=<jwt>`
7. VS Code URI handler catches it, stores token, verifies with `/api/verify`
8. Extension gets shared API key from verify response
9. Pro features (Heal, Intent Builder) are unlocked

## Deploy

Deploy to Vercel, Netlify, or any Node.js host. Set all env vars in the hosting dashboard.
