# ShipGate Dashboard

Next.js 14 web dashboard for ShipGate — verification runs, team management, and third-party integrations.

## Features

### Core

- **GitHub/Google OAuth** — Login with delegated auth, no password storage
- **Organizations** — Multi-org support with invite-based membership
- **RBAC** — Admin, member, viewer roles enforced on all API routes
- **Stripe billing** — Pro subscription with checkout flow
- **Audit logging** — All actions logged with IP, user agent, request ID, session ID
- **Audit export** — `GET /api/v1/audit?from=&to=&format=csv|json` (admin-only)
- **Vibe pipeline** — NL → ISL → verified code from the browser

### Integrations

- **GitHub** — OAuth connection to view repos, PRs, and commits directly in the dashboard
- **Slack** — OAuth workspace connection with configurable notification rules (channel + event type)
- **Vercel** — Webhook receiver with `x-vercel-signature` verification; deployment status feed
- **Railway** — Webhook receiver with `x-railway-signature` verification; deployment status feed

### Dashboard Visuals

- **Stat cards** with sparkline trend charts
- **Verdict breakdown** donut chart (SHIP / WARN / NO_SHIP)
- **Activity feed** — Chronological timeline of runs, findings, audit events
- **Integration strip** — Connection status for GitHub, Slack, and deployments

## Setup

```bash
cp .env.example .env.local
pnpm install
pnpm dev
# Open http://localhost:3001
```

### Environment Variables

See `.env.example` for all required variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth app |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth app |
| `STRIPE_SECRET_KEY` | Yes | Stripe billing |
| `STRIPE_PRO_PRICE_ID` | Yes | Stripe Pro subscription price ID |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Stripe webhook signing |
| `SLACK_CLIENT_ID` | For Slack | Slack app OAuth |
| `SLACK_CLIENT_SECRET` | For Slack | Slack app OAuth |
| `SLACK_SIGNING_SECRET` | For Slack | Slack request verification |
| `TOKEN_ENCRYPTION_KEY` | For integrations | AES-256-GCM key for stored OAuth tokens (generate: `openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | For Vibe | AI provider for vibe pipeline |

### Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (requires DATABASE_URL)
npx prisma migrate deploy

# Seed (if available)
npx prisma db seed
```

## Project Structure

```
app/
  dashboard/           # Dashboard pages (overview, PRs, team, deploys, settings)
  api/
    auth/              # GitHub/Google OAuth login/callback/logout
    integrations/      # GitHub/Slack/Deploy OAuth flows (connect/callback/disconnect)
    webhooks/          # Vercel and Railway webhook receivers
    v1/                # Versioned API routes
      activity/        # Activity feed
      audit/           # Audit log export
      integrations/    # Integration status, data, and CRUD
      orgs/            # Organization management
      tokens/          # API token management
      vibe/            # Vibe pipeline execution
components/
  ui/                  # Radix UI + Tailwind primitives (button, card, dialog, etc.)
  dashboard/           # Feature components (github-connector, slack-connector, deploy-feed, etc.)
hooks/                 # Custom React hooks (useApi, useData, useIntegrations, useActivity)
lib/                   # Shared utilities (api-auth, encryption, github, prisma, audit)
prisma/
  schema.prisma        # Database schema (User, Org, Membership, Run, Finding, AuditLog, + integration models)
```

## Database Models

### Core

- `User` — OAuth-authenticated users
- `Org` — Organizations with subscription status
- `Membership` — User-org association with role (admin/member/viewer)
- `Project` — Repos/projects within an org
- `Run` — Verification runs with verdict and score
- `Finding` — Individual findings from runs
- `AuditLog` — Immutable audit trail

### Integrations (added 2026-02-27)

- `GitHubConnection` — Stored GitHub OAuth tokens per org (encrypted)
- `SlackConnection` — Stored Slack workspace tokens per org (encrypted)
- `SlackNotificationRule` — Channel + event type notification rules
- `DeploymentProvider` — Vercel/Railway webhook configuration per org
- `Deployment` — Individual deployment records from webhooks

## API Routes

### Authentication

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/github` | GET | Start GitHub OAuth |
| `/api/auth/github/callback` | GET | GitHub OAuth callback |
| `/api/auth/google` | GET | Start Google OAuth |
| `/api/auth/google/callback` | GET | Google OAuth callback |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Current user |

### Integrations

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/github/connect` | GET | Start GitHub repo-access OAuth |
| `/api/integrations/github/callback` | GET | GitHub integration callback |
| `/api/integrations/github/disconnect` | POST | Disconnect GitHub |
| `/api/integrations/slack/connect` | GET | Start Slack workspace OAuth |
| `/api/integrations/slack/callback` | GET | Slack OAuth callback |
| `/api/integrations/slack/disconnect` | POST | Disconnect Slack |
| `/api/v1/integrations/github/status` | GET | GitHub connection status |
| `/api/v1/integrations/github/repos` | GET | List connected repos |
| `/api/v1/integrations/github/prs` | GET | List open PRs |
| `/api/v1/integrations/github/commits` | GET | Recent commits |
| `/api/v1/integrations/slack/status` | GET | Slack connection + rules |
| `/api/v1/integrations/slack/channels` | GET | List Slack channels |
| `/api/v1/integrations/slack/rules` | POST | Create notification rule |
| `/api/v1/integrations/slack/rules/[id]` | DELETE/PATCH | Delete or toggle rule |
| `/api/v1/integrations/deployments/status` | GET | Deployment provider status |
| `/api/v1/integrations/deployments/list` | GET | Recent deployments |
| `/api/v1/integrations/deployments/setup` | POST | Setup deployment provider |
| `/api/v1/integrations/deployments/[id]` | DELETE | Remove provider |

### Webhooks

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webhooks/vercel` | POST | Vercel deployment webhook |
| `/api/webhooks/railway` | POST | Railway deployment webhook |

### Data

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/activity` | GET | Activity feed (runs + audit) |
| `/api/v1/audit` | GET | Audit log export (CSV/JSON) |
| `/api/v1/orgs` | GET/POST | Organization CRUD |
| `/api/v1/tokens` | GET/POST | API token management |
| `/api/v1/vibe/run` | POST | Execute vibe pipeline |

## Tech Stack

- **Framework**: Next.js 14.1.0 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **UI**: Radix UI primitives + Tailwind CSS
- **Charts**: recharts + custom SVG sparklines
- **Auth**: Cookie-based sessions with GitHub/Google OAuth
- **Payments**: Stripe
- **Encryption**: AES-256-GCM (Node.js `crypto`)

## License

MIT
