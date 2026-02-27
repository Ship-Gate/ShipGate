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

- No SSO/SAML for enterprise IdPs
- No SCIM provisioning
- No documented retention or deletion policies
- No formal security/incident response program (process, not code)
- No formal SOC 2 readiness/audit program engagement
- Audit export UI not yet in dashboard settings (API exists)
- Slack notification dispatch not yet wired (rules stored, events not yet fired)

---

## Phases

### Phase 1: SOC 2 Readiness (Foundation) — LARGELY COMPLETE

**Target: 3–4 months to Type I readiness**

| Control area        | Deliverable                                          | Status |
|---------------------|------------------------------------------------------|--------|
| **Security policies** | InfoSec, Access, Incident Response, BCP/DR policies | Not started (process) |
| **Risk assessment** | Asset inventory, threat model, risk register          | Not started (process) |
| **Vendor management** | Subprocessor list, DPAs, vendor review process     | Not started (legal) |
| **Access control**  | RBAC (org admin vs member vs viewer), least-privilege | **DONE** |
| **Audit trail**     | Immutable logs with IP/UA/requestId, export for auditors | **DONE** |
| **Encryption**      | AES-256-GCM at rest (tokens), TLS in transit         | **DONE** |

**Technical work completed:**

1. **RBAC** — `role` on `Membership` (admin, member, viewer); enforced on all API routes; billing/tokens restricted to admin/member; viewer for read-only
2. **Audit log enhancements** — `ipAddress`, `userAgent`, `requestId`, `sessionId` fields added; login/logout/token/role changes logged
3. **Audit export API** — `GET /api/v1/audit?from=&to=&format=csv|json` with pagination, org scope, admin-only access
4. **Encryption at rest** — AES-256-GCM via `lib/encryption.ts` for all stored OAuth tokens; `TOKEN_ENCRYPTION_KEY` env var

**Remaining Phase 1 work (process, not code):**

- Draft and publish InfoSec, Access Control, Incident Response policies
- Complete asset inventory and threat model
- Compile subprocessor list and DPA template

---

### Phase 2: SSO & Enterprise Identity

**Target: 2–3 months**

| Deliverable            | Description                                      | Status |
|-------------------------|--------------------------------------------------|--------|
| **SAML 2.0 SSO**       | IdP-initiated and SP-initiated flows             | Not started |
| **SCIM provisioning**  | User/group sync from IdP                         | Not started |
| **Just-in-Time (JIT)** | Auto-provision users on first SSO login          | Not started |
| **Domain verification**| Allow only corporate email domains               | Not started |

**Technical work (Phase 2)**

- Integrate with Auth0, Okta, or similar for SAML + SCIM
- Add `Org.ssoDomain`, `Org.samlEntityId`, `Org.samlMetadataUrl` to Prisma schema
- Enforce SSO-only for Enterprise orgs
- Admin console for SSO and domain config

---

### Phase 3: SOC 2 Type II Audit

**Target: 6–12 months of evidence collection**

| Activity                    | Timeline        |
|-----------------------------|-----------------|
| Engage SOC 2 auditor        | Month 1          |
| Implement control gaps       | Months 1–3      |
| Run controls in production   | Months 1–12     |
| Evidence collection          | Ongoing         |
| Type II audit                | After 6–12 months |

**Control families (CC series)**

- **CC1** – Control environment
- **CC2** – Communication
- **CC3** – Risk assessment
- **CC4** – Monitoring
- **CC5** – Control activities
- **CC6** – Logical access *(RBAC implemented)*
- **CC7** – System operations *(Audit trail implemented)*
- **CC8** – Change management *(ShipGate's proof bundles and audit trail)*
- **CC9** – Risk mitigation

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

1. **Audit export UI in dashboard** — Settings → Audit Log → Export (API already exists)
2. **Slack notification dispatch** — Wire stored rules to actually send Slack messages on run/finding events
3. **Security & Compliance page** — Public page with subprocessor list, data retention, encryption model, compliance status
4. **Data Processing Agreement (DPA)** — Standard template for Enterprise customers
5. **Policy documents** — InfoSec, Access Control, Incident Response, BCP/DR

---

## Documentation Checklist

| Document                    | Purpose                           | Status |
|---------------------------|-----------------------------------|--------|
| Security policy            | Internal/external reference       | Not started |
| Privacy policy             | Public, GDPR-aligned             | Not started |
| Subprocessor list          | SOC 2, GDPR Art 28                | Not started |
| DPA template               | Enterprise contracts              | Not started |
| Incident response playbook | SOC 2 CC7, general preparedness   | Not started |
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

*Last updated: 2026-02-27. Previous version: 2026-02-16.*
