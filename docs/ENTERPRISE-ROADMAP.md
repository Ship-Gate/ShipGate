# ShipGate Enterprise Readiness & SOC 2 Roadmap

> Strategic plan to position ShipGate for enterprise customers and SOC 2 compliance.
> 
> **Last updated: 2026-02-27**

---

## Executive Summary

Enterprise buyers expect: **SOC 2 Type II**, **SSO/SAML**, **RBAC**, **audit exports**, **DPA**, **security questionnaires**, and clear evidence of security controls. This roadmap aligns ShipGate's technical and process work with those expectations.

---

## Current State

### Already in place

- **RBAC** — `Membership.role` with admin, member, viewer enforcement across all API routes via `requireOrgRole()` / `requireAdminOrMember()` middleware
- **Audit logging** — `AuditLog` table with `ipAddress`, `userAgent`, `requestId`, `sessionId`; actions logged for runs, findings, token operations, logins, role changes
- **Audit export API** — `GET /api/v1/audit?from=&to=&format=csv|json` with org-scoped, paginated export (admin-only)
- **shipgate-compliance** — SOC2 CC-series mapping for proof bundles and checks
- **Signed proof bundles** — HMAC-SHA256 for tamper detection
- **PostgreSQL** — Structured, auditable data store
- **OAuth (GitHub/Google)** — Delegated auth, no password storage
- **Stripe** — PCI-compliant payments; no card data stored
- **Encryption in transit** — HTTPS for all traffic
- **Encryption at rest** — AES-256-GCM for stored OAuth tokens (GitHub, Slack) via `lib/encryption.ts`
- **GitHub integration** — OAuth connection, read-only repo/PR/commit data display in dashboard
- **Slack integration** — OAuth workspace connection, configurable notification rules (channel + event type)
- **Deployment tracking** — Webhook receivers for Vercel and Railway with signature verification; deployment feed in dashboard
- **Activity feed** — Unified chronological feed of runs, findings, and audit log entries
- **Dashboard visuals** — Sparkline trends, verdict breakdown chart, integration status strip

### Remaining Gaps

- ~~No SSO/SAML for enterprise IdPs~~ **Done** — SAML 2.0 via BoxyHQ Jackson
- ~~No SCIM provisioning~~ **Done** — JIT provisioning on first SSO login
- ~~No documented retention or deletion policies~~ **Done** — Privacy policy + Security page (retention), DPA (deletion)
- ~~No formal security/incident response program (process, not code)~~ **Done** — `docs/policies/` (drafts, pending legal review)
- No formal SOC 2 readiness/audit program engagement
- ~~Audit export UI not yet in dashboard settings (API exists)~~ **Done** — Settings → Audit Log → Export (dashboard API + UI)
- ~~Slack notification dispatch not yet wired (rules stored, events not yet fired)~~ **Done** — run.completed, verdict.no_ship, finding.critical dispatch to Slack

---

## Phases

### Phase 1: SOC 2 Readiness (Foundation) — LARGELY COMPLETE

**Target: 3–4 months to Type I readiness**

| Control area        | Deliverable                                          | Status |
|---------------------|------------------------------------------------------|--------|
| **Security policies** | InfoSec, Access, Incident Response, BCP/DR policies | Draft at `docs/policies/` |
| **Risk assessment** | Asset inventory, threat model, risk register          | Drafts at `docs/compliance/` |
| **Vendor management** | Subprocessor list, DPAs, vendor review process     | Drafts at `docs/compliance/VENDOR-MANAGEMENT.md` + `docs/legal/DPA-TEMPLATE.md` |
| **Access control**  | RBAC (org admin vs member vs viewer), least-privilege | **DONE** |
| **Audit trail**     | Immutable logs with IP/UA/requestId, export for auditors | **DONE** |
| **Encryption**      | AES-256-GCM at rest (tokens), TLS in transit         | **DONE** |

**Technical work completed:**

1. **RBAC** — `role` on `Membership` (admin, member, viewer); enforced on all API routes; billing/tokens restricted to admin/member; viewer for read-only
2. **Audit log enhancements** — `ipAddress`, `userAgent`, `requestId`, `sessionId` fields added; login/logout/token/role changes logged
3. **Audit export API** — `GET /api/v1/audit?from=&to=&format=csv|json` with pagination, org scope, admin-only access
4. **Encryption at rest** — AES-256-GCM via `lib/encryption.ts` for all stored OAuth tokens; `TOKEN_ENCRYPTION_KEY` env var

**Remaining Phase 1 work (process, not code):**

- ~~Draft and publish InfoSec, Access Control, Incident Response, BCP/DR policies~~ — Drafts in `docs/policies/`
- ~~Compile subprocessor list and DPA template~~ — Security page + `docs/legal/DPA-TEMPLATE.md`
- ~~Complete asset inventory and threat model~~ — `docs/compliance/ASSET-INVENTORY.md`, `THREAT-MODEL.md`, `RISK-REGISTER.md`

---

### Phase 2: SSO & Enterprise Identity

**Target: 2–3 months**

| Deliverable            | Description                                      | Status |
|-------------------------|--------------------------------------------------|--------|
| **SAML 2.0 SSO**       | IdP-initiated and SP-initiated flows (BoxyHQ Jackson) | **DONE** |
| **SCIM provisioning**  | JIT provisioning on first SSO login              | **DONE** (JIT) |
| **Just-in-Time (JIT)** | Auto-provision users on first SSO login          | **DONE** |
| **Domain verification**| Allow only corporate email domains               | **DONE** |

**Technical work (Phase 2) — COMPLETED**

- BoxyHQ SAML Jackson integrated (`lib/jackson.ts`, shares PostgreSQL)
- Org schema: `ssoEnabled`, `ssoDomain`, `ssoEnforced`, `domainVerified`, `domainVerifyToken`
- 5 SAML routes: login, ACS, token, userinfo, callback (with JIT provisioning)
- SSO connection admin API (CRUD via Jackson connectionAPIController)
- Domain verification via DNS TXT record (`_shipgate-verify.{domain}`)
- SSO enforcement in middleware + api-auth (rejects non-SAML sessions for enforced orgs)
- SSO admin settings page: domain claim/verify, SAML config, enable/enforce toggles
- SSO login entry point: email domain lookup → SAML redirect

---

### Phase 3: SOC 2 Type II Audit

**Target: 6–12 months of evidence collection**

| Activity                    | Timeline        | Status |
|-----------------------------|-----------------|--------|
| Engage SOC 2 auditor        | Month 1          | Not started |
| Implement control gaps       | Months 1–3      | **Technical controls DONE** |
| Run controls in production   | Months 1–12     | In progress |
| Evidence collection          | Ongoing         | **Automated** |
| Type II audit                | After 6–12 months | Not started |

**Technical work (Phase 3) — COMPLETED**

- Compliance evidence API (`/api/v1/compliance/evidence`) — aggregates CC5–CC8 data from audit logs, RBAC, proof bundles, runs
- Compliance controls API (`/api/v1/compliance/controls`) — live SOC 2 CC control status (met/partial/not_met) with evidence
- ComplianceSnapshot model — point-in-time evidence captures with period and framework
- Compliance dashboard page (`/dashboard/compliance`) — control checklist, evidence summary, snapshot management
- Automated evidence collection endpoint (`/api/v1/compliance/collect`) — cron-ready, idempotent per org/period
- Compliance panel wired to real data (replaced stub)
- Proof preview wired to real proof bundle data (replaced mock)

**Control families (CC series)**

- **CC1** – Control environment
- **CC2** – Communication
- **CC3** – Risk assessment *(docs/compliance/ — asset inventory, threat model, risk register)*
- **CC4** – Monitoring
- **CC5** – Control activities *(Verification runs tracked, encryption verified)*
- **CC6** – Logical access *(RBAC + SSO implemented, live status in dashboard)*
- **CC7** – System operations *(Audit trail + export + evidence collection)*
- **CC8** – Change management *(Proof bundles + signed evidence + live tracking)*
- **CC9** – Risk mitigation *(Risk register, vendor management docs)*

---

### Phase 4: Extended Compliance

**Target: 12–18 months**

| Framework  | Scope / notes                                      |
|------------|----------------------------------------------------|
| **HIPAA**  | BAA, PHI handling, access logging                 |
| **GDPR**   | DPA, consent, deletion, data portability           |
| **FedRAMP**| If pursuing federal government contracts          |

---

## Immediate Next Steps (4–6 Weeks)

The technical foundation is in place. Focus shifts to process and polish:

1. ~~**Audit export UI in dashboard**~~ — Settings → Audit Log → Export (API + UI in shipgate-dashboard) **Done**
2. ~~**Slack notification dispatch**~~ — Wire stored rules to actually send Slack messages on run/finding events **Done**
3. ~~**Security & Compliance page**~~ — Public page with subprocessor list, data retention, encryption model, compliance status (landing Security page) **Done**
4. ~~**Data Processing Agreement (DPA)**~~ — Template at `docs/legal/DPA-TEMPLATE.md` **Done**
5. ~~**Policy documents**~~ — InfoSec, Access Control, Incident Response, BCP/DR at `docs/policies/` **Done**

---

## Documentation Checklist

| Document                    | Purpose                           | Status |
|---------------------------|-----------------------------------|--------|
| Security policy            | Internal/external reference       | Draft at `docs/policies/SECURITY-POLICY.md` |
| Privacy policy             | Public, GDPR-aligned             | Updated (GDPR legal basis, retention, subprocessors, DPA, cookies) |
| Subprocessor list          | SOC 2, GDPR Art 28                | Published on Security page |
| DPA template               | Enterprise contracts              | Draft at `docs/legal/DPA-TEMPLATE.md` |
| Incident response playbook | SOC 2 CC7, general preparedness   | Draft at `docs/policies/INCIDENT-RESPONSE-POLICY.md` |
| Pen test report            | Third-party validation (annual)    | Not started |

---

## Cost Considerations

- **SOC 2 audit**: $15k–$50k+ depending on scope and auditor
- **SSO provider**: $0–$10k+/yr (e.g. Auth0, Okta)
- **Pen testing**: $10k–$30k per engagement
- **Legal/compliance**: Policy drafting, DPA, vendor reviews

---

## Success Metrics

- [ ] SOC 2 Type I report issued
- [ ] SSO live for at least one Enterprise customer
- [ ] Audit export used in a customer audit
- [ ] Security questionnaire response time < 5 business days
- [ ] Zero critical security incidents with material impact

---

*Last updated: 2026-03-01. Previous version: 2026-02-27.*
