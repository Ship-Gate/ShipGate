# Risk Register

**Internal Reference — ShipGate**

*Supports SOC 2 CC3 (Risk Assessment). Last updated: 2026-03-01.*

---

## Risk Scoring

- **Likelihood**: 1 (Rare) – 5 (Almost Certain)
- **Impact**: 1 (Negligible) – 5 (Critical)
- **Risk Score**: Likelihood × Impact
- **Rating**: Low (1–6), Medium (7–12), High (13–19), Critical (20–25)

---

## Active Risks

| # | Risk | Category | Likelihood | Impact | Score | Rating | Mitigation | Owner | Status |
|---|------|----------|-----------|--------|-------|--------|------------|-------|--------|
| R-001 | OAuth token theft from database | Data Protection | 2 | 5 | 10 | Medium | AES-256-GCM encryption at rest | Engineering | Mitigated |
| R-002 | Privilege escalation via API | Auth | 1 | 5 | 5 | Low | RBAC enforced on all routes | Engineering | Mitigated |
| R-003 | Session hijacking | Auth | 2 | 4 | 8 | Medium | HTTPS, secure cookies, audit logs | Engineering | Mitigated |
| R-004 | Webhook spoofing (Vercel/Railway) | Integrity | 2 | 3 | 6 | Low | HMAC signature verification | Engineering | Mitigated |
| R-005 | Database outage (data loss) | Availability | 2 | 5 | 10 | Medium | Provider backups; BCP/DR policy | Infrastructure | Partial |
| R-006 | DDoS against dashboard | Availability | 2 | 3 | 6 | Low | Hosting provider protections | Infrastructure | Accepted |
| R-007 | Supply chain compromise (npm) | Integrity | 2 | 4 | 8 | Medium | Lockfile enforcement, dependency audits | Engineering | Mitigated |
| R-008 | Encryption key compromise | Data Protection | 1 | 5 | 5 | Low | Env-only, not in code; rotation process | Engineering | Mitigated |
| R-009 | Insider misuse / accidental deletion | Operations | 1 | 4 | 4 | Low | Audit trail, limited prod access, DB backups | Engineering | Mitigated |
| R-010 | No SSO — enterprise IdP not supported | Compliance | 3 | 3 | 9 | Medium | Planned for Phase 2 | Product | Open |
| R-011 | No SCIM — manual provisioning | Compliance | 3 | 2 | 6 | Low | Planned for Phase 2 | Product | Open |
| R-012 | Formal SOC 2 audit not yet engaged | Compliance | 3 | 4 | 12 | Medium | Technical controls in place; engage auditor | Leadership | Open |
| R-013 | No rate limiting on API endpoints | Security | 2 | 3 | 6 | Low | Add per-route rate limiting | Engineering | Open |
| R-014 | No automated secret rotation | Operations | 2 | 3 | 6 | Low | Document manual rotation cadence | Engineering | Open |

---

## Closed / Accepted Risks

| # | Risk | Resolution | Date |
|---|------|------------|------|
| (none yet) | | | |

---

## Review

This register is reviewed quarterly and updated when risks are identified, mitigated, or when the threat model changes.
