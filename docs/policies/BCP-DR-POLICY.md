# Business Continuity and Disaster Recovery Policy

**Internal Reference — ShipGate**

*Draft for review by legal/compliance. Last updated: 2026-03-01.*

---

## 1. Purpose

This policy establishes requirements for business continuity and disaster recovery (BCP/DR) to ensure ShipGate can continue or resume operations after disruptive events.

---

## 2. Scope

- Customer-facing services (dashboard, API)
- Core infrastructure (databases, hosting)
- Dependencies (Stripe, OAuth providers, etc.)

---

## 3. Objectives

- **Recovery Time Objective (RTO)**: Restore critical services within [TBD] hours
- **Recovery Point Objective (RPO)**: Minimise data loss; database backups support point-in-time recovery
- **Availability target**: [TBD]% (e.g., 99.5% or 99.9% per SLA)

---

## 4. Key Dependencies

| Service       | Purpose        | Failure impact                  |
|---------------|----------------|---------------------------------|
| PostgreSQL    | Primary data   | Service unavailable             |
| OAuth (GitHub, Google) | Auth  | Sign-in affected                |
| Stripe        | Billing        | New subscriptions affected      |
| Hosting       | Dashboard/API  | Full outage                     |

---

## 5. Backup and Recovery

- **Database**: Automated backups; retention per provider SLA
- **Configuration**: Infra-as-code; secrets in secure storage
- **Application**: Version-controlled; reproducible deployments

---

## 6. Response Procedures

### 6.1 Service Outage

1. Assess scope and cause
2. Communicate status via status page / support channels
3. Restore from backup or failover where applicable
4. Post-mortem and remediation

### 6.2 Data Loss or Corruption

1. Isolate affected systems
2. Restore from last known-good backup
3. Verify data integrity
4. Notify affected customers if applicable

### 6.3 Dependency Failure

- **OAuth**: Users may not sign in; cached sessions may work until expiry
- **Stripe**: Existing subscriptions continue; new charges delayed
- **Database**: Failover to replica if configured; otherwise restore from backup

---

## 7. Testing and Maintenance

- Recovery procedures are documented and tested periodically
- RTO/RPO and availability targets are reviewed annually
- Dependencies and single points of failure are identified and mitigated where possible

---

## 8. Review

This policy is reviewed at least annually and updated when architecture or dependencies change.
