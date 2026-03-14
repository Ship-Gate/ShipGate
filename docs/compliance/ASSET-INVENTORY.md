# Asset Inventory

**Internal Reference — ShipGate**

*Supports SOC 2 CC3 (Risk Assessment). Last updated: 2026-03-01.*

---

## 1. Purpose

This document inventories the systems, services, and data stores that comprise ShipGate's production environment. It is maintained to support risk assessment, access reviews, and compliance audits.

---

## 2. Application Assets

| Asset | Description | Owner | Classification |
|-------|-------------|-------|----------------|
| ShipGate Dashboard | Next.js web app — runs, findings, audit, billing, integrations | Engineering | Production |
| Dashboard API (Next.js routes) | REST API for dashboard (/api/v1/*) | Engineering | Production |
| ShipGate CLI | npm CLI (npx shipgate) — verify, gate, scan | Engineering | Production |
| VS Code Extension | IDE integration for real-time verification | Engineering | Production |
| MCP Server | AI Firewall / Model Context Protocol server | Engineering | Production |
| Landing Site | Marketing site (landing-main, React/Vite) | Marketing / Eng | Production |
| Documentation Site | Astro/Starlight docs (packages/docs) | Engineering | Production |

---

## 3. Infrastructure Assets

| Asset | Provider | Purpose | Classification |
|-------|----------|---------|----------------|
| PostgreSQL database | [TBD — Neon / Supabase / RDS] | Primary data store | Production — Critical |
| Hosting (dashboard) | [TBD — Vercel / Netlify] | Serves dashboard and API routes | Production — Critical |
| Hosting (landing) | [TBD — Vercel / Netlify] | Serves landing page | Production |
| DNS | [TBD] | Domain management | Production |
| npm registry | npm | Package distribution | Production |
| VS Code Marketplace | Microsoft | Extension distribution | Production |

---

## 4. Third-Party Services (Subprocessors)

| Service | Purpose | Data handled | Classification |
|---------|---------|--------------|----------------|
| Stripe | Payments | Billing info (no card data stored) | Production — PCI |
| GitHub | OAuth + repo metadata | OAuth tokens (encrypted), public repo info | Production |
| Google | OAuth | OAuth tokens (encrypted), email/name | Production |
| Slack | Notifications | OAuth token (encrypted), channel metadata | Production |
| Vercel | Deployment webhooks | Deployment metadata | Production |
| Railway | Deployment webhooks | Deployment metadata | Production |

---

## 5. Data Stores and Classifications

| Data category | Store | Encryption | Retention |
|---------------|-------|------------|-----------|
| User accounts (email, name, avatar) | PostgreSQL | At rest (infra-level) | Active account + reasonable period |
| Org and membership | PostgreSQL | At rest (infra-level) | Active account |
| OAuth tokens (GitHub, Slack) | PostgreSQL | AES-256-GCM (application) | Until disconnected |
| Audit logs | PostgreSQL | At rest (infra-level) | 12+ months |
| Runs, findings, proof bundles | PostgreSQL | At rest (infra-level) | Active account |
| PAT hashes | PostgreSQL | SHA-256 (one-way) | Until revoked |
| Payment data | Stripe (not stored) | Stripe-managed | Stripe retention |
| Source code | Never uploaded | N/A | N/A |

---

## 6. Access Entitlements

| System | Who | Level |
|--------|-----|-------|
| Production database | Infrastructure team | Read/write |
| Dashboard admin panel | Org admins (customer) | Per-org RBAC |
| Stripe dashboard | Finance + leadership | Admin |
| GitHub org | Engineering | Contributor |
| Hosting admin | Infrastructure team | Deploy |

---

## 7. Review Schedule

This inventory is reviewed at least annually, or when material infrastructure changes occur.
