# Self-Hosted ShipGate Deployment Guide

Deploy ShipGate on your own infrastructure for full control over data residency,
network isolation, and compliance requirements.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (Docker Compose)](#2-quick-start-docker-compose)
3. [Configuration Reference](#3-configuration-reference)
4. [Database Setup](#4-database-setup)
5. [Authentication Setup](#5-authentication-setup)
6. [Reverse Proxy (Production)](#6-reverse-proxy-production)
7. [Monitoring](#7-monitoring)
8. [Backup and Recovery](#8-backup-and-recovery)
9. [Upgrading](#9-upgrading)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Requirement          | Minimum              | Recommended            |
|----------------------|----------------------|------------------------|
| Node.js              | 20.x                 | 20 LTS (latest)        |
| PostgreSQL           | 14                   | 16                     |
| Docker               | 24.x                 | 27.x                   |
| Docker Compose       | v2.20+               | v2.30+                 |
| CPU cores            | 2                    | 4+                     |
| RAM                  | 4 GB                 | 8 GB+                  |
| Disk                 | 20 GB                | 50 GB+ (SSD)           |
| OS                   | Linux (amd64/arm64)  | Ubuntu 22.04 / Debian 12 |

**Additional requirements for production:**

- A domain name (e.g. `shipgate.yourcompany.com`)
- A valid SSL/TLS certificate (or use Caddy for automatic HTTPS)
- Outbound HTTPS access for OAuth callbacks (GitHub, Google)
- A firewall allowing inbound traffic on ports 80/443

---

## 2. Quick Start (Docker Compose)

```bash
# Clone the repository
git clone https://github.com/shipgate/shipgate.git
cd shipgate

# Create your environment file
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration Reference](#3-configuration-reference)):

```bash
# Required — generate these with: openssl rand -base64 32
JWT_SECRET=<random-64-char-secret>
SESSION_SECRET=<random-64-char-secret>

# Database — the compose stack provides PostgreSQL automatically
DATABASE_URL=postgresql://shipgate:shipgate@postgres:5432/shipgate

# OAuth — at least one provider is required for login
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
```

Start the stack:

```bash
docker compose up -d
```

Wait for all services to become healthy:

```bash
docker compose ps
```

Once running:

| Service    | URL                        | Purpose                     |
|------------|----------------------------|-----------------------------|
| Dashboard  | http://localhost:3001      | Web UI, API routes, Prisma  |
| API Server | http://localhost:4000      | Verification API (Hono)     |
| PostgreSQL | localhost:5432             | Primary database            |
| Redis      | localhost:6379             | Cache and rate-limit store  |

**First-time setup** — run database migrations:

```bash
docker compose exec dashboard npx prisma migrate deploy
```

Optionally seed development data:

```bash
docker compose exec dashboard npx prisma db seed
```

Open http://localhost:3001 and sign in with your configured OAuth provider.

---

## 3. Configuration Reference

All configuration is managed through environment variables in `.env`.

### Core

| Variable            | Required | Default         | Description                                        |
|---------------------|----------|-----------------|----------------------------------------------------|
| `NODE_ENV`          | No       | `production`    | Runtime environment (`development` or `production`) |
| `PORT`              | No       | `3000`          | Internal port for general services                 |
| `DASHBOARD_PORT`    | No       | `3001`          | Port the Next.js dashboard listens on              |
| `FRONTEND_URL`      | No       | —               | Public URL of the dashboard (for OAuth redirects)  |

### Database

| Variable            | Required | Default           | Description                                      |
|---------------------|----------|-------------------|--------------------------------------------------|
| `DATABASE_URL`      | **Yes**  | `file:./dev.db`   | PostgreSQL connection string                     |
| `REDIS_URL`         | No       | —                 | Redis connection string for caching              |

### Secrets

| Variable            | Required | Default                   | Description                                 |
|---------------------|----------|---------------------------|---------------------------------------------|
| `JWT_SECRET`        | **Yes**  | (insecure placeholder)    | HMAC key for JWT signing (min 32 chars)     |
| `SESSION_SECRET`    | **Yes**  | (insecure placeholder)    | Session encryption key (min 32 chars)       |
| `API_KEY`           | No       | —                         | Dashboard internal API key                  |

### GitHub OAuth

| Variable                | Required | Default | Description                                     |
|-------------------------|----------|---------|-------------------------------------------------|
| `GITHUB_CLIENT_ID`      | No*      | —       | GitHub OAuth App client ID                      |
| `GITHUB_CLIENT_SECRET`  | No*      | —       | GitHub OAuth App client secret                  |
| `GITHUB_TOKEN`          | No       | —       | Personal access token for GitHub API calls      |
| `GITHUB_APP_ID`         | No       | —       | GitHub App ID (for GitHub App integration)      |
| `GITHUB_APP_PRIVATE_KEY`| No       | —       | GitHub App private key (PEM format)             |
| `GITHUB_WEBHOOK_SECRET` | No       | —       | Secret for validating GitHub webhook payloads   |

*\*At least one OAuth provider (GitHub or Google) is required for user login.*

### Google OAuth

| Variable                | Required | Default | Description                                     |
|-------------------------|----------|---------|-------------------------------------------------|
| `GOOGLE_CLIENT_ID`      | No*      | —       | Google OAuth 2.0 client ID                      |
| `GOOGLE_CLIENT_SECRET`  | No*      | —       | Google OAuth 2.0 client secret                  |

### Stripe Billing (Optional)

| Variable                  | Required | Default | Description                                   |
|---------------------------|----------|---------|-----------------------------------------------|
| `STRIPE_SECRET_KEY`       | No       | —       | Stripe API secret key                         |
| `STRIPE_PUBLISHABLE_KEY`  | No       | —       | Stripe publishable key (for frontend)         |
| `STRIPE_WEBHOOK_SECRET`   | No       | —       | Stripe webhook endpoint signing secret        |
| `STRIPE_PRO_PRICE_ID`     | No       | —       | Stripe Price ID for Pro plan                  |
| `STRIPE_ENTERPRISE_PRICE_ID` | No    | —       | Stripe Price ID for Enterprise plan           |
| `STRIPE_SUCCESS_URL`      | No       | —       | Redirect URL after successful checkout        |
| `STRIPE_CANCEL_URL`       | No       | —       | Redirect URL after cancelled checkout         |
| `STRIPE_PORTAL_RETURN_URL`| No       | —       | Return URL from Stripe customer portal        |

### API Server

| Variable              | Required | Default | Description                                       |
|-----------------------|----------|---------|---------------------------------------------------|
| `SHIPGATE_API_KEYS`   | No       | —       | Comma-separated list of `sg_key_*` API tokens     |
| `SHIPGATE_RATE_LIMIT`  | No       | `100`   | Max requests per IP per 60-second window          |

### AI / ISL

| Variable              | Required | Default   | Description                                     |
|-----------------------|----------|-----------|-------------------------------------------------|
| `ISL_AI_ENABLED`      | No       | `false`   | Enable AI-assisted spec generation              |
| `ISL_AI_PROVIDER`     | No       | `openai`  | AI provider (`openai`)                          |

### Observability

| Variable                        | Required | Default              | Description                            |
|---------------------------------|----------|----------------------|----------------------------------------|
| `LOG_LEVEL`                     | No       | `info`               | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `ENABLE_METRICS`                | No       | `true`               | Expose Prometheus metrics              |
| `ENABLE_TRACING`                | No       | `true`               | Enable OpenTelemetry tracing           |
| `OTEL_SERVICE_NAME`             | No       | `intent-os`          | OTel service name                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | No       | `http://localhost:4318` | OTel collector endpoint             |
| `OTEL_EXPORTER_OTLP_PROTOCOL`  | No       | `grpc`               | OTel protocol (`grpc` or `http`)       |
| `PROMETHEUS_PORT`               | No       | `9090`               | Prometheus scrape port                 |

---

## 4. Database Setup

ShipGate uses PostgreSQL with Prisma ORM. The schema is defined at
`packages/shipgate-dashboard/prisma/schema.prisma`.

### Running Migrations

```bash
# Inside Docker
docker compose exec dashboard npx prisma migrate deploy

# Without Docker
cd packages/shipgate-dashboard
npx prisma migrate deploy
```

### Seeding Data

```bash
docker compose exec dashboard npx prisma db seed
```

### Inspecting the Database

Prisma Studio provides a visual database browser:

```bash
docker compose exec dashboard npx prisma studio
```

### Connection Pooling

For production deployments with high concurrency, use a connection pooler like
[PgBouncer](https://www.pgbouncer.org/) between your application and PostgreSQL:

```
Application → PgBouncer (port 6432) → PostgreSQL (port 5432)
```

Set `DATABASE_URL` to point at PgBouncer and add `?pgbouncer=true&connection_limit=10`
to the connection string:

```
DATABASE_URL=postgresql://shipgate:password@pgbouncer:6432/shipgate?pgbouncer=true&connection_limit=10
```

### PostgreSQL Tuning

For a 4 GB RAM server handling moderate load:

```ini
# postgresql.conf
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 200
```

---

## 5. Authentication Setup

ShipGate supports GitHub OAuth, Google OAuth, SAML/SSO, and API key authentication.

### GitHub OAuth

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set the fields:
   - **Application name:** `ShipGate (self-hosted)`
   - **Homepage URL:** `https://shipgate.yourcompany.com`
   - **Authorization callback URL:** `https://shipgate.yourcompany.com/api/auth/github/callback`
3. Copy the **Client ID** and **Client Secret** into `.env`:

```bash
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=abc123...
```

### Google OAuth

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. Configure the OAuth consent screen:
   - **App name:** `ShipGate`
   - **Authorized domains:** `yourcompany.com`
4. Set **Authorized redirect URIs:**
   ```
   https://shipgate.yourcompany.com/api/auth/google/callback
   ```
5. Copy credentials into `.env`:

```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### SAML / SSO

ShipGate uses [BoxyHQ SAML Jackson](https://boxyhq.com/docs/jackson/overview) for
enterprise SSO. To configure:

1. **Enable SSO** for your organization in the dashboard under **Settings → SSO**
2. **Configure your Identity Provider** (Okta, Azure AD, OneLogin, etc.):
   - **ACS URL:** `https://shipgate.yourcompany.com/api/auth/saml/acs`
   - **Entity ID / Audience:** `https://shipgate.yourcompany.com`
   - **Name ID format:** `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`
3. **Upload IdP metadata** (XML file or metadata URL) via the dashboard SSO settings
4. Optionally **enforce SSO** — when enabled, users on the verified domain must
   authenticate through the IdP and cannot use GitHub/Google OAuth

### API Keys

The API server authenticates requests using Bearer tokens with the `sg_key_` prefix.

**Generating keys:**

```bash
# Generate a random API key
echo "sg_key_$(openssl rand -hex 24)"
```

**Configuring keys** — add them as a comma-separated list:

```bash
SHIPGATE_API_KEYS=sg_key_abc123...,sg_key_def456...
```

**Using keys** in API calls:

```bash
curl -H "Authorization: Bearer sg_key_abc123..." \
  https://api.shipgate.yourcompany.com/api/v1/gate
```

If `SHIPGATE_API_KEYS` is empty, the API server runs in open mode (no authentication
required). Always set API keys in production.

---

## 6. Reverse Proxy (Production)

Never expose the Dashboard or API Server directly to the internet. Use a reverse
proxy for SSL termination, request buffering, and rate limiting.

### Nginx

```nginx
upstream dashboard {
    server 127.0.0.1:3001;
    keepalive 32;
}

upstream api_server {
    server 127.0.0.1:4000;
    keepalive 32;
}

server {
    listen 80;
    server_name shipgate.yourcompany.com api.shipgate.yourcompany.com;
    return 301 https://$host$request_uri;
}

# Dashboard
server {
    listen 443 ssl http2;
    server_name shipgate.yourcompany.com;

    ssl_certificate     /etc/ssl/certs/shipgate.crt;
    ssl_certificate_key /etc/ssl/private/shipgate.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass http://dashboard;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for Next.js HMR and real-time updates
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}

# API Server
server {
    listen 443 ssl http2;
    server_name api.shipgate.yourcompany.com;

    ssl_certificate     /etc/ssl/certs/shipgate.crt;
    ssl_certificate_key /etc/ssl/private/shipgate.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location / {
        proxy_pass http://api_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy (Auto-HTTPS)

Caddy automatically provisions and renews TLS certificates via Let's Encrypt:

```caddyfile
shipgate.yourcompany.com {
    reverse_proxy localhost:3001
}

api.shipgate.yourcompany.com {
    reverse_proxy localhost:4000
}
```

That's it — Caddy handles HTTPS automatically.

---

## 7. Monitoring

### Health Check Endpoints

The API server exposes a health endpoint:

```bash
curl http://localhost:4000/api/v1/health
```

Response:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "detectors": [
    "security-scanner",
    "hallucination-scanner",
    "taint-tracker",
    "specless-gate",
    "isl-parser"
  ]
}
```

The Dashboard health can be checked at:

```bash
curl http://localhost:3001/api/v1/health
```

### Prometheus Metrics

When `ENABLE_METRICS=true`, metrics are exposed on the configured `PROMETHEUS_PORT`.

Example Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'shipgate-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: /metrics
```

### Log Aggregation

View logs in real time:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f dashboard
docker compose logs -f api-server
```

For centralized logging, forward Docker logs to your aggregation platform:

| Platform       | Driver                                         |
|----------------|------------------------------------------------|
| Datadog        | `docker compose` logging driver: `datadog`     |
| Loki/Grafana   | Install Promtail sidecar or Docker plugin      |
| ELK Stack      | Use Filebeat with Docker autodiscovery         |
| CloudWatch     | `awslogs` Docker logging driver                |

Example with the `fluentd` driver in `docker-compose.override.yml`:

```yaml
services:
  dashboard:
    logging:
      driver: fluentd
      options:
        fluentd-address: "localhost:24224"
        tag: "shipgate.dashboard"
```

---

## 8. Backup and Recovery

### PostgreSQL Backup

**Automated daily backups** using `pg_dump`:

```bash
#!/bin/bash
# /opt/shipgate/backup.sh
BACKUP_DIR="/var/backups/shipgate"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres \
  pg_dump -U shipgate -Fc shipgate \
  > "$BACKUP_DIR/shipgate_${TIMESTAMP}.dump"

# Retain last 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
```

Add to cron:

```bash
# Run daily at 2:00 AM
0 2 * * * /opt/shipgate/backup.sh >> /var/log/shipgate-backup.log 2>&1
```

**Restoring from backup:**

```bash
docker compose exec -T postgres \
  pg_restore -U shipgate -d shipgate --clean --if-exists \
  < /var/backups/shipgate/shipgate_20260301_020000.dump
```

### Proof Bundle Storage

Proof bundles and artifacts referenced in the `artifacts` table should be backed up
alongside the database. If stored on local disk:

```bash
tar czf proof_bundles_${TIMESTAMP}.tar.gz /var/shipgate/artifacts/
```

### Configuration Backup

Keep a versioned copy of your `.env` and any custom configuration:

```bash
cp .env "$BACKUP_DIR/env_${TIMESTAMP}"
cp docker-compose.yml "$BACKUP_DIR/docker-compose_${TIMESTAMP}.yml"
```

> **Never store `.env` backups in version control** — use a secrets manager or
> encrypted storage for sensitive configuration.

---

## 9. Upgrading

### Docker Compose Deployment

```bash
# Pull the latest source
git pull origin main

# Rebuild services
docker compose build --no-cache dashboard api-server

# Run database migrations before restarting
docker compose exec dashboard npx prisma migrate deploy

# Rolling restart (zero-downtime for stateless services)
docker compose up -d --no-deps dashboard
docker compose up -d --no-deps api-server

# Verify all services are healthy
docker compose ps
```

### Pre-Upgrade Checklist

1. **Backup the database** (see [Backup and Recovery](#8-backup-and-recovery))
2. **Read the changelog** for breaking changes
3. **Test in staging** if you have a staging environment
4. **Plan for migration time** — some Prisma migrations may lock tables briefly

### Rollback

If an upgrade fails:

```bash
# Roll back to previous commit
git checkout <previous-commit-sha>

# Rebuild and restart
docker compose build dashboard api-server
docker compose up -d

# If the database migration was destructive, restore from backup
docker compose exec -T postgres \
  pg_restore -U shipgate -d shipgate --clean --if-exists \
  < /var/backups/shipgate/shipgate_<pre-upgrade>.dump
```

---

## 10. Troubleshooting

### Checking Service Logs

```bash
# Real-time logs for all services
docker compose logs -f

# Last 100 lines from a specific service
docker compose logs --tail=100 dashboard

# Filter for errors
docker compose logs dashboard 2>&1 | grep -i error
```

### Common Issues

#### Dashboard won't start — `prisma: command not found`

Prisma generates the client during `postinstall`. Rebuild the dashboard image:

```bash
docker compose build --no-cache dashboard
docker compose up -d dashboard
```

#### `ECONNREFUSED` connecting to PostgreSQL

The dashboard is starting before PostgreSQL is ready. The docker-compose health check
should handle this, but verify:

```bash
# Check PostgreSQL health
docker compose exec postgres pg_isready -U shipgate

# Check the DATABASE_URL is correct
docker compose exec dashboard printenv DATABASE_URL
```

Ensure `DATABASE_URL` uses the Docker service name (`postgres`) as the hostname,
not `localhost`:

```
DATABASE_URL=postgresql://shipgate:shipgate@postgres:5432/shipgate
```

#### OAuth callback returns `redirect_uri_mismatch`

The callback URL registered with your OAuth provider must exactly match the URL
the dashboard sends. Common mismatches:

| Issue                      | Fix                                                |
|----------------------------|----------------------------------------------------|
| HTTP vs HTTPS              | Ensure callback uses `https://` in production      |
| Trailing slash             | Remove trailing `/` from callback URL              |
| Wrong port                 | Use your public domain, not `localhost:3001`        |
| Wrong path                 | GitHub: `/api/auth/github/callback`                |
|                            | Google: `/api/auth/google/callback`                |

#### API server returns `401 Unauthorized`

- Verify your API key has the `sg_key_` prefix
- Check the key is included in `SHIPGATE_API_KEYS` (comma-separated, no spaces around keys)
- Ensure the `Authorization` header format is `Bearer sg_key_...`

#### Rate limit errors (`429 Too Many Requests`)

The default rate limit is 100 requests per IP per minute. Increase it:

```bash
SHIPGATE_RATE_LIMIT=500
```

The `Retry-After` header in the 429 response indicates when to retry.

#### Database migrations fail

```bash
# Check migration status
docker compose exec dashboard npx prisma migrate status

# Reset the database (DESTRUCTIVE — development only)
docker compose exec dashboard npx prisma migrate reset

# Force-apply a migration if it was partially applied
docker compose exec dashboard npx prisma migrate resolve --applied <migration-name>
```

#### High memory usage

- Set Node.js heap limit: add `NODE_OPTIONS=--max-old-space-size=2048` to `.env`
- Enable Redis for caching to reduce database load
- Check for memory leaks: `docker stats`

### Getting Help

- **GitHub Issues:** https://github.com/shipgate/shipgate/issues
- **Documentation:** See `docs/` directory in the repository
- **API Reference:** http://localhost:4000/api/v1/openapi.json (when running)
