# Threat Model

**Internal Reference — ShipGate**

*Supports SOC 2 CC3 (Risk Assessment). Last updated: 2026-03-01.*

---

## 1. System Overview

ShipGate consists of:
- **CLI/Extension** — runs locally; no code leaves the user's machine
- **Dashboard** — Next.js web app with PostgreSQL; handles accounts, runs, findings, integrations
- **API routes** — REST endpoints authenticated via OAuth session or PAT
- **Integrations** — GitHub, Google (OAuth), Slack (notifications), Stripe (payments), Vercel/Railway (webhooks)

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────┐
│  User's machine (trusted)           │
│  ┌────────┐  ┌──────────┐          │
│  │ CLI    │  │ VS Code  │          │
│  └────────┘  └──────────┘          │
└────────────────┬────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────┐
│  ShipGate production (semi-trusted) │
│  ┌────────────────┐                 │
│  │ Dashboard/API  │─── PostgreSQL   │
│  └────────────────┘                 │
│        │                            │
│  ┌─────▼─────────────────────┐      │
│  │ External: Stripe, GitHub, │      │
│  │ Google, Slack, Vercel,    │      │
│  │ Railway                   │      │
│  └───────────────────────────┘      │
└─────────────────────────────────────┘
```

---

## 3. Threat Categories and Mitigations

### 3.1 Authentication and Authorization

| Threat | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| Credential stuffing | High | OAuth-only (no passwords) | Mitigated |
| Session hijacking | High | Secure cookies, HTTPS, session hashing in audit logs | Mitigated |
| PAT compromise | High | SHA-256 hashing, revocable, expirable | Mitigated |
| Privilege escalation | Critical | RBAC enforced on all routes via middleware | Mitigated |
| Missing auth on new routes | High | `authenticate()` required; code review checklist | Mitigated (process) |

### 3.2 Data Protection

| Threat | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| OAuth token theft from DB | Critical | AES-256-GCM encryption at rest | Mitigated |
| Encryption key leak | Critical | Env var (`TOKEN_ENCRYPTION_KEY`), not in code | Mitigated (process) |
| Source code exfiltration | Critical | Source code never uploaded; CLI runs locally | By design |
| PII in logs | Medium | Audit logs capture userId, not PII content; no request bodies logged | Mitigated |
| Database access by unauthorized party | High | Infra-level access controls, encrypted connections | Mitigated |

### 3.3 API and Input

| Threat | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| SQL injection | High | Prisma ORM (parameterized queries) | Mitigated |
| XSS | Medium | React auto-escaping, no dangerouslySetInnerHTML in user data | Mitigated |
| CSRF | Medium | Same-origin cookies, CORS | Mitigated |
| Webhook spoofing | High | HMAC signature verification (Vercel, Railway) | Mitigated |
| Mass data exfiltration via audit API | Medium | Admin-only, org-scoped, paginated, 10k row limit on export | Mitigated |

### 3.4 Availability and Infrastructure

| Threat | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| DDoS | Medium | Hosting provider protections (Vercel/Netlify) | Partial |
| Database outage | High | Provider-managed backups; see BCP/DR policy | Partial |
| Dependency supply chain attack | Medium | Lockfile enforcement (pnpm), dependency audits | Mitigated (process) |
| OAuth provider outage | Low | Cached sessions persist until expiry | Accepted |

### 3.5 Insider Threats

| Threat | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| Malicious admin | Medium | Audit trail of all actions; limited prod access | Mitigated |
| Accidental data deletion | Medium | DB backups; soft-delete patterns where applicable | Partial |

---

## 4. Residual Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No DDoS-specific protection beyond hosting provider | Medium | Monitor; evaluate WAF if needed |
| No automated secret rotation | Low | Manual rotation process; document cadence |
| Rate limiting not enforced on all endpoints | Low | Add per-route rate limiting as traffic grows |

---

## 5. Review

This threat model is reviewed at least annually, after significant architecture changes, or after security incidents.
