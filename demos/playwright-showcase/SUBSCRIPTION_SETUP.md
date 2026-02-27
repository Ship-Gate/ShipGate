# Shipgate subscription setup

This app is set up for a sellable subscription product. Configure the following to go live.

## 1. Clerk (auth)

- Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
- In **Paths**, set Sign-in and Sign-up URLs to `/sign-in` and `/sign-up` (or your deployed base path).
- Add to `.env`:
  - `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...` (or `pk_live_...` for production).

Without this key, the app still runs; sign-in/sign-up show a “not configured” message.

## 2. Stripe (billing)

- In [Stripe Dashboard](https://dashboard.stripe.com):
  - Create a **Product** (e.g. “Shipgate Team”).
  - Add a **Price** (recurring, $29/user/month or your amount).
- Add to server env (no `VITE_`; e.g. in `.env` loaded by the server or your host):
  - `STRIPE_SECRET_KEY=sk_test_...` (or `sk_live_...`).
  - `STRIPE_TEAM_PRICE_ID=price_...` (the Price ID from the product).

Optional:

- `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL` – full URLs after checkout (defaults point to `/dashboard` and `/pricing`).
- `STRIPE_PORTAL_RETURN_URL` – return URL after Stripe Customer Portal (default: `/dashboard`).

Without these, “Start 14-day trial” returns 503 with a clear message.

## 3. Stripe webhook (subscription lifecycle)

So your backend or Clerk knows when someone subscribes or cancels:

- In Stripe Dashboard → **Webhooks** → **Add endpoint**:
  - URL: `https://your-api-host/api/webhooks/stripe`.
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Copy the **Signing secret** and set:
  - `STRIPE_WEBHOOK_SECRET=whsec_...`.

The handler in `server/index.ts` verifies the signature and handles the events. Implement the TODOs there to persist `customerId` and `subscriptionId` (e.g. to Clerk org/user metadata or your DB) so the Dashboard can show “Manage billing” and the correct plan.

## 4. Dashboard plan and billing link

- **Plan**: Dashboard currently shows “Free” by default. After implementing the webhook TODOs, load the user’s (or org’s) plan from your DB or Clerk `publicMetadata`.
- **Manage billing**: When you have the customer’s Stripe `customerId`, call `POST /api/create-portal-session` with `{ "customerId": "cus_..." }` and redirect the user to the returned URL. Wire that to the “Manage billing” button and pass the stored `customerId`.

## 5. API base URL (optional)

- Dev: Vite proxies `/api` to the server (port 3456), so no `VITE_API_URL` needed.
- Production: If the frontend is on a different origin than the API, set `VITE_API_URL=https://your-api-host` so checkout and portal requests hit the right server.

---

**Summary**

| What              | Env / config |
|-------------------|--------------|
| Auth              | `VITE_CLERK_PUBLISHABLE_KEY` |
| Checkout          | `STRIPE_SECRET_KEY`, `STRIPE_TEAM_PRICE_ID` |
| Webhook           | `STRIPE_WEBHOOK_SECRET` + endpoint URL in Stripe |
| Dashboard plan    | Implement webhook TODOs → store plan + customerId |
